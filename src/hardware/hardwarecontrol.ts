import { DIR_IN, DIR_LOW } from "rpi-gpio";
import { EventBus } from "src/utils/eventbus";

var nconf = require('nconf');
var gpio = require('rpi-gpio')
var gpiop = gpio.promise;

const logger = require('node-color-log');

nconf.use('file', { file: './config.json' });

/**
 * This converts the HardwareControl class into a singleton.
 * So only one instance can exist.
 */
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

    // 'Subclasses' for hardware
    public volumeEncoder = new VolumeEncoder();
    public recordManager = new RecordManager();

    constructor() {
        // Setup gpio pins
        gpio.setup(nconf.get('pins:motor'), gpio.DIR_OUT, gpio.EDGE_BOTH, this.defaultGpioCallback);
        gpio.setup(nconf.get('pins:playPausePin'), gpio.DIR_IN, gpio.EDGE_BOTH, ((err, value) => {
            this.defaultGpioCallback(err, value);

            // Set the initial play thing
            this.readChannel('playPausePin', (err, value) => {
                this.defaultGpioCallback(err, value);
                this.handleOnChange(nconf.get('pins:playPausePin'), value);
            })
            
        }).bind(this));
        gpio.setup(nconf.get('pins:optical'), gpio.DIR_IN, gpio.EDGE_BOTH, ((err, value) => {
            this.defaultGpioCallback(err, value);

            // Set the initial track scanner state
            this.readChannel('optical', (err, value) => {
                this.defaultGpioCallback(err, value);
                this.recordManager.state.scanner.pulses.prevState = value;
            })
        }).bind(this));
        gpio.setup(nconf.get('pins:volumeEncoder:A'), gpio.DIR_IN, gpio.EDGE_BOTH, this.defaultGpioCallback);
        gpio.setup(nconf.get('pins:volumeEncoder:B'), gpio.DIR_IN, gpio.EDGE_BOTH, this.defaultGpioCallback);

        //Play pause callback for reading disc procedure
        EventBus.addListener('playPausePin', (async (value) => {

            // When 'playing', start scanning procedures. 
            if (value == 1) {
                // Start to scan the record (both tag and track)
                this.recordManager.startScanningTag();
                this.recordManager.startScanningTrack();

                this.writeChannel('motor', true);

                this.recordManager.state.scanner.controllerState = 'RUNNING';
                logger.info('Started scanning record (both tag and track)');

                // Wait for it to complete (or to be aborted)
                var recordInterval = setInterval((() => {
                    // When both track and tag are loaded, go ahead and send newRecord event
                    if (this.recordManager.state.record.loaded.tag && this.recordManager.state.record.loaded.track) {
                        clearInterval(recordInterval);
                        EventBus.emit('newRecord', this.recordManager.state.record);
                    } else if (this.recordManager.state.scanner.controllerState == 'ABORTED') {
                        clearInterval(recordInterval);
                        logger.warn('Record scanning was aborted')
                    }
                }).bind(this), 500)
            } else {
                this.writeChannel('motor', false);
                this.recordManager.state.scanner.controllerState = 'ABORTED';
            }
        }).bind(this))

        // Register event handler
        gpio.on('change', ((channel, value) => {
            this.handleOnChange(channel, value);
        }).bind(this));
        logger.info('HardwareControl ready')
    }

    defaultGpioCallback(err, value) {
        if (err) throw err;
    }

    async handleOnChange(channel, value) {

        logger.debug(`Got value on channel '${channel}' with value '${value}'`);
        
        var callbackCategory = '';
        switch (channel) {
            case nconf.get('pins:playPausePin'):
                EventBus.emit('playPausePin', value);
                break;
            case nconf.get('pins:volumeEncoder:A'):
                this.volumeEncoder.handleOnChange(null, value);
                EventBus.emit('volumeEncoder', this.volumeEncoder.position, this.volumeEncoder.dir);
                break;
            
            case nconf.get('pins:volumeEncoder:B'):
                
                this.volumeEncoder.handleOnChange(null, value);
                EventBus.emit('volumeEncoder', this.volumeEncoder.position, this.volumeEncoder.dir);
                break;
            case nconf.get('pins:optical'):
                this.recordManager.handleOpticalChange(value);
                break;
            default:
                return;
        }
    }

    readChannel(channel: string, callback: Function) {
        return gpiop.read(nconf.get(`pins:${channel}`), callback);
    }

    writeChannel(channel:string, value:boolean) {
        return gpio.write(nconf.get(`pins:${channel}`), value);
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


/**
 * This class is responsible for managing the record (so scanning the tag AND the track)
 */
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
            controllerState: 'RUNNING',
            pulses: {
                prevTimeStamp: 0,
                measuring: false,
                prevState: -1,
                longPulse: {
                    minPeriod: nconf.get('pulses:long:minPeriod'),
                    maxPeriod: nconf.get('pulses:long:maxPeriod'),
                    amount: 0
                },
                shortPulse: {
                    minPeriod: nconf.get('pulses:short:minPeriod'),
                    maxPeriod: nconf.get('pulses:short:maxPeriod'),
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

    constructor() {

        // Register handlers
        EventBus.addListener('optical', ((value) => {
            this.handleOpticalChange(value);
        }).bind(this));

        // Start card reading procedure
        setInterval( (() => {
            this.pollTag();
        }).bind(this), 100);
    }

    handleOpticalChange(value) {
        if (!this.state.scanner.scanningTrack) { // If not scanning the track, just ignore it
            return;
        }

        // Simulation?
        if (nconf.get('options:simulateRecordTrack:enabled')) {

            this.state.record.selectedTrack = nconf.get('options:simulateRecordTrack:data');
            this.state.record.loaded.track = true;
            logger.info(`Simulated selected track scanning. Selected track: ${this.state.record.selectedTrack}`);
            this.stopScanningTrack()
            return;
        }

        // Determine signal flank: 'RISING' or 'FALLING'
        var flank; 
        if (this.state.scanner.pulses.prevState < value) { 
            flank = 'RISING';
        } else if (this.state.scanner.pulses.prevState > value) {
            flank = 'FALLING';
        } else {
            this.state.scanner.pulses.prevState = value;
            return;
        }

        // A rising flank means that the sensor is at the beginning of a 'gap' (also called a 'pulse')
        // A falling flank means that the sensor is at the end of pulse
        if (flank == 'RISING') {

            if (this.state.scanner.pulses.measuring) {
                // Already measuring a pulse, just set value and move on. Probably a false positive.
                this.state.scanner.pulses.prevState = value;
                return;
            }

            // Start measurement of a gap
            this.state.scanner.pulses.prevTimeStamp = Date.now();
            this.state.scanner.pulses.measuring = true;
        } else if (flank == 'FALLING') {

            if (!this.state.scanner.pulses.measuring) {
                // Measurement did not start yet. Probably started in the middle of a pulse. Ignore this one, but set the prevState
                this.state.scanner.pulses.prevState = value;
                return;
            }

            // Measure length of gap
            var endTime = Date.now();
            var difference = endTime - this.state.scanner.pulses.prevTimeStamp;

            if (difference > this.state.scanner.pulses.longPulse.maxPeriod + this.state.scanner.pulses.shortPulse.minPeriod) {
                // Pulse is way too big. Something went wrong, stop measurement and throw result away.
                logger.debug('Found super long pulse')
                this.state.scanner.pulses.measuring = false;

            } else if (difference >= this.state.scanner.pulses.shortPulse.minPeriod &&
                    difference <= this.state.scanner.pulses.shortPulse.maxPeriod) {
                
                // Short pulse found!
                logger.debug('Found short pulse')
                this.state.scanner.pulses.shortPulse.amount += 1;
                this.state.scanner.pulses.measuring = false;

            } else if (difference >= this.state.scanner.pulses.longPulse.minPeriod &&
                    difference <= this.state.scanner.pulses.longPulse.maxPeriod) {
                
                // Long pulse found! We can determine track number!
                logger.debug('Found long pulse')
                this.state.record.selectedTrack = this.state.scanner.pulses.shortPulse.amount;
                this.state.scanner.pulses.measuring = false;

                // Track number is loaded
                this.state.record.loaded.track = true;
                logger.info(`Found selected track: ${this.state.record.selectedTrack}`);
                this.stopScanningTrack();
            } else {
                // Probably a false positive, just keep going and ignore new state...
                logger.debug('Found super short pulse')
                return;
            }
        }

        this.state.scanner.pulses.prevState = value;
        return;
    }

    stopScanningTrack() {
        this.state.scanner.scanningTrack = false;

        logger.info('Stopped measuring selected track')
    }
    startScanningTrack() {
        this.state.scanner.pulses.longPulse.amount = 0;
        this.state.scanner.pulses.shortPulse.amount = 0;
        this.state.record.loaded.track = false;
        this.state.scanner.scanningTrack = true;

        logger.info('Started measuring selected track')
    }

    stopScanningTag() {
        this.state.scanner.scanningTag = false;
        logger.info('Stopped measuring record tag')
    }
    startScanningTag() {
        this.state.record.loaded.tag = false;
        this.state.scanner.scanningTag = true;

        logger.info('Started measuring record tag')
    }

    /**
     *  This function reads the tag and updates the record. Only runs when scanning procedure is enabled.
     */
    pollTag() {
        if (!this.state.scanner.scanningTag) { // Scanning procedure not enabled...
            return;
        }

        var data = '';
        if (!nconf.get('options:simulateRecordData:enabled')) { // Use hardware

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

            this.mfrc522.stopCrypto();
        } else { // Simulate (mocking the chip)
            data = nconf.get('options:simulateRecordData:data');
        }
        
        var splittedData = data.split(';');

        // Update record and disable itself
        this.state.record.uri = splittedData[0];
        this.state.record.loaded.tag = true;

        logger.info(`Found a new record tag with uri: ${this.state.record.uri}`);

        this.stopScanningTag();
    }
}

class VolumeEncoder {

    public position = 0;
    public dir = 0;

    private A;
    private B;

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
    
    /**
     * Handles a change in encoder pins, resulting in position/dir changes.
     */
    async handleOnChange(A = null, B = null) {
        
        this.A = A === null ? this.A : A;
        this.B = B === null ? this.B : B;

        var value = this.getValue(A, B);
        if (this.curValue === null) {
            this.curValue = value;
            return;
        }

        var prevValue = this.curValue;
        this.curValue = value;
        var action = this.lookupMatrix[prevValue][this.curValue];
        
        logger.debug(`Encoder received new action: ${action}`);

        if (action != 2) {
            this.dir = action;
            this.position += action;
        }
    }
}