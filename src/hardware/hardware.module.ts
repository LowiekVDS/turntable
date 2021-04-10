import { Module } from '@nestjs/common';
import { SonosModule } from 'src/sonos/sonos.module';
import { HardwareService } from './hardware.service';

@Module({
    imports: [SonosModule],
    providers: [HardwareService]
})
export class HardwareModule {}
