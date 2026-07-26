import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION = 'daladrop:required-permission';

export interface RequiredPermission {
  readonly action: string;
  readonly resource: string;
}

export const RequirePermission = (action: string, resource: string) =>
  SetMetadata(REQUIRED_PERMISSION, {
    action,
    resource,
  } satisfies RequiredPermission);
