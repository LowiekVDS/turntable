import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SonosAuthGuard } from './auth.guards';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {

    constructor(private authService: AuthService) {}

    @Get('login')
    @UseGuards(SonosAuthGuard)
    async login() { }

    @Get('callback')
    async callback(@Req() req, @Res() res) {

        await this.authService.handleOauthCallback(req.query.code)
        res.send(200)
        return;
    }

}
