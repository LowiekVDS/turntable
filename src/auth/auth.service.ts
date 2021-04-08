import { HttpService, Injectable } from "@nestjs/common";
const qs = require('qs');

require('dotenv').config();

@Injectable()
export class AuthService {

    constructor(private httpService: HttpService) {}

    async handleOauthCallback(authCode: string) {

        var data = `${process.env.SONOS_CLIENT_ID}:${process.env.SONOS_CLIENT_SECRET}`;
        var buff = Buffer.from(data);

        var result = await this.httpService.post('https://api.sonos.com/login/v3/oauth/access', qs.stringify({
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: process.env.HOST + '/auth/callback'
        }), {
            headers: {
                'Authorization': `Basic ${buff.toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).toPromise();

        
    }

 
}