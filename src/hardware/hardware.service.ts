import { Injectable } from "@nestjs/common";
import { HardwareControlFactory } from "./hardwarecontrol";

@Injectable()
export class HardwareService {

    private hardwareControlInstance = HardwareControlFactory.getInstance();

    constructor() { }
    

}