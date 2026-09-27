export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.requestId, path: req.path, message: error.message, stack: process.env.NODE_ENV === 'production' ? undefined : error.stack }));
  return res.status(status).json({
    error: {
      code: error.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message: status === 500 ? 'The server could not complete the request.' : error.message,
      requestId: req.requestId
    }
  });
}
