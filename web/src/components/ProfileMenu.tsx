import { useAuth } from '../auth/useAuth';

export function ProfileMenu() {
  const { profile, retryProfile, signIn, signOut, status } = useAuth();

  if (status === 'loading') {
    return <span aria-live="polite">Checking your campus profile…</span>;
  }

  if (status === 'authenticated' && profile) {
    return (
      <div className="profile-menu">
        <span>{profile.name}</span>
        <span className="role-badge">{profile.role}</span>
        <button type="button" onClick={() => void signOut()}>Sign out</button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="profile-menu-error" role="alert">
        <span>We could not load your campus profile.</span>
        <button type="button" onClick={() => void retryProfile()}>Retry profile</button>
      </div>
    );
  }

  return <button type="button" onClick={() => void signIn()}>Sign in with Microsoft</button>;
}
