import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'tumbu_roles';
/** Empty = any authenticated user. PLATFORM_ADMIN = platform admin only. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
