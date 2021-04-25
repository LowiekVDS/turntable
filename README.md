# Turntable
## Installation and running
Both servers need to run simultaneously to work. You can connect with the raspberry pi by ssh'ing into it (pi@turntable.local)
### Turntable server
Clone this repository, cd to it and run
```
sudo npm install
sudo npm run build
```
To run the software, run the following command:
```
sudo node dist/main
``` 
The configuration page is reachable at http://turntable.local:3000/
The pinout and settings (to for example mock the tag reading procedure) is available at /config.json

### Sonos API server
Clone the repository [jishi/node-sonos-http-api: An HTTP API bridge for Sonos easing automation. Hostable on any node.js capable device, like a raspberry pi or similar. (github.com)](https://github.com/jishi/node-sonos-http-api)
Run the following commands to install:
```
sudo npm install
```
And the following command to run;
```
sudo node server.js
```
