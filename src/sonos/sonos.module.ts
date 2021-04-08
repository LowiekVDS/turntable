import { HttpModule, HttpService, Module } from '@nestjs/common';
import { SonosService } from './sonos.service';
import { SonosController } from './sonos.controller';

@Module({
    imports: [HttpModule],
  providers: [SonosService],
  controllers: [SonosController]
})
export class SonosModule {}
