import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Env } from './config/env';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('API_PORT', { infer: true });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('WEB_URL', { infer: true }),
    credentials: true,
  });
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Errwise API')
    .setDescription('API documentation for Errwise')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
}
void bootstrap();
