import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { SonosModule } from './sonos/sonos.module';

@Module({
  imports: [AuthModule, SonosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
