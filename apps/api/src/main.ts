import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { CsrfMiddleware } from './common/middleware/csrf.middleware.js';
import { requestLogger } from './common/middleware/request-logger.middleware.js';
import { apiEnv } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', apiEnv.trustProxy);

  app.use(cookieParser());
  app.use(requestLogger);
  app.use(new CsrfMiddleware().use);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const allowedOrigins = new Set(apiEnv.corsOrigins);

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

  await app.listen(apiEnv.API_PORT, '0.0.0.0');
}

bootstrap();
