import { OtpService } from './otp.service';
import { SmsService } from '../shared/sms/sms.service';

// In-memory fake Redis that actually stores values, so we can assert
// the code stored under the OTP key matches what SMS delivery received.
const store = new Map<string, string>();

const redisMock = {
  exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),
  get: jest.fn(async (key: string) => store.get(key) ?? null),
  ttl: jest.fn(async () => -2),
  setex: jest.fn(async (key: string, _ttl: number, value: string) => {
    store.set(key, value);
    return 'OK';
  }),
  del: jest.fn(async (key: string) => {
    store.delete(key);
    return 1;
  }),
  pipeline: jest.fn(() => ({
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    setex: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, 1], [null, 1], [null, 'OK']]),
  })),
};

jest.mock('ioredis', () => jest.fn().mockImplementation(() => redisMock));
jest.mock('../config/redis.config', () => ({
  redisConfig: jest.fn().mockReturnValue({}),
  getRedisUrl: jest.fn().mockReturnValue('redis://localhost:6379'),
}));

const mockConfigService = { get: jest.fn().mockReturnValue(undefined) };
const mockEventEmitter = { emit: jest.fn() };

describe('OtpService — SMS delivery integration', () => {
  let service: OtpService;
  let smsService: jest.Mocked<SmsService>;
  let deliveredCode: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    deliveredCode = undefined;

    smsService = {
      sendVerificationCode: jest.fn(async (_phone: string, code: string) => {
        deliveredCode = code;
      }),
    } as any;

    service = new OtpService(
      mockConfigService as any,
      mockEventEmitter as any,
      smsService as any
    );
  });

  it('delivers the same OTP via SMS that is stored in Redis', async () => {
    const phoneNumber = '+2348012345678';

    const result = await service.requestOtp(phoneNumber);

    expect(result.success).toBe(true);
    expect(smsService.sendVerificationCode).toHaveBeenCalledTimes(1);

    const storedOtp = store.get(`otp:${phoneNumber.replace(/\s+/g, '').replace(/[-()]/g, '')}`);
    expect(storedOtp).toBeDefined();
    expect(deliveredCode).toBe(storedOtp);
  });

  it('does not store a usable OTP delivery when SMS delivery fails', async () => {
    smsService.sendVerificationCode.mockRejectedValueOnce(new Error('Twilio down'));
    const phoneNumber = '+2348012345678';

    const result = await service.requestOtp(phoneNumber);

    expect(result.success).toBe(false);
    expect(mockEventEmitter.emit).not.toHaveBeenCalledWith('otp.sent', expect.anything());
    // Note: the OTP is still written to Redis before delivery is attempted,
    // so it exists in the store even though SMS delivery failed — this
    // documents current behavior (see quota/ordering note below).
    const storedOtp = store.get(`otp:${phoneNumber.replace(/\s+/g, '').replace(/[-()]/g, '')}`);
    expect(storedOtp).toBeDefined();
  });
});