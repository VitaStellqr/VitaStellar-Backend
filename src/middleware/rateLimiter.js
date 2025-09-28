import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../config/redis.js';

// Custom key generator for per-user rate limiting
const generateKey = (req) => {
  // If user is authenticated, use user ID for per-user limiting
  if (req.user && req.user.id) {
    return `user:${req.user.id}`;
  }
  // Otherwise, use IP address for per-IP limiting with proper IPv6 handling
  return `ip:${ipKeyGenerator(req)}`;
};

// Custom skip function to exclude certain requests
const skipSuccessfulRequests = (req, res) => {
  // Skip rate limiting for successful requests (optional)
  return res.statusCode < 400;
};

// Create store configuration
const createStore = () => {
  try {
    return new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    });
  } catch (error) {
    console.warn('Redis not available, using memory store for rate limiting');
    return undefined; // Use default memory store
  }
};

// General API rate limiter - 100 requests per 15 minutes
export const generalRateLimit = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP/user to 100 requests per windowMs
  keyGenerator: generateKey,
  skip: skipSuccessfulRequests,
  message: {
    error: 'Too many requests from this IP/user, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    const retryAfter = Math.round(req.rateLimit.resetTime / 1000);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: retryAfter,
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining,
      resetTime: new Date(req.rateLimit.resetTime).toISOString()
    });
  }
});

// Strict rate limiter for authentication endpoints - 5 requests per 15 minutes
export const authRateLimit = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  keyGenerator: (req) => `auth:${ipKeyGenerator(req)}`, // Always use IP for auth endpoints
  skip: skipSuccessfulRequests,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.round(req.rateLimit.resetTime / 1000);
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Authentication rate limit exceeded. Please try again later.',
      retryAfter: retryAfter,
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining,
      resetTime: new Date(req.rateLimit.resetTime).toISOString()
    });
  }
});

// Strict rate limiter for password reset - 3 requests per hour
export const passwordResetRateLimit = rateLimit({
  store: createStore(),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  keyGenerator: (req) => `password-reset:${ipKeyGenerator(req)}`,
  skip: skipSuccessfulRequests,
  message: {
    error: 'Too many password reset attempts, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.round(req.rateLimit.resetTime / 1000);
    res.status(429).json({
      error: 'Too many password reset attempts',
      message: 'Password reset rate limit exceeded. Please try again later.',
      retryAfter: retryAfter,
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining,
      resetTime: new Date(req.rateLimit.resetTime).toISOString()
    });
  }
});

// Strict rate limiter for 2FA endpoints - 10 requests per 15 minutes
export const twoFactorRateLimit = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 2FA attempts per windowMs
  keyGenerator: (req) => `2fa:${ipKeyGenerator(req)}`,
  skip: skipSuccessfulRequests,
  message: {
    error: 'Too many 2FA attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.round(req.rateLimit.resetTime / 1000);
    res.status(429).json({
      error: 'Too many 2FA attempts',
      message: '2FA rate limit exceeded. Please try again later.',
      retryAfter: retryAfter,
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining,
      resetTime: new Date(req.rateLimit.resetTime).toISOString()
    });
  }
});

// Strict rate limiter for file uploads - 20 requests per hour
export const uploadRateLimit = rateLimit({
  store: createStore(),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each user to 20 uploads per hour
  keyGenerator: generateKey,
  skip: skipSuccessfulRequests,
  message: {
    error: 'Too many file uploads, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.round(req.rateLimit.resetTime / 1000);
    res.status(429).json({
      error: 'Too many file uploads',
      message: 'File upload rate limit exceeded. Please try again later.',
      retryAfter: retryAfter,
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining,
      resetTime: new Date(req.rateLimit.resetTime).toISOString()
    });
  }
});

// Strict rate limiter for admin endpoints - 200 requests per 15 minutes
export const adminRateLimit = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for admin users
  keyGenerator: generateKey,
  skip: skipSuccessfulRequests,
  message: {
    error: 'Too many admin requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.round(req.rateLimit.resetTime / 1000);
    res.status(429).json({
      error: 'Too many admin requests',
      message: 'Admin rate limit exceeded. Please try again later.',
      retryAfter: retryAfter,
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining,
      resetTime: new Date(req.rateLimit.resetTime).toISOString()
    });
  }
});

// Custom rate limiter for specific endpoints
export const createCustomRateLimit = (options = {}) => {
  const defaults = {
    store: createStore(),
    keyGenerator: generateKey,
    skip: skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = Math.round(req.rateLimit.resetTime / 1000);
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: retryAfter,
        limit: req.rateLimit.limit,
        remaining: req.rateLimit.remaining,
        resetTime: new Date(req.rateLimit.resetTime).toISOString()
      });
    }
  };

  return rateLimit({ ...defaults, ...options });
};
