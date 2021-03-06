import { Controller, Get, HttpException, Query, Render, Req, Res, Session } from '@nestjs/common';
import { AppService } from './app.service';
import { HardwareService } from './hardware/hardware.service';
import { SonosService } from './sonos/sonos.service';

var nconf = require('nconf');

nconf.use('file', { file: './config.json' });

require('dotenv').config()

@Controller()
export class AppController {
    constructor(private readonly appService: AppService,
                private sonosService: SonosService,
                private hardwareService: HardwareService) { }
    
    // Get configuration/status dashboard. Renders views/config.hbs
    @Get()
    @Render('config')
    async dashboard() {

        const rooms = await this.sonosService.getSonosRooms();

        return {
            rooms,
            state: {
                currentRoom: nconf.get('sonos:room') || 'None'
            },
            api: {
                setRoom: '/api/setroom'
            },
            record: this.hardwareService.getRecord()
        }
    }

    // Saves the Sonos room
    @Get('api/setroom')
    async setroom(@Query('room') room: string, @Res() res) {
        const rooms = await this.sonosService.getSonosRooms();
        if (!rooms.includes(room)) {
            throw new HttpException("Bad request", 400);
        }

        nconf.set('sonos:room', room);
        await nconf.save();

        return res.redirect('/')
    }
}
