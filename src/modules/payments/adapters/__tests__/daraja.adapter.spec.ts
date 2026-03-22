import { ConfigService } from '@nestjs/config';
import { DarajaAdapter } from '../daraja.adapter';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

/**
 * Unit Tests for DarajaAdapter
 */
describe('DarajaAdapter - Unit Tests', () => {
  let adapter: DarajaAdapter;
  let mockConfigService: Partial<ConfigService>;
  let mockAxiosGet: jest.Mock;
  let mockAxiosPost: jest.Mock;

  beforeEach(() => {
    mockAxiosGet = jest.fn();
    mockAxiosPost = jest.fn();
    
    jest.spyOn(axios, 'create').mockReturnValue({
      get: mockAxiosGet,
      post: mockAxiosPost,
    } as any);

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'DARAJA_CONSUMER_KEY') return 'test-key';
        if (key === 'DARAJA_CONSUMER_SECRET') return 'test-secret';
        if (key === 'DARAJA_PAYBILL') return '123456';
        if (key === 'DARAJA_PASSKEY') return 'test-passkey';
        if (key === 'PUBLIC_URL') return 'https://test.example.com';
        return undefined;
      }),
    };

    adapter = new DarajaAdapter(mockConfigService as ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Construction', () => {
    it('should create adapter instance', () => {
      expect(adapter).toBeDefined();
    });

    it('should configure axios with correct settings', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: expect.any(String),
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should use sandbox URL in test environment', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.stringContaining('sandbox'),
        }),
      );
    });

    it('should use production URL in production environment', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'DARAJA_CONSUMER_KEY') return 'prod-key';
        if (key === 'DARAJA_CONSUMER_SECRET') return 'prod-secret';
        return undefined;
      });

      const prodAdapter = new DarajaAdapter(mockConfigService as ConfigService);
      expect(prodAdapter).toBeDefined();
    });
  });

  describe('getAccessToken()', () => {
    it('should return cached token if not expired', async () => {
      // First call to get and cache token
      mockAxiosGet.mockResolvedValueOnce({
        data: { access_token: 'cached-token', expires_in: 3600 },
      });
      await adapter.getAccessToken();

      // Second call should use cached token
      const token = await adapter.getAccessToken();
      expect(token).toBe('cached-token');
      expect(mockAxiosGet).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should fetch new token when not cached', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { access_token: 'new-token', expires_in: 3600 },
      });

      const token = await adapter.getAccessToken();

      expect(token).toBe('new-token');
      expect(mockAxiosGet).toHaveBeenCalledWith(
        '/oauth/v1/generate?grant_type=client_credentials',
        expect.objectContaining({
          headers: { Authorization: expect.any(String) },
        }),
      );
    });

    it('should fetch new token when cached token is expired', async () => {
      // Set expired token
      (adapter as any).accessToken = 'expired-token';
      (adapter as any).tokenExpiry = Date.now() - 1000; // Expired 1 second ago

      mockAxiosGet.mockResolvedValueOnce({
        data: { access_token: 'refreshed-token', expires_in: 3600 },
      });

      const token = await adapter.getAccessToken();

      expect(token).toBe('refreshed-token');
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    });

    it('should throw when credentials not configured', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'DARAJA_CONSUMER_KEY') return undefined;
        if (key === 'DARAJA_CONSUMER_SECRET') return undefined;
        return undefined;
      });

      const newAdapter = new DarajaAdapter(mockConfigService as ConfigService);

      await expect(newAdapter.getAccessToken()).rejects.toThrow();
    });

    it('should throw BadRequestException on API failure', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.getAccessToken()).rejects.toThrow(BadRequestException);
      await expect(adapter.getAccessToken()).rejects.toThrow('authenticate with Daraja');
    });

    it('should handle API error response', async () => {
      mockAxiosGet.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { error: 'Invalid credentials' },
        },
      });

      await expect(adapter.getAccessToken()).rejects.toThrow(BadRequestException);
    });

    it('should create correct Basic auth header', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { access_token: 'token', expires_in: 3600 },
      });

      await adapter.getAccessToken();

      const expectedAuth = Buffer.from('test-key:test-secret').toString('base64');
      expect(mockAxiosGet).toHaveBeenCalledWith(
        '/oauth/v1/generate?grant_type=client_credentials',
        expect.objectContaining({
          headers: { Authorization: `Basic ${expectedAuth}` },
        }),
      );
    });

    it('should set token expiry with buffer', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { access_token: 'token', expires_in: 3600 },
      });

      await adapter.getAccessToken();

      // Token should expire in less than 3600 seconds (60 second buffer)
      expect((adapter as any).tokenExpiry).toBeLessThan(Date.now() + 3600000);
    });
  });

  describe('stkPush()', () => {
    const validRequest = {
      phone: '254712345678',
      amount: 500,
      accountReference: 'TEST123',
      transactionDesc: 'Test payment',
      callbackUrl: 'https://test.example.com/webhooks/daraja/stk',
    };

    beforeEach(() => {
      // Mock successful token retrieval
      mockAxiosGet.mockResolvedValueOnce({
        data: { access_token: 'test-token', expires_in: 3600 },
      });
    });

    it('should initiate STK push successfully', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        data: {
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CheckoutRequestID: 'ws_CO_123456789',
          MerchantRequestID: 'req_123',
        },
      });

      const result = await adapter.stkPush(validRequest);

      expect(result).toHaveProperty('responseCode');
      expect(result).toHaveProperty('checkoutRequestID');
      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('should throw when paybill not configured', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'DARAJA_PAYBILL') return undefined;
        if (key === 'DARAJA_PASSKEY') return 'passkey';
        return undefined;
      });

      const newAdapter = new DarajaAdapter(mockConfigService as ConfigService);
      // Mock token
      mockAxiosGet.mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } });

      await expect(newAdapter.stkPush(validRequest)).rejects.toThrow();
    });

    it('should throw when passkey not configured', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'DARAJA_PAYBILL') return '123456';
        if (key === 'DARAJA_PASSKEY') return undefined;
        return undefined;
      });

      const newAdapter = new DarajaAdapter(mockConfigService as ConfigService);
      mockAxiosGet.mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } });

      await expect(newAdapter.stkPush(validRequest)).rejects.toThrow();
    });

    it('should generate correct password', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { access_token: 'token', expires_in: 3600 },
      });
      mockAxiosPost.mockResolvedValueOnce({
        data: { ResponseCode: '0', ResponseDescription: 'Success' },
      });

      await adapter.stkPush(validRequest);

      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('should include correct callback URL', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { access_token: 'token', expires_in: 3600 },
      });
      mockAxiosPost.mockResolvedValueOnce({
        data: { ResponseCode: '0', ResponseDescription: 'Success' },
      });

      await adapter.stkPush(validRequest);

      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('should handle STK push API error', async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error('STK push failed'));

      await expect(adapter.stkPush(validRequest)).rejects.toThrow(BadRequestException);
    });

    it('should handle API error response', async () => {
      mockAxiosPost.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { errorMessage: 'Invalid phone number' },
        },
      });

      await expect(adapter.stkPush(validRequest)).rejects.toThrow(BadRequestException);
    });

    it('should return correct response structure', async () => {
      mockAxiosPost.mockResolvedValueOnce({
        data: {
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CheckoutRequestID: 'ws_CO_123',
          MerchantRequestID: 'req_123',
        },
      });

      const result = await adapter.stkPush(validRequest);

      expect(result.responseCode).toBe('0');
      expect(result.responseDescription).toBe('Success');
      expect(result.checkoutRequestID).toBe('ws_CO_123');
      expect(result.merchantRequestID).toBe('req_123');
    });

    it('should use default callback URL from constants', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { access_token: 'token', expires_in: 3600 },
      });
      mockAxiosPost.mockResolvedValueOnce({
        data: {
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CheckoutRequestID: 'ws_CO_123',
          MerchantRequestID: 'req_123',
        },
      });

      await adapter.stkPush(validRequest);

      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('should handle successful STK push', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { access_token: 'token', expires_in: 3600 },
      });
      mockAxiosPost.mockResolvedValueOnce({
        data: {
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CheckoutRequestID: 'ws_CO_123',
        },
      });

      const result = await adapter.stkPush(validRequest);

      expect(result).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle network timeouts', async () => {
      const errorAdapter = new DarajaAdapter(mockConfigService as ConfigService);
      jest.spyOn(axios, 'create').mockReturnValueOnce({
        get: jest.fn().mockRejectedValue({ code: 'ETIMEDOUT' }),
        post: jest.fn(),
      } as any);

      await expect(errorAdapter.getAccessToken()).rejects.toThrow();
    });

    it('should handle connection refused', async () => {
      const errorAdapter = new DarajaAdapter(mockConfigService as ConfigService);
      jest.spyOn(axios, 'create').mockReturnValueOnce({
        get: jest.fn().mockRejectedValue({ code: 'ECONNREFUSED' }),
        post: jest.fn(),
      } as any);

      await expect(errorAdapter.getAccessToken()).rejects.toThrow();
    });

    it('should handle DNS errors', async () => {
      const errorAdapter = new DarajaAdapter(mockConfigService as ConfigService);
      jest.spyOn(axios, 'create').mockReturnValueOnce({
        get: jest.fn().mockRejectedValue({ code: 'ENOTFOUND' }),
        post: jest.fn(),
      } as any);

      await expect(errorAdapter.getAccessToken()).rejects.toThrow();
    });
  });
});
