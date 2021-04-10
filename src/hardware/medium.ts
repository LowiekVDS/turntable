import { HardwareControlFactory } from "./hardwarecontrol";

export const MediumFactory = (function () {
    var instance;
    return {
        getInstance: function () {
            if (instance == null) {
                instance = new Medium();
            }
            return instance;
        }
    }
})()

const Mfrc522 = require("mfrc522-rpi");
const SoftSPI = require("rpi-softspi");
var nconf = require('nconf');
nconf.use('file', { file: './config.json' });

export type MediumInfo = {
    totalNumberCount: number,
    trackNumber: number,
    uri: string
}

class Medium {

    private softSPI = new SoftSPI({
        clock: 23, // pin number of SCLK
        mosi: 19, // pin number of MOSI
        miso: 21, // pin number of MISO
        client: 24 // pin number of CS
    });

    private mfrc522 = new Mfrc522(this.softSPI).setResetPin(nconf.get('pins:nfc:reset'))

    private state = {
        scan: false
    }

    private mediumInfo: MediumInfo = {
        totalNumberCount: 0,
        trackNumber: 0,
        uri: ''
    }

    private selectedNumber = 0;

    constructor() {
        // Start card reading procedure
        this.state.scan = true;
        setInterval( (() => {
            this.poll();
        }).bind(this), 500);
    }

    poll() {
        if (!this.state.scan) {
            return;
        }

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
        var data = '';
        for (var i = 8; i <= 10; i++) {
            var blockData = this.mfrc522.getDataForBlock(i);
            data += new TextDecoder().decode(Uint8Array.from(blockData));
        }
        
        // Split data
        var splittedData = data.split(';');
        
        this.mediumInfo = {
            totalNumberCount: parseInt(splittedData[0]),
            trackNumber: 0,
            uri: splittedData[1]
        }
        
        this.state.scan = false; // Disable itself
        this.mfrc522.stopCrypto();
    }
}