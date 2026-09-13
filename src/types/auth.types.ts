import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  adOid: string;
  name: string;
  email: string;
  role: Role;
}

export interface DecodedAdToken {
  oid?: string;
  sub?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  roles?: string[];
  tid?: string;
  iss?: string;
  aud?: string;
}

export interface SyncUserDto {
  name?: string;
  email?: string;
}

export interface UpdateRoleDto {
  role: Role;
}
