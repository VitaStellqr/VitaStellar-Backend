
import { v4 as uuidv4 } from 'uuid';

// Map known error names to HTTP status codes
const errorCodeMap = {
  ValidationError: 422,
  UnauthorizedError: 401,
  ForbiddenError: 403,
  NotFoundError: 404,
  BadRequestError: 400,
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || errorCodeMap[err.name] || 500;
  const errorKey = err.key || err.code || 'errors.SERVER_ERROR';
  const message = req.t ? req.t(errorKey, { defaultValue: err.message }) : err.message || 'Internal Server Error';
  const details = err.details || undefined;
  const correlationId = req.correlationId || req.headers['x-correlation-id'] || uuidv4();

  // Log error with correlationId
  if (req.log) {
    req.log.error({ err, correlationId });
  } else {
    // eslint-disable-next-line no-console
    console.error(`[${correlationId}]`, err);
  }

  res.setHeader('x-correlation-id', correlationId);
  res.status(statusCode).json({
    code: errorKey,
    message,
    details,
    correlationId,
  });
};

export default errorHandler;
