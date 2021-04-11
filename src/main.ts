import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as session from 'express-session';
import { join } from 'path';
import { AppModule } from './app.module';

require('dotenv').config()
require('node-color-log').setLevel(process.env.LOG_LEVEL || 'error');
require('node-color-log').setLevelColor();

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.useStaticAssets(join(__dirname, '..', 'src/public'));
    app.setBaseViewsDir(join(__dirname, '..', 'src/views'));
    app.setViewEngine('hbs');

  await app.listen(process.env.PORT);
}
bootstrap();
