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

        // Play pause thing callback for motor 
        EventBus.addListener('playPausePin', ((value) => {
            if (value == 0) {
                this.writeChannel('motor', false);
            } else if (value == 1) {
                this.writeChannel('motor', true);
            }
        }).bind(this));

        EventBus.addListener('sonos.state', (state) => {
            console.log(state.playbackState);
        })
    
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

    private state = {
        scanner: {
            scanningTag: false,
            scanningTrack: false,

        },
        record: {
            uri: '',
            loaded: false,
            nrOfTracks: 0,
            selectedTrack: 0
        },
    }

    constructor() {

        // Register all callbacks


        // Start card reading procedure
        this.state.scanner.scanningTag = false;
        setInterval( (() => {
            this.pollTag();
        }).bind(this), 100);
    }

    async 

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
             * Looks like this: 16;spotify:track:7KNdhg5DjPyvSeEawXYhlv; (40 bytes)
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
        
        this.state.record.nrOfTracks = parseInt(splittedData[0]);
        this.state.record.uri = splittedData[1];

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

        if (action != 2) {
            this.dir = action;
            this.position += action;
        }
    }
}