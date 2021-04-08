import { HttpModule, HttpService, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SonosStrategy } from './sonos.strategy';
import { AuthService } from "./auth.service";

@Module({
    imports: [SonosStrategy, HttpModule],
    controllers: [AuthController],
    providers: [AuthService]
    
})
export class AuthModule {

}