import type { ReactNode } from 'react';
import type { Role } from '../api/types';
import { useAuth } from './useAuth';

interface RequireRoleProps {
  allowedRoles: Role[];
  children: ReactNode;
}

function ProfileRecovery({ retryProfile }: Pick<ReturnType<typeof useAuth>, 'retryProfile'>) {
  return (
    <section role="alert" aria-labelledby="profile-error-title">
      <h1 id="profile-error-title">We could not load your campus profile</h1>
      <p>Please retry before accessing this area.</p>
      <button type="button" onClick={() => void retryProfile()}>Retry profile</button>
    </section>
  );
}

export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const { profile, retryProfile, signIn, status } = useAuth();

  if (status === 'loading') {
    return <p role="status">Checking your campus profile…</p>;
  }

  if (status === 'error') {
    return <ProfileRecovery retryProfile={retryProfile} />;
  }

  if (status === 'anonymous') {
    return (
      <section aria-labelledby="sign-in-required-title">
        <h1 id="sign-in-required-title">Sign in required</h1>
        <p>Please sign in with your university Microsoft account to continue.</p>
        <button type="button" onClick={() => void signIn()}>Sign in with Microsoft</button>
      </section>
    );
  }

  if (status === 'authenticated' && profile && !allowedRoles.includes(profile.role)) {
    return (
      <section aria-labelledby="permission-required-title">
        <h1 id="permission-required-title">You do not have permission to view this page</h1>
        <p>Your campus role does not allow access to this area.</p>
      </section>
    );
  }

  if (status === 'authenticated' && profile) {
    return <>{children}</>;
  }

  return <ProfileRecovery retryProfile={retryProfile} />;
}
