import { Request, Response, NextFunction } from 'express';
import { SanitizeMiddleware } from './sanitize.middleware';

describe('SanitizeMiddleware', () => {
  let middleware: SanitizeMiddleware;

  beforeEach(() => {
    middleware = new SanitizeMiddleware();
  });

  it('sanitizes XSS payloads in request body and query values', () => {
    const req = {
      body: {
        title: '  <script>alert(1)</script><b>safe</b>\0  ',
        nested: {
          tags: ['<img src=x onerror=alert(1)>', 42, true, null],
        },
      },
      query: {
        q: '<svg onload=alert(1)>search</svg>',
      },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    middleware.use(req, {} as Response, next);

    expect(req.body).toEqual({
      title: '&lt;script&gt;alert(1)&lt;/script&gt;<b>safe</b>',
      nested: {
        tags: ['<img src>', 42, true, null],
      },
    });
    expect(req.query).toEqual({
      q: '&lt;svg onload=alert(1)&gt;search&lt;/svg&gt;',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
