# Rate Limiting Implementation

This document describes the rate limiting implementation in the Uzima Backend API to prevent abuse and brute force attacks.

## Overview

The rate limiting system uses Redis as a store to track request counts and implements different limits for different types of endpoints. It provides both per-IP and per-user rate limiting based on authentication status.

## Features

- **Per-IP Rate Limiting**: Limits requests based on client IP address
- **Per-User Rate Limiting**: Limits requests based on authenticated user ID
- **Multiple Rate Limit Types**: Different limits for different endpoint categories
- **Redis Storage**: Persistent rate limit counters across server restarts
- **Standard Headers**: Includes `RateLimit-*` headers in responses
- **429 Responses**: Returns proper HTTP 429 status with retry information

## Rate Limits

| Endpoint Type | Limit | Window | Description |
|---------------|-------|--------|-------------|
| General API | 100 requests | 15 minutes | All API endpoints |
| Authentication | 5 requests | 15 minutes | Login, register, 2FA |
| 2FA Operations | 10 requests | 15 minutes | 2FA enable/verify/disable |
| Password Reset | 3 requests | 1 hour | Password reset attempts |
| File Upload | 20 requests | 1 hour | File upload operations |
| Admin Operations | 200 requests | 15 minutes | Admin-only endpoints |

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
```

### Redis Setup

Make sure Redis is running on your system:

```bash
# Install Redis (macOS)
brew install redis

# Start Redis
brew services start redis

# Or start manually
redis-server
```

## Implementation Details

### Middleware Structure

The rate limiting is implemented using `express-rate-limit` with a custom Redis store:

```javascript
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../config/redis.js';
```

### Key Generation

The system uses different keys for different scenarios:

- **Authenticated Users**: `user:${userId}` - Per-user limiting
- **Anonymous Users**: `ip:${ipAddress}` - Per-IP limiting
- **Special Endpoints**: Custom keys like `auth:${ip}` for authentication

### Response Format

When rate limit is exceeded, the API returns:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 900,
  "limit": 100,
  "remaining": 0,
  "resetTime": "2024-01-01T12:00:00.000Z"
}
```

### Headers

The following headers are included in all responses:

- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Unix timestamp when the limit resets

## Testing

### Manual Testing

Use the provided test script:

```bash
node test-rate-limit.js
```

### Automated Testing

Run the test suite:

```bash
npm test -- --testNamePattern="Rate Limiting"
```

### Testing Different Scenarios

1. **General Rate Limiting**: Make 100+ requests to `/api`
2. **Auth Rate Limiting**: Make 5+ login attempts
3. **Header Verification**: Check for `RateLimit-*` headers
4. **Reset Behavior**: Wait for window to expire and verify reset

## Monitoring

### Redis Keys

Rate limit data is stored in Redis with keys like:

- `user:123` - User-specific limits
- `ip:192.168.1.1` - IP-specific limits
- `auth:192.168.1.1` - Authentication attempt limits

### Logging

Rate limit violations are logged with:
- Timestamp
- IP address
- User ID (if authenticated)
- Endpoint accessed
- Rate limit type

## Customization

### Creating Custom Rate Limits

```javascript
import { createCustomRateLimit } from '../middleware/rateLimiter.js';

const customLimit = createCustomRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  keyGenerator: (req) => `custom:${req.ip}`,
  message: 'Custom rate limit exceeded'
});
```

### Modifying Existing Limits

Edit the rate limit configurations in `src/middleware/rateLimiter.js`:

```javascript
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Change this value
  // ... other options
});
```

## Security Considerations

1. **IP Spoofing**: Rate limiting by IP can be bypassed with IP spoofing
2. **Distributed Attacks**: Consider implementing distributed rate limiting
3. **Whitelisting**: Add trusted IPs to bypass rate limits if needed
4. **Monitoring**: Monitor for unusual patterns that might indicate attacks

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Ensure Redis is running
   - Check `REDIS_URL` in environment variables
   - Verify network connectivity

2. **Rate Limits Not Working**
   - Check Redis connection
   - Verify middleware is applied correctly
   - Check for conflicting middleware

3. **Headers Not Present**
   - Ensure `standardHeaders: true` is set
   - Check middleware order

### Debug Mode

Enable debug logging by setting:

```env
DEBUG=rate-limit:*
```

## Performance Impact

- **Memory Usage**: Minimal impact with Redis storage
- **Response Time**: ~1-2ms additional latency per request
- **Scalability**: Redis allows horizontal scaling across multiple servers

## Future Enhancements

1. **Sliding Window**: Implement sliding window rate limiting
2. **Burst Allowance**: Allow short bursts above the limit
3. **Dynamic Limits**: Adjust limits based on server load
4. **Geographic Limits**: Different limits for different regions
5. **User Tier Limits**: Different limits based on user subscription tier
