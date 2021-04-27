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

You will also need to make a .env file (it does not come with this repository):
```
HOST=http://localhost:3000
PORT=3000
SONOS_API_HOST=http://localhost:5005
LOG_LEVEL=debug
```

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

## Configuration and handy commands
The configuration page is reachable at http://turntable.local:3000/

The pinout and settings (to for example mock the tag reading procedure) is available at /config.json

The servers are ran automatically on startup. To stop the processes, run ```sudo pkill -f node```
When you need to run the processes again, run ```sudo node /home/apps/node-sonos-http-api/server.js & (cd /home/apps/turntable/ && sudo node dist/main)```
