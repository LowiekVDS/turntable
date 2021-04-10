import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { SonosModule } from './sonos/sonos.module';
import { HardwareModule } from './hardware/hardware.module';

@Module({
  imports: [SonosModule, HardwareModule, HardwareModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
