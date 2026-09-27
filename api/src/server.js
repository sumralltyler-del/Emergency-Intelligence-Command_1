import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { settings } from './config.js';
import { apiRouter } from './routes/api.js';
import { ApiError, errorMiddleware } from './utils/errors.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: false }));
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  const started = Date.now();
  res.on('finish', () => console.log(JSON.stringify({ level: res.statusCode >= 500 ? 'error' : 'info', message: 'request', requestId: req.requestId, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Date.now() - started })));
  next();
});

app.use('/api', apiRouter);
app.use((req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found.')));
app.use(errorMiddleware);

const server = app.listen(settings.port, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', message: 'API listening', port: settings.port }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', message: 'Shutting down', signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
