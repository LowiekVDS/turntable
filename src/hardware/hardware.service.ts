import { Injectable } from "@nestjs/common";
import { SonosService } from "src/sonos/sonos.service";
import { HardwareControlFactory } from "./hardwarecontrol";
import { MediumFactory } from "./medium";

@Injectable()
export class HardwareService {

    private hardwareControlInstance = HardwareControlFactory.getInstance();
    private medium = MediumFactory.getInstance();

    constructor() { }
    

}