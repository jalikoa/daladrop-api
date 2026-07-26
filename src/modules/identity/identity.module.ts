import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BcryptPasswordHasher } from '../../platform/security/password/bcrypt-password.hasher';
import { PasswordPolicy } from '../../platform/security/password/password-policy';
import { PasswordService } from '../../platform/security/password/password.service';
import { BruteForceProtector } from '../../platform/security/password/brute-force.protector';
import {
  RateLimitService,
  RedisRateLimitStore,
} from '../../platform/security/http/rate-limit.service';
import { EncryptionService } from '../../common/security/encryption.service';
import { RedisInfrastructureModule } from '../../infrastructure/redis/redis.module';
import { StorageInfrastructureModule } from '../../infrastructure/storage/storage.infrastructure.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AUTH_SOCIAL_VERIFIER,
  HUMAN_CHALLENGE_VERIFIER,
  IDENTITY_REPOSITORY,
} from './constants/auth.constants';
import { AuthConfig } from './domain/auth.config';
import { AuthTokenService } from './domain/auth-token.service';
import { AuthService } from './use-cases/auth.service';
import { ProfileService } from './use-cases/profile.service';
import { AdminUsersService } from './use-cases/admin-users.service';
import { PrismaIdentityRepository } from './repositories/prisma/prisma-identity.repository';
import { ConfigurableHumanChallengeVerifier } from './adapters/human-challenge.verifier';
import { UnconfiguredSocialTokenVerifier } from './adapters/social-token.verifier';
import { RedisAuthRateLimitClient } from './adapters/redis-auth-rate-limit.client';
import { AuthTokenGuard } from './guards/auth-token.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { AuthController } from './interfaces/auth.controller';
import {
  LegalAcceptancesController,
  UserAuthController,
} from './interfaces/user-auth.controller';
import {
  UploadsController,
  UserProfileController,
} from './interfaces/user-profile.controller';
import { AdminUsersController } from './interfaces/admin-users.controller';
import { MediaController } from './interfaces/media.controller';

@Module({
  imports: [
    JwtModule.register({}),
    AuthorizationModule,
    RedisInfrastructureModule.register({
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      maxReconnectAttempts: 3,
    }),
    StorageInfrastructureModule.register({
      // Resolve provider lazily from process.env after ConfigModule loads `.env`.
      environment: process.env,
    }),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [
    AuthController,
    UserAuthController,
    UserProfileController,
    UploadsController,
    AdminUsersController,
    MediaController,
    LegalAcceptancesController,
  ],
  providers: [
    AuthConfig,
    AuthTokenService,
    AuthService,
    ProfileService,
    AdminUsersService,
    AuthTokenGuard,
    OptionalAuthGuard,
    EncryptionService,
    RedisAuthRateLimitClient,
    {
      provide: IDENTITY_REPOSITORY,
      useClass: PrismaIdentityRepository,
    },
    {
      provide: AUTH_SOCIAL_VERIFIER,
      useClass: UnconfiguredSocialTokenVerifier,
    },
    {
      provide: HUMAN_CHALLENGE_VERIFIER,
      inject: [AuthConfig],
      useFactory: (config: AuthConfig) =>
        new ConfigurableHumanChallengeVerifier(config.humanChallengeRequired),
    },
    {
      provide: BcryptPasswordHasher,
      useFactory: () =>
        new BcryptPasswordHasher(
          Number(process.env.AUTH_PASSWORD_BCRYPT_ROUNDS ?? 12),
        ),
    },
    {
      provide: PasswordPolicy,
      useFactory: () =>
        new PasswordPolicy({
          minLength: Number(process.env.AUTH_PASSWORD_MIN_LENGTH ?? 6),
          requireUppercase:
            (process.env.AUTH_PASSWORD_REQUIRE_UPPERCASE ?? 'true') !== 'false',
          requireLowercase:
            (process.env.AUTH_PASSWORD_REQUIRE_LOWERCASE ?? 'true') !== 'false',
          requireNumber:
            (process.env.AUTH_PASSWORD_REQUIRE_NUMBER ?? 'true') !== 'false',
          requireSymbol:
            (process.env.AUTH_PASSWORD_REQUIRE_SYMBOL ?? 'true') !== 'false',
        }),
    },
    {
      provide: PasswordService,
      inject: [BcryptPasswordHasher, PasswordPolicy],
      useFactory: (hasher: BcryptPasswordHasher, policy: PasswordPolicy) =>
        new PasswordService(hasher, policy),
    },
    {
      provide: BruteForceProtector,
      useFactory: () =>
        new BruteForceProtector({
          maxFailures: Number(process.env.AUTH_LOCKOUT_FAILURES ?? 5),
          windowMs: Number(process.env.AUTH_LOCKOUT_WINDOW_MS ?? 900_000),
          lockoutMs: Number(process.env.AUTH_LOCKOUT_MS ?? 900_000),
        }),
    },
    {
      provide: RateLimitService,
      inject: [RedisAuthRateLimitClient],
      useFactory: (client: RedisAuthRateLimitClient) =>
        new RateLimitService(new RedisRateLimitStore(client)),
    },
  ],
  exports: [
    AuthService,
    AuthTokenService,
    AuthTokenGuard,
    OptionalAuthGuard,
    IDENTITY_REPOSITORY,
    ProfileService,
    AdminUsersService,
  ],
})
export class IdentityModule {}
