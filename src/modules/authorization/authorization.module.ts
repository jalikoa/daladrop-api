import { Module } from '@nestjs/common';
import {
  AbacEngine,
  PermissionEvaluator,
  RbacEngine,
} from '../../platform/security/authorization';
import { AuthorizationService } from './use-cases/authorization.service';
import { AuthorizationGuard } from './guards/authorization.guard';

@Module({
  providers: [
    RbacEngine,
    AbacEngine,
    PermissionEvaluator,
    AuthorizationService,
    AuthorizationGuard,
  ],
  exports: [AuthorizationService, AuthorizationGuard],
})
export class AuthorizationModule {}
