import { v4 as uuidv4 } from 'uuid';

// Middleware to attach a correlation ID to each request
const correlationIdMiddleware = (req, res, next) => {
  const headerKey = 'x-correlation-id';
  const correlationId = req.headers[headerKey] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader(headerKey, correlationId);
  next();
};

export default correlationIdMiddleware;
