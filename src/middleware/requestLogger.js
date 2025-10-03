// Simple request logger middleware that attaches a log object to req
// In production, replace with a real logger (e.g., Winston, Bunyan)
const requestLogger = (req, res, next) => {
  req.log = {
    error: (info) => {
      // Log error with correlationId if present
      if (info && info.correlationId) {
        // eslint-disable-next-line no-console
        console.error(`[${info.correlationId}]`, info.err || info);
      } else {
        // eslint-disable-next-line no-console
        console.error(info);
      }
    },
    info: (msg) => {
      // eslint-disable-next-line no-console
      console.log(msg);
    },
  };
  next();
};

export default requestLogger;
