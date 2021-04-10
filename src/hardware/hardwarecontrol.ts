import { HttpService, Injectable } from "@nestjs/common";
import { DIR_IN, DIR_LOW } from "rpi-gpio";
import { SonosService } from "src/sonos/sonos.service";
import { EventBus } from "src/utils/eventbus";

var nconf = require('nconf');
var gpio = require('rpi-gpio')
var gpiop = gpio.promise;

nconf.use('file', { file: './config.json' });

export const HardwareControlFactory = (function () {
    var instance;
    return {
        getInstance: function () {
            if (instance == null) {
                instance = new HardwareControl();
                instance.constructor = null;
            }
            return instance;
        }
    }
})();

class HardwareControl {

    public volumeEncoder = new VolumeEncoder();
    public recordManager = new RecordManager();

    constructor() {
        // Setup gpio pins
        gpio.setup(nconf.get('pins:motor'), DIR_LOW);
        gpio.setup(nconf.get('pins:playPausePin'), DIR_IN);
        gpio.setup(nconf.get('pins:optical'), DIR_IN);

        gpio.setup(nconf.get('pins:volumeEncoder:A'), DIR_IN);
        gpio.setup(nconf.get('pins:volumeEncoder:B'), DIR_IN);

        this.readChannel('optical').then((value) => {
            this.recordManager.state.scanner.pulses.prevState = value;
        })

        //Play pause thing callback for motor 
        // EventBus.addListener('playPausePin', ((value) => {
        //     if (value == 0) {
        //         this.writeChannel('motor', false);
        //     } else if (value == 1) {
        //         this.writeChannel('motor', true);
        //     }
        // }).bind(this));
        
        //Play pause callback for reading disc procedure
        EventBus.addListener('playPausePin', ((value) => {
            if (value == 1) {
                // We need to start playing!
                this.recordManager.startScanningTag();
                this.recordManager.startScanningTrack();

                while (!this.recordManager.state.record.loaded.tag && !this.recordManager.state.record.loaded.track) { }
                
                EventBus.emit('newRecord', this.recordManager.state.record);
            }
        }).bind(this))


        // React on sonos playback state
        // EventBus.addListener('sonos.state', ((state) => {
        //     if (state.playbackState == 'PLAYING') {
        //         this.writeChannel('motor', true);
        //     } else {
        //         this.writeChannel('motor', false);
        //     }
        // }).bind(this));
    
        // Register event
        gpio.on('change', this.handleOnChange)
    }

    async handleOnChange(channel, value) {
        
        var callbackCategory = '';
        switch (channel) {
            case nconf.get('pins:playPausePin'):
                EventBus.emit('playPausePin', value);
                break;
            case nconf.get('pins:volumeEncoder:A'):
            case nconf.get('pins:volumeEncoder:B'):

                this.volumeEncoder.handleOnChange(await this.readChannel('volumeEncoder:A'), await this.readChannel('volumeEncoder:B'));
                EventBus.emit('volumeEncoder', this.volumeEncoder.position, this.volumeEncoder.dir);
                break;
            case nconf.get('pins:optical'):
                EventBus.emit('optical', value);
                break;
            default:
                return;
        }
    }

    readChannel(channel: string): Promise<any> {
        return gpiop.read(nconf.get(`pins:${channel}`));
    }

    writeChannel(channel:string, value:boolean) {
        return gpiop.write(nconf.get(`pins:${channel}`), value);
    }
}

const Mfrc522 = require("mfrc522-rpi");
const SoftSPI = require("rpi-softspi");

export type Record = {
    uri: string,
    loaded: boolean,
    nrOfTracks: number,
    selectedTrack: number
}

export type Pulse = {
    minPeriod: number, // in ms
    maxPeriod: number
}

class RecordManager {

    private softSPI = new SoftSPI({
        clock: 23, // pin number of SCLK
        mosi: 19, // pin number of MOSI
        miso: 21, // pin number of MISO
        client: 24 // pin number of CS
    });

    private mfrc522 = new Mfrc522(this.softSPI).setResetPin(nconf.get('pins:nfc:reset'))

    public state = {
        scanner: {
            scanningTag: false,
            scanningTrack: false,
            pulses: {
                prevTimeStamp: 0,
                measuring: false,
                prevState: -1,
                longPulse: {
                    minPeriod: 50,
                    maxPeriod: 110,
                    amount: 0
                },
                shortPulse: {
                    minPeriod: 50,
                    maxPeriod: 110,
                    amount: 0
                }
            }
        },
        record: {
            uri: '',
            loaded: {
                track: false,
                tag: false
            },
            nrOfTracks: 12,
            selectedTrack: 0
        },
    }

    private shortPulse: Pulse = {
        minPeriod: 50,
        maxPeriod: 110
    }

    private longPulse: Pulse = {
        minPeriod: 200,
        maxPeriod: 300
    }

    constructor() {

        // Register handlers
        EventBus.addListener('optical', this.handleOpticalChange);

        // Start card reading procedure
        setInterval( (() => {
            this.pollTag();
        }).bind(this), 100);
    }

