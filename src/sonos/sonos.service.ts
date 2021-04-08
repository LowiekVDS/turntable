import { HttpException, HttpService, Injectable } from '@nestjs/common';

const qs = require('qs');
const fs = require('fs');

require('dotenv').config();

@Injectable()
export class SonosService {

    constructor(private httpService: HttpService) {}

    async getSonosRooms(): Promise<string[]> {

        const result = await this.httpService.get(`${process.env.SONOS_API_HOST}/zones`).toPromise();
        
        var rooms: string[] = [];
        result.data.forEach(zone => {
            rooms.push(zone.coordinator.roomName);
        });

        return rooms;
    }

    async playSongFromPlaylist(roomName: string, uri: string, index: number) {
        await this.prepareSpotifyUri(roomName, uri);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${roomName}/trackseek/${index}`).toPromise();
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${roomName}/play`).toPromise();
    }

    async prepareSpotifyUri(roomName: string, uri: string) {
        await this.playSpotifyUri(roomName, uri);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${roomName}/pause`).toPromise();
    }

    async playSpotifyUri(roomName:string, uri: string) {
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${roomName}/clearqueue`).toPromise();
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${roomName}/shuffle/off`).toPromise();
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${roomName}/repeat/off`).toPromise();
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${roomName}/crossfade/off`).toPromise();
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${roomName}/spotify/now/${uri}`).toPromise();
    }
}
