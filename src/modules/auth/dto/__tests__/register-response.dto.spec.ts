import { RegisterResponseDto } from '../register-response.dto';

/**
 * Unit Tests for RegisterResponseDto
 */
describe('RegisterResponseDto - Unit Tests', () => {
  describe('Construction', () => {
    it('should create with all required fields', () => {
      const dto: RegisterResponseDto = {
        id: 1,
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(dto.id).toBe(1);
      expect(dto.uuid).toBeDefined();
      expect(dto.email).toBe('user@example.com');
      expect(dto.role).toBe('CUSTOMER');
    });

    it('should accept ADMIN role', () => {
      const dto: RegisterResponseDto = {
        id: 1,
        uuid: 'uuid',
        email: 'admin@example.com',
        role: 'ADMIN',
        status: 'ACTIVE',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(dto.role).toBe('ADMIN');
    });

    it('should accept MERCHANT role', () => {
      const dto: RegisterResponseDto = {
        id: 1,
        uuid: 'uuid',
        email: 'merchant@example.com',
        role: 'MERCHANT',
        status: 'ACTIVE',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(dto.role).toBe('MERCHANT');
    });

    it('should accept PENDING status', () => {
      const dto: RegisterResponseDto = {
        id: 1,
        uuid: 'uuid',
        email: 'user@example.com',
        role: 'MERCHANT',
        status: 'PENDING',
        is_active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(dto.status).toBe('PENDING');
      expect(dto.is_active).toBe(false);
    });

    it('should accept SUSPENDED status', () => {
      const dto: RegisterResponseDto = {
        id: 1,
        uuid: 'uuid',
        email: 'user@example.com',
        role: 'CUSTOMER',
        status: 'SUSPENDED',
        is_active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(dto.status).toBe('SUSPENDED');
    });
  });

  describe('Date fields', () => {
    it('should accept Date objects for created_at', () => {
      const now = new Date();
      const dto: RegisterResponseDto = {
        id: 1,
        uuid: 'uuid',
        email: 'user@example.com',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        is_active: true,
        created_at: now,
        updated_at: new Date(),
      };

      expect(dto.created_at).toBeInstanceOf(Date);
    });

    it('should accept Date objects for updated_at', () => {
      const now = new Date();
      const dto: RegisterResponseDto = {
        id: 1,
        uuid: 'uuid',
        email: 'user@example.com',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        is_active: true,
        created_at: new Date(),
        updated_at: now,
      };

      expect(dto.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('JSON serialization', () => {
    it('should serialize to JSON', () => {
      const dto: RegisterResponseDto = {
        id: 1,
        uuid: 'uuid',
        email: 'user@example.com',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const json = JSON.stringify(dto);
      expect(json).toContain('id');
      expect(json).toContain('email');
      expect(json).toContain('role');
    });

    it('should deserialize from JSON', () => {
      const json = JSON.stringify({
        id: 1,
        uuid: 'uuid',
        email: 'user@example.com',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        is_active: true,
      });

      const dto: RegisterResponseDto = JSON.parse(json);
      expect(dto.id).toBe(1);
      expect(dto.email).toBe('user@example.com');
    });
  });

  describe('Edge cases', () => {
    it('should handle large user ID', () => {
      const dto: RegisterResponseDto = {
        id: Number.MAX_SAFE_INTEGER,
        uuid: 'uuid',
        email: 'user@example.com',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(dto.id).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle email with special characters', () => {
      const dto: RegisterResponseDto = {
        id: 1,
        uuid: 'uuid',
        email: 'user+tag@example.co.uk',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(dto.email).toBe('user+tag@example.co.uk');
    });
  });
});
