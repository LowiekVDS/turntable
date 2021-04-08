import { Controller, Get, Render, Req, Res, Session } from '@nestjs/common';
import { AppService } from './app.service';

require('dotenv').config()
const fs = require('fs')
import {constants} from 'fs'
import { SonosService } from './sonos/sonos.service';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService,
                private sonosService: SonosService) { }
    
    @Get()
    @Render('config')
    async dashboard(@Session() session) {

        var data = {
            sonos_status: false,
            spotify_status: false,
            sonos_auth_url: '/sonos/auth'
        }

        try {
            await fs.access('tokens_sonos.json', constants.R_OK | constants.W_OK, (err) => {});
            data.sonos_status = true;
            console.log('true');
        } catch (e) {
            console.log(e);
            console.log('nope')
         }
        
        return data;
    }

    @Get('info')
    async info() {
        this.sonosService.playSongFromPlaylist('lounge', 'spotify:album:0qn1jsJoxn1TsgkDqP9pP9', 6)
        return;
    }

}
