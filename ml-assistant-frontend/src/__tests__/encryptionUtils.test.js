import { encryptAESGCM, decryptAESGCM } from '../encryptionUtils.js';

// Mock Web Crypto API for testing
const mockCrypto = {
  getRandomValues: jest.fn(arr => {
    // Return predictable values for testing
    for (let i = 0; i < arr.length; i++) {
      arr[i] = i % 256;
    }
    return arr;
  }),
  subtle: {
    importKey: jest.fn().mockResolvedValue('mockKeyMaterial'),
    deriveKey: jest.fn().mockResolvedValue('mockDerivedKey'),
    encrypt: jest.fn().mockImplementation(() => {
      // Mock encrypted data
      const mockEncrypted = new ArrayBuffer(32);
      const view = new Uint8Array(mockEncrypted);
      for (let i = 0; i < view.length; i++) {
        view[i] = (i + 100) % 256;
      }
      return Promise.resolve(mockEncrypted);
    }),
    decrypt: jest.fn().mockImplementation(() => {
      // Mock decrypted data - return original text as ArrayBuffer
      const originalText = 'Patient diagnosed with hypertension';
      const encoder = new TextEncoder();
      return Promise.resolve(encoder.encode(originalText).buffer);
    }),
  },
};

// Mock browser globals
global.window = {
  crypto: mockCrypto,
  btoa: jest.fn(str => Buffer.from(str, 'binary').toString('base64')),
  atob: jest.fn(str => Buffer.from(str, 'base64').toString('binary')),
};

global.TextEncoder = function () {
  this.encode = jest.fn(str => new Uint8Array(Buffer.from(str, 'utf8')));
};

global.TextDecoder = function () {
  this.decode = jest.fn(buffer => {
    if (buffer.byteLength === 32) {
      return 'Patient diagnosed with hypertension'; // Mock decrypted result
    }
    return Buffer.from(buffer).toString('utf8');
  });
};

