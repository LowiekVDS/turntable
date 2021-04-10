import { HttpException, HttpService, Injectable } from '@nestjs/common';
import { MediumInfo } from 'src/hardware/medium';
import { EventBus } from 'src/utils/eventbus';

const qs = require('qs');
const fs = require('fs');

var nconf = require('nconf');
nconf.use('file', { file: './config.json' });

require('dotenv').config();

@Injectable()
export class SonosService {

    constructor(private httpService: HttpService) {
        // Volume control callback
        EventBus.addListener('volume', ((pos, dir) => {
            this.changeVolume(dir)
        }).bind(this))

        // Play pause thing callback
        EventBus.addListener('playPausePin', ((value) => {
            if (value == 0) {
                this.pause()
            } else if (value == 1) {
                this.play()
            }
        }).bind(this));

        // Play a new medium/song
        EventBus.addListener('medium.new', ((mediumInfo: MediumInfo) => {
            this.prepareSongFromPlaylist(mediumInfo.uri, mediumInfo.trackNumber)
        }).bind(this))

        // Emit event on status every second
        setInterval(( async () => {
            const state = await this.getState();
            EventBus.emit('sonos.state', state);
        }).bind(this), 1000);
    }

    async getState(): Promise<any> {
        return (await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/state`).toPromise()).data;
    }

    async getSonosRooms(): Promise<string[]> {

        const result = await this.httpService.get(`${process.env.SONOS_API_HOST}/zones`).toPromise();
        
        var rooms: string[] = [];
        result.data.forEach(zone => {
            rooms.push(zone.coordinator.nconf.get('sonos:room'));
        });

        return rooms;
    }

    async play() {
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/play`).toPromise();
    }

    async pause() {
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/play`).toPromise();
    }

    async changeVolume(relativeValue: number) {
        if (relativeValue > 0) {
            this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/volume/+1`)
        } else if (relativeValue < 0) {
            this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/volume/-1`)
        }
    }

    async playSongFromPlaylist(uri: string, index: number) {
        await this.prepareSongFromPlaylist(uri, index);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/play`).toPromise();
    }

    async prepareSongFromPlaylist(uri: string, index: number) {
        await this.prepareSpotifyUri(uri);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/trackseek/${index}`).toPromise();
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/pause`).toPromise();
    }

    async prepareSpotifyUri(uri: string) {
        await this.playSpotifyUri(uri);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/pause`).toPromise();
    }

    async playSpotifyUri(uri: string) {
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/clearqueue`).toPromise();
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/shuffle/off`).toPromise();
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/repeat/off`).toPromise();
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/crossfade/off`).toPromise();
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/spotify/now/${uri}`).toPromise();
    }
}
