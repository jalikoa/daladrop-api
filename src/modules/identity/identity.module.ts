import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    RedisInfrastructureModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: process.env.REDIS_URL,
        host: config.get<string>('redis.host') ?? '127.0.0.1',
        port: config.get<number>('redis.port') ?? 6379,
        password: config.get<string>('redis.password') || undefined,
        maxReconnectAttempts: 3,
      }),
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
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new BcryptPasswordHasher(
          config.get<number>('auth.password.bcryptRounds') ?? 12,
        ),
    },
    {
      provide: PasswordPolicy,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new PasswordPolicy({
          minLength: config.get<number>('auth.password.minLength') ?? 6,
          requireUppercase:
            config.get<boolean>('auth.password.requireUppercase') ?? true,
          requireLowercase:
            config.get<boolean>('auth.password.requireLowercase') ?? true,
          requireNumber:
            config.get<boolean>('auth.password.requireNumber') ?? true,
          requireSymbol:
            config.get<boolean>('auth.password.requireSymbol') ?? true,
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
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new BruteForceProtector({
          maxFailures: config.get<number>('auth.lockout.maxFailures') ?? 5,
          windowMs: config.get<number>('auth.lockout.windowMs') ?? 900_000,
          lockoutMs: config.get<number>('auth.lockout.lockoutMs') ?? 900_000,
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
