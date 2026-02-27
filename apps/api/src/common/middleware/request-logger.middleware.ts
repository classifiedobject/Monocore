import { NextFunction, Request, Response } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        level: 'info',
        type: 'http_access',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString()
      })
    );
  });
  next();
}