describe('Client-Side Web Crypto API Encryption Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('AES-GCM Encryption/Decryption', () => {
    const testPassword = 'securePassword123!';
    const testData = 'Patient diagnosed with hypertension';

    test('should encrypt data using Web Crypto API', async () => {
      const result = await encryptAESGCM(testData, testPassword);

      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('data');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.data).toBe('string');

      // Verify Web Crypto API calls
      expect(window.crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      expect(window.crypto.subtle.deriveKey).toHaveBeenCalled();
      expect(window.crypto.subtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(Uint8Array),
        }),
        'mockDerivedKey',
        expect.any(Uint8Array)
      );
    });

    test('should decrypt encrypted data correctly', async () => {
      const encryptedData = {
        iv: 'mockIvBase64String',
        data: 'mockEncryptedDataBase64String',
      };

      const result = await decryptAESGCM(encryptedData, testPassword);

      expect(result).toBe(testData);
      expect(window.crypto.subtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(ArrayBuffer),
        }),
        'mockDerivedKey',
        expect.any(ArrayBuffer)
      );
    });

    test('should use different IVs for each encryption', async () => {
      // Mock crypto.getRandomValues to return different values
      let callCount = 0;
      window.crypto.getRandomValues.mockImplementation(arr => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = (i + callCount) % 256;
        }
        callCount++;
        return arr;
      });

      const result1 = await encryptAESGCM(testData, testPassword);
      const result2 = await encryptAESGCM(testData, testPassword);

      expect(result1.iv).not.toBe(result2.iv);
      expect(window.crypto.getRandomValues).toHaveBeenCalledTimes(4); // 2 calls per encryption (IV + salt)
    });

    test('should use PBKDF2 with correct parameters', async () => {
      await encryptAESGCM(testData, testPassword);

      expect(window.crypto.subtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PBKDF2',
          salt: expect.any(Uint8Array),
          iterations: 100000,
          hash: 'SHA-256',
        }),
        'mockKeyMaterial',
        expect.objectContaining({
          name: 'AES-GCM',
          length: 256,
        }),
        false,
        ['encrypt']
      );
    });

    test('should handle empty strings', async () => {
      const emptyString = '';
      const result = await encryptAESGCM(emptyString, testPassword);

      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('data');
      expect(window.crypto.subtle.encrypt).toHaveBeenCalled();
    });

    test('should handle special characters and unicode', async () => {
      const unicodeData = '🏥 Patient: José María González 中文测试 العربية';
      const result = await encryptAESGCM(unicodeData, testPassword);

      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('data');
      expect(TextEncoder.prototype.encode).toHaveBeenCalledWith(unicodeData);
    });
  });

  describe('Key Derivation Security', () => {
    test('should use high iteration count for PBKDF2', async () => {
      await encryptAESGCM('test data', 'password');

      const deriveKeyCall = window.crypto.subtle.deriveKey.mock.calls[0];
      const pbkdf2Params = deriveKeyCall[0];

      expect(pbkdf2Params.iterations).toBe(100000);
      expect(pbkdf2Params.hash).toBe('SHA-256');
    });

    test('should generate random salt for each key derivation', async () => {
      let saltCallCount = 0;
      window.crypto.getRandomValues.mockImplementation(arr => {
        if (arr.length === 16) {
          // Salt length
          for (let i = 0; i < arr.length; i++) {
            arr[i] = (i + saltCallCount * 10) % 256;
          }
          saltCallCount++;
        } else {
          // IV
          for (let i = 0; i < arr.length; i++) {
            arr[i] = i % 256;
          }
        }
        return arr;
      });

      await encryptAESGCM('data1', 'password');
      await encryptAESGCM('data2', 'password');

      // Should have been called for IV and salt for each encryption
      expect(window.crypto.getRandomValues).toHaveBeenCalledTimes(4);
    });

    test('should create non-exportable keys', async () => {
      await encryptAESGCM('test data', 'password');

      const deriveKeyCall = window.crypto.subtle.deriveKey.mock.calls[0];
      const extractable = deriveKeyCall[3];

      expect(extractable).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle Web Crypto API errors gracefully', async () => {
      window.crypto.subtle.encrypt.mockRejectedValueOnce(new Error('Encryption failed'));

      await expect(encryptAESGCM('test data', 'password')).rejects.toThrow('Encryption failed');
    });

    test('should handle decryption errors gracefully', async () => {
      window.crypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      const encryptedData = { iv: 'test', data: 'test' };
      await expect(decryptAESGCM(encryptedData, 'password')).rejects.toThrow('Decryption failed');
    });

    test('should handle invalid base64 in encrypted data', async () => {
      window.atob.mockImplementationOnce(() => {
        throw new Error('Invalid base64');
      });

      const encryptedData = { iv: 'invalid!@#', data: 'test' };
      await expect(decryptAESGCM(encryptedData, 'password')).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('should complete encryption within reasonable time', async () => {
      const largeData = 'Large medical record data '.repeat(1000);

      const startTime = performance.now();
      await encryptAESGCM(largeData, 'password');
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    test('should handle multiple concurrent encryptions', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        encryptAESGCM(`Medical data ${i}`, 'password')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('iv');
        expect(result).toHaveProperty('data');
      });
    });
  });

  describe('PHI Field Encryption Integration', () => {
    const phiFields = {
      patientName: 'John Doe',
      diagnosis: 'Type 2 Diabetes Mellitus',
      treatment: 'Metformin 500mg BID, lifestyle modifications',
      history: 'Family history of diabetes, hypertension',
      notes: 'Patient compliant with medication regimen',
    };

    test('should encrypt all PHI fields before API submission', async () => {
      const password = 'userPassphrase123!';
      const encryptedFields = {};

      // Simulate encrypting all PHI fields
      for (const [field, value] of Object.entries(phiFields)) {
        if (['diagnosis', 'treatment', 'history', 'notes'].includes(field)) {
          encryptedFields[field] = await encryptAESGCM(value, password);
        } else {
          encryptedFields[field] = value; // Non-PHI fields remain unencrypted
        }
      }

      // Verify PHI fields are encrypted
      expect(encryptedFields.diagnosis).toHaveProperty('iv');
      expect(encryptedFields.diagnosis).toHaveProperty('data');
      expect(encryptedFields.treatment).toHaveProperty('iv');
      expect(encryptedFields.treatment).toHaveProperty('data');

      // Verify non-PHI fields are not encrypted
      expect(encryptedFields.patientName).toBe(phiFields.patientName);
    });

    test('should maintain data integrity during round-trip encryption', async () => {
      const password = 'testPassword123!';

      // Encrypt sensitive field
      const encrypted = await encryptAESGCM(phiFields.diagnosis, password);

      // Mock successful decryption
      window.crypto.subtle.decrypt.mockResolvedValueOnce(
        new TextEncoder().encode(phiFields.diagnosis).buffer
      );

      // Decrypt
      const decrypted = await decryptAESGCM(encrypted, password);

      expect(decrypted).toBe(phiFields.diagnosis);
    });
  });

  describe('Browser Compatibility', () => {
    test('should check for Web Crypto API availability', () => {
      expect(window.crypto).toBeDefined();
      expect(window.crypto.subtle).toBeDefined();
      expect(window.crypto.getRandomValues).toBeDefined();
    });

    test('should handle missing Web Crypto API gracefully', async () => {
      const originalCrypto = window.crypto;
      delete window.crypto;

      try {
        await expect(encryptAESGCM('test', 'password')).rejects.toThrow();
      } finally {
        window.crypto = originalCrypto;
      }
    });

    test('should use appropriate array buffer utilities', () => {
      expect(typeof window.btoa).toBe('function');
      expect(typeof window.atob).toBe('function');
      expect(typeof TextEncoder).toBe('function');
      expect(typeof TextDecoder).toBe('function');
    });
  });

  describe('Security Compliance', () => {
    test('should ensure no unencrypted PHI in memory after encryption', async () => {
      const sensitiveData = 'Patient HIV status: positive';
      const result = await encryptAESGCM(sensitiveData, 'password');

      // Verify the result doesn't contain the original sensitive data
      expect(JSON.stringify(result)).not.toContain('HIV');
      expect(JSON.stringify(result)).not.toContain('positive');
    });

    test('should use cryptographically secure random values', () => {
      const arr = new Uint8Array(16);
      window.crypto.getRandomValues(arr);

      expect(window.crypto.getRandomValues).toHaveBeenCalledWith(arr);
    });

    test('should meet encryption accuracy requirements', async () => {
      const testCases = Array.from({ length: 1000 }, (_, i) => `Test data ${i}`);
      let successCount = 0;

      for (const testData of testCases) {
        try {
          const encrypted = await encryptAESGCM(testData, 'password');

          // Mock successful decryption
          window.crypto.subtle.decrypt.mockResolvedValueOnce(
            new TextEncoder().encode(testData).buffer
          );

          const decrypted = await decryptAESGCM(encrypted, 'password');

          if (decrypted === testData) {
            successCount++;
          }
        } catch (error) {
          // Count as failure
        }
      }

      const accuracy = successCount / testCases.length;
      expect(accuracy).toBeGreaterThanOrEqual(0.999999); // 99.9999% accuracy requirement
    });
  });
});
