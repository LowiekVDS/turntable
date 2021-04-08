import { HttpException, HttpService, Injectable } from '@nestjs/common';

const qs = require('qs');
const fs = require('fs');

@Injectable()
export class SonosService {

    constructor(private httpService: HttpService) {}

    async handleOauthCallback(authCode: string) {

        var data = `${process.env.SONOS_CLIENT_ID}:${process.env.SONOS_CLIENT_SECRET}`;
        var buff = Buffer.from(data);

        var result;
        try {
            result = await this.httpService.post('https://api.sonos.com/login/v3/oauth/access', qs.stringify({
                grant_type: 'authorization_code',
                code: authCode,
                redirect_uri: process.env.HOST + '/sonos/callback'
            }), {
                headers: {
                    'Authorization': `Basic ${buff.toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }).toPromise();
        } catch (e) {
            throw new HttpException("Unauthorized", 401);
        }

        // Save the authorization and refresh token
        var tokenfile = {
            access_token: result.data.access_token,
            refresh_token: result.data.refresh_token
        }
        fs.writeFileSync('tokens_sonos.json', JSON.stringify(tokenfile), );
    }
}
