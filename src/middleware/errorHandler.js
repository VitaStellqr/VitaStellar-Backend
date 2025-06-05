const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  // Get the error key or use default key
  const errorKey = err.key || 'errors.SERVER_ERROR';
  const message = req.t ? req.t(errorKey, { defaultValue: err.message }) : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

export default errorHandler;
