import { Injectable } from "@nestjs/common";
import { HardwareControlFactory, Record } from "./hardwarecontrol";

@Injectable()
export class HardwareService {

    private hardwareControlInstance = HardwareControlFactory.getInstance();

    constructor() { }
    
    getRecord(): Record {
        return this.hardwareControlInstance.getRecord();
    }

}