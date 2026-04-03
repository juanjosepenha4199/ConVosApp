import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { UPLOADS_ABSOLUTE_DIR } from './uploads-dir';
import { GlobalHttpExceptionFilter } from './filters/http-exception.filter';

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v?.trim()) {
    console.error(
      `[ConVos] Falta ${name}. En Railway: Variables del servicio que ejecuta la API (no solo el proyecto). Redeploy tras guardar.`,
    );
    process.exit(1);
  }
}

async function bootstrap() {
  // En Railway las variables van en el servicio; aquí fallamos antes de Prisma con un mensaje claro.
  // No validamos en local: ConfigModule carga .env después de este punto.
  if (process.env.RAILWAY_ENVIRONMENT) {
    requireEnv('DATABASE_URL');
    requireEnv('REDIS_URL');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Dev-friendly static serving for uploaded photos (use S3/CDN in prod)
  app.use('/uploads', express.static(UPLOADS_ABSOLUTE_DIR));

  await app.listen(Number(process.env.PORT ?? 4000));
}
bootstrap();
