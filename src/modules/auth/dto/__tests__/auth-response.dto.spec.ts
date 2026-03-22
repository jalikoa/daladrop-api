import { AuthResponseDto } from '../auth-response.dto';

/**
 * Unit Tests for AuthResponseDto
 */
describe('AuthResponseDto - Unit Tests', () => {
  describe('Construction', () => {
    it('should create with all required fields', () => {
      const dto: AuthResponseDto = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
        token_type: 'Bearer',
        user: {
          id: 1,
          uuid: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
          role: 'CUSTOMER',
        },
      };

      expect(dto.access_token).toBeDefined();
      expect(dto.refresh_token).toBeDefined();
      expect(dto.token_type).toBe('Bearer');
      expect(dto.user).toBeDefined();
    });

    it('should accept different token types', () => {
      const dto: AuthResponseDto = {
        access_token: 'token',
        refresh_token: 'refresh',
        token_type: 'JWT',
        user: {
          id: 1,
          uuid: 'uuid',
          email: 'user@example.com',
          role: 'ADMIN',
        },
      };

      expect(dto.token_type).toBe('JWT');
    });

    it('should accept ADMIN user', () => {
      const dto: AuthResponseDto = {
        access_token: 'token',
        refresh_token: 'refresh',
        token_type: 'Bearer',
        user: {
          id: 1,
          uuid: 'uuid',
          email: 'admin@example.com',
          role: 'ADMIN',
        },
      };

      expect(dto.user.role).toBe('ADMIN');
    });

    it('should accept MERCHANT user', () => {
      const dto: AuthResponseDto = {
        access_token: 'token',
        refresh_token: 'refresh',
        token_type: 'Bearer',
        user: {
          id: 1,
          uuid: 'uuid',
          email: 'merchant@example.com',
          role: 'MERCHANT',
        },
      };

      expect(dto.user.role).toBe('MERCHANT');
    });
  });

  describe('User object', () => {
    it('should include user id', () => {
      const dto: AuthResponseDto = {
        access_token: 'token',
        refresh_token: 'refresh',
        token_type: 'Bearer',
        user: {
          id: 999,
          uuid: 'uuid',
          email: 'user@example.com',
          role: 'CUSTOMER',
        },
      };

      expect(dto.user.id).toBe(999);
    });

    it('should include user uuid', () => {
      const dto: AuthResponseDto = {
        access_token: 'token',
        refresh_token: 'refresh',
        token_type: 'Bearer',
        user: {
          id: 1,
          uuid: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
          role: 'CUSTOMER',
        },
      };

      expect(dto.user.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should include user email', () => {
      const dto: AuthResponseDto = {
        access_token: 'token',
        refresh_token: 'refresh',
        token_type: 'Bearer',
        user: {
          id: 1,
          uuid: 'uuid',
          email: 'test@example.com',
          role: 'CUSTOMER',
        },
      };

      expect(dto.user.email).toBe('test@example.com');
    });
  });

  describe('JSON serialization', () => {
    it('should serialize to JSON', () => {
      const dto: AuthResponseDto = {
        access_token: 'token',
        refresh_token: 'refresh',
        token_type: 'Bearer',
        user: {
          id: 1,
          uuid: 'uuid',
          email: 'user@example.com',
          role: 'CUSTOMER',
        },
      };

      const json = JSON.stringify(dto);
      expect(json).toContain('access_token');
      expect(json).toContain('refresh_token');
      expect(json).toContain('token_type');
      expect(json).toContain('user');
    });

    it('should deserialize from JSON', () => {
      const json = JSON.stringify({
        access_token: 'token',
        refresh_token: 'refresh',
        token_type: 'Bearer',
        user: {
          id: 1,
          uuid: 'uuid',
          email: 'user@example.com',
          role: 'CUSTOMER',
        },
      });

      const dto: AuthResponseDto = JSON.parse(json);
      expect(dto.access_token).toBe('token');
      expect(dto.user.email).toBe('user@example.com');
    });
  });
});
