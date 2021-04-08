import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-oauth2";
import { v4 as uuidv4 } from 'uuid';

require('dotenv').config()

export class SonosStrategy extends PassportStrategy(Strategy, 'sonos') {

    

    private state;

    constructor() {

        var state = uuidv4();

        super({
            authorizationURL: "https://api.sonos.com/login/v3/oauth",
			tokenURL        : "https://api.sonos.com/login/v3/oauth/access",
			clientID        : process.env.SONOS_CLIENT_ID,
			clientSecret    : process.env.SONOS_CLIENT_SECRET,
			callbackURL     : "/auth/callback",
            scope: "playback-control-all",
            state: true,
            
        })

        this.state = state
    }

    async validate(accessToken: string, refreshToken: string, profile): Promise<any> {
        console.log(this.state);
        console.log(accessToken, refreshToken, profile);
        return {
            accessToken,
            refreshToken
        }
    }
}