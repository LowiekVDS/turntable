import { Controller, Get, HttpException, Req, Res, Session } from '@nestjs/common';

require('dotenv').config()
import { v4 as uuidv4 } from 'uuid';
import { SonosService } from './sonos.service';

@Controller('sonos')
export class SonosController {

    constructor(private sonosService: SonosService) {}

    @Get('auth')
    async authSonos(@Session() session, @Res() res) {
        session.state = uuidv4()
        return res.redirect(`https://api.sonos.com/login/v3/oauth?client_id=${process.env.SONOS_CLIENT_ID}&response_type=code&state=${session.state}&scope=playback-control-all&redirect_uri=${process.env.HOST}/sonos/callback`)
    }
    
    @Get('callback')
    async authSonosCallback(@Req() req, @Res() res, @Session() session) {
        if (!session.state || (session.state != req.query.state)) {
            throw new HttpException("Bad request", 400)
        }
        await this.sonosService.handleOauthCallback(req.query.code);
        return res.redirect('/')
    }
}
