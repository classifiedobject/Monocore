import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : { message: 'Internal server error' };

    const errorDetail =
      exception instanceof Error
        ? {
            name: exception.name,
            message: exception.message,
            stack: exception.stack
          }
        : exception;

    const log = {
      level: 'error',
      status,
      path: request.url,
      method: request.method,
      error: payload,
      detail: errorDetail,
      timestamp: new Date().toISOString()
    };

    console.error(JSON.stringify(log));

    response.status(status).json({
      statusCode: status,
      error: payload,
      ...(process.env.NODE_ENV !== 'production' ? { detail: errorDetail } : {})
    });
  }
}