    handleOpticalChange(value) {
        if (!this.state.scanner.scanningTrack) {
            return;
        }

        var flank; // Determine signal flank: 'RISING' or 'FALLING'
        if (this.state.scanner.pulses.prevState < value) { 
            flank = 'RISING';
        } else if (this.state.scanner.pulses.prevState > value) {
            flank = 'FALLING';
        } else { //No flank found, just update value (for initialization) and exit
            this.state.scanner.pulses.prevState = value;
            return;
        }

        if (flank == 'RISING') {

            if (this.state.scanner.pulses.measuring) {
                // Already measuring, do not measure again, do not set prevState
                // Probably a false positive
                return;
            }

            // Start measurement of gap
            this.state.scanner.pulses.prevTimeStamp = Date.now();
            this.state.scanner.pulses.longPulse.amount = 0;
            this.state.scanner.pulses.shortPulse.amount = 0;
            this.state.scanner.pulses.measuring = true;
        } else if (flank == 'FALLING') {

            if (!this.state.scanner.pulses.measuring) {
                // Probably started in the middle of a pulse. Ignore this one, but set the prevState
                this.state.scanner.pulses.prevState = value;
                return;
            }

            // Stop measurement of gap
            var endTime = Date.now();
            // Determine if short, long or no pulse
            var difference = endTime - this.state.scanner.pulses.prevTimeStamp;

            if (difference > this.state.scanner.pulses.longPulse.maxPeriod + this.state.scanner.pulses.shortPulse.minPeriod) {
                // Pulse is way too big. Stop measuring
                this.state.scanner.pulses.measuring = false;
            } else if (difference >= this.state.scanner.pulses.shortPulse.minPeriod &&
                difference <= this.state.scanner.pulses.shortPulse.maxPeriod) {
                // Short pulse found!
                this.state.scanner.pulses.shortPulse.amount += 1;
            } else if (difference >= this.state.scanner.pulses.shortPulse.minPeriod &&
                difference <= this.state.scanner.pulses.shortPulse.maxPeriod) {
                // Long pulse found! "Pulse Closure": we can determine track number!
                // Determine track number...
                this.state.record.selectedTrack = this.state.record.nrOfTracks
                this.state.record.loaded.track = true;
                
                this.stopScanningTrack();

                this.state.scanner.pulses.measuring = false;
            } else {
                // Probably a false positive, keep going...
                return;
            }
        }

        this.state.scanner.pulses.prevState = value;
        return;
    }

    stopScanningTrack() {
        this.state.scanner.scanningTrack = false;
    }
    startScanningTrack() {
        this.state.record.loaded.track = false;
        this.state.scanner.scanningTrack = true;
    }

    stopScanningTag() {
        this.state.scanner.scanningTag = false;
    }
    startScanningTag() {
        this.state.record.loaded.tag = false;
        this.state.scanner.scanningTag = true;
    }

    pollTag() {
        if (!this.state.scanner.scanningTag) {
            return;
        }

        var data = '';
        if (!nconf.get('options:simulateRecord:enabled')) {

            this.mfrc522.reset();

            let response = this.mfrc522.findCard();
            if (!response.status) {
                return;
            }

            const uuid = response.data;
    
            /**
             * Fetch data:
             * Looks like this: spotify:track:7KNdhg5DjPyvSeEawXYhlv; (40 bytes)
             * 
             * The chip contains 4 blocks in each sector. The first three are used to write data. Every block contains 16 bytes
             * Our whole message fits in just 3 blocks!
             * 
             * This program uses blocks 8, 9 and 10
             */
            for (var i = 8; i <= 10; i++) {
                var blockData = this.mfrc522.getDataForBlock(i);
                data += new TextDecoder().decode(Uint8Array.from(blockData));
            }
        } else {
            data = nconf.get('options:simulateRecord:data');
        }
        
        // Split data
        var splittedData = data.split(';');
        
        //this.state.record.nrOfTracks = parseInt(splittedData[0]);
        this.state.record.uri = splittedData[0];
        this.state.record.loaded.tag = true;

        this.stopScanningTag();

        this.mfrc522.stopCrypto();
    }
}

class VolumeEncoder {

    public position = 0;
    public dir = 0;
    
    private curValue = null;
    private lookupMatrix = [
        [0, -1, 1, 2],
        [1, 0, 2, -1],
        [-1, 2, 0, 1],
        [2, 1, -1, 0]
    ];

    constructor() {}

    async getValue(A, B) {
        return 2 * A + B;
    }
    
    async handleOnChange(A, B) {
        var value = this.getValue(A, B);
        if (this.curValue === null) {
            this.curValue = value;
            return;
        }

        var prevValue = this.curValue;
        this.curValue = value;
        var action = this.lookupMatrix[prevValue][this.curValue];
        
        console.log(action);

        if (action != 2) {
            this.dir = action;
            this.position += action;
        }
    }
}