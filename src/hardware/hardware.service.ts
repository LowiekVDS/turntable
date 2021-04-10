import { Injectable } from "@nestjs/common";
import { SonosService } from "src/sonos/sonos.service";
import { HardwareControlFactory } from "./hardwarecontrol";

@Injectable()
export class HardwareService {

    private hardwareControlInstance = HardwareControlFactory.getInstance();

    constructor() { }
    

}