import { HttpException, HttpService, Injectable } from '@nestjs/common';
import { Record } from 'src/hardware/hardwarecontrol';
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
        EventBus.addListener('volumeEncoder', ((pos, dir) => {
            this.changeVolume(dir)
        }).bind(this))

        // Play pause thing callback. Playing is done by event 'newRecord'
        EventBus.addListener('playPausePin', ((value) => {
            if (value == false) {
                this.pause()
            }
        }).bind(this));

        // Play the song when a new record has been found
        EventBus.addListener('newRecord', ((record: Record) => {
            this.playSongFromPlaylist(record.uri, record.selectedTrack)
        }).bind(this))

        // Emit event on status every second
        // setInterval(( async () => {
        //     const state = await this.getState();
        //     EventBus.emit('sonos.state', state);
        // }).bind(this), 1000);
    }

    /**
     * Get the state of the selected Sonos speakers
     */
    async getState(): Promise<any> {
        return (await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/state`).toPromise()).data;
    }

    /**
     * Get all available sonos rooms
     */
    async getSonosRooms(): Promise<string[]> {

        const result = await this.httpService.get(`${process.env.SONOS_API_HOST}/zones`).toPromise();
        
        var rooms: string[] = [];
        result.data.forEach(zone => {
            rooms.push(zone.coordinator.roomName);
        });

        return rooms;
    }

    async play() {
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/play`).toPromise();
    }

    async pause() {
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/pause`).toPromise();
    }

    async changeVolume(relativeValue: number) {
        if (relativeValue > 0) {
            await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/volume/+1`).toPromise();
        } else if (relativeValue < 0) {
            await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/volume/-1`).toPromise();
        }
    }

    async playSongFromPlaylist(uri: string, index: number) {
        await this.prepareSongFromPlaylist(uri, index);
        await this.sleep(50);
        await this.play();
    }

    async prepareSongFromPlaylist(uri: string, index: number) {
        await this.prepareSpotifyUri(uri);
        await this.sleep(100);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/trackseek/${index}`).toPromise();
    }

    async prepareSpotifyUri(uri: string) {
        await this.playSpotifyUri(uri);
        await this.sleep(50);
        await this.pause();
    }

    async playSpotifyUri(uri: string) {
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/clearqueue`).toPromise();
        await this.sleep(50);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/shuffle/off`).toPromise();
        await this.sleep(50);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/clearqueue`).toPromise();
        await this.sleep(50);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/spotify/now/${uri}`).toPromise();
        await this.sleep(50);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/repeat/off`).toPromise();
        await this.sleep(50);
        await this.httpService.get(`${process.env.SONOS_API_HOST}/${nconf.get('sonos:room')}/crossfade/off`).toPromise();
    }

    async sleep(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }
}
