import { HttpService, Injectable } from "@nestjs/common";
import { DIR_IN, DIR_LOW } from "rpi-gpio";
import { SonosService } from "src/sonos/sonos.service";
import { EventBus } from "src/utils/eventbus";
import { MediumFactory } from "./medium";

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
    public medium = MediumFactory.getInstance();

    constructor() {
        // Setup gpio pins
        gpio.setup(nconf.get('pins:motor'), DIR_LOW);
        gpio.setup(nconf.get('pins:playPausePin'), DIR_IN);
        gpio.setup(nconf.get('pins:optical'), DIR_IN);

        gpio.setup(nconf.get('pins:volumeEncoder:A'), DIR_IN);
        gpio.setup(nconf.get('pins:volumeEncoder:B'), DIR_IN);

        // Encoder callback
        EventBus.addListener('volumeEncoder', this.volumeEncoder.handleOnChange);

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
                EventBus.emit('volumeEncoderHardware', await this.readChannel('volumeEncoder:A'), await this.readChannel('volumeEncoder:B'));
                EventBus.emit('volume', this.volumeEncoder.position, this.volumeEncoder.dir);
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

    constructor() {
        EventBus.addListener('volumeEncoderHardware', ((A, B) => {
            this.handleOnChange(this.getValue(A, B));
        }).bind(this))
    }

    async getValue(A, B) {
        return 2 * A + B;
    }
    
    async handleOnChange(value) { 
        if (this.curValue === null) {
            this.curValue = value
            return;
        }

        var prevValue = this.curValue;
        this.curValue = value
        var action = this.lookupMatrix[prevValue][this.curValue];

        if (action != 2) {
            this.dir = action;
            this.position += action;
        }
    }
}