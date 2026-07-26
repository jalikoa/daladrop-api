import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { OperationsModule } from '../operations/operations.module';
import { AgeVerificationController } from './interfaces/age-verification.controller';
import { AdminAgeVerificationController } from './interfaces/admin-age-verification.controller';
import { AgeVerificationService } from './use-cases/age-verification.service';

@Module({
  imports: [IdentityModule, AuthorizationModule, OperationsModule],
  controllers: [AgeVerificationController, AdminAgeVerificationController],
  providers: [AgeVerificationService],
  exports: [AgeVerificationService],
})
export class ComplianceModule {}
