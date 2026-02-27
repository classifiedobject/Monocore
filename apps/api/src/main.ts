import 'reflect-metadata';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { CsrfMiddleware } from './common/middleware/csrf.middleware.js';
import { requestLogger } from './common/middleware/request-logger.middleware.js';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(cookieParser());
  app.use(requestLogger);
  app.use(new CsrfMiddleware().use);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const webPort = Number(process.env.WEB_PORT ?? 3000);
  const allowedOrigins = new Set([
    'http://localhost:3000',
    `http://localhost:${webPort}`,
    'http://127.0.0.1:3000',
    `http://127.0.0.1:${webPort}`
  ]);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true
  });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
}

bootstrap();
