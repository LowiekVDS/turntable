import { NestFactory } from '@nestjs/core';
import * as session from 'express-session';
import { AppModule } from './app.module';

require('dotenv').config()

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors({
        origin: ['http://localhost:3000'],
        credentials: true,
    });
    app.use(session({ secret: process.env.SESSION_SECRET }));

  await app.listen(3000);
}
bootstrap();
