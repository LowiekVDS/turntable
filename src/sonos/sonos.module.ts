import { HttpModule, HttpService, Module } from '@nestjs/common';
import { SonosService } from './sonos.service';

@Module({
    imports: [HttpModule],
    providers: [SonosService],
    exports: [SonosModule, SonosService]
})
export class SonosModule {}
