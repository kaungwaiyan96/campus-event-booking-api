import type { ReactNode } from 'react';
import type { Role } from '../api/types';
import { useAuth } from './useAuth';

interface RequireRoleProps {
  allowedRoles: Role[];
  children: ReactNode;
}

export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const { profile, signIn, status } = useAuth();

  if (status === 'anonymous') {
    return (
      <section aria-labelledby="sign-in-required-title">
        <h1 id="sign-in-required-title">Sign in required</h1>
        <p>Please sign in with your university Microsoft account to continue.</p>
        <button type="button" onClick={() => void signIn()}>Sign in with Microsoft</button>
      </section>
    );
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    return (
      <section aria-labelledby="permission-required-title">
        <h1 id="permission-required-title">You do not have permission to view this page</h1>
        <p>Your campus role does not allow access to this area.</p>
      </section>
    );
  }

  return <>{children}</>;
}
