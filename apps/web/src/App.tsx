import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { SessionUser } from '@makaan/core';
import { useSession } from './hooks/use-api';
import { AppShell } from './components/layout/app-shell';
import { Landing } from './routes/landing';
import { Login } from './routes/login';
import { Register } from './routes/register';
import { Dashboard } from './routes/dashboard';
import { Properties } from './routes/properties';
import { TenancyDetail } from './routes/tenancy';
import { Settings } from './routes/settings';
import { NotFound } from './routes/not-found';
import { Logo } from './components/brand/logo';

function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Logo showWordmark={false} className="animate-pulse" />
    </div>
  );
}

function Protected({
  user,
  loading,
  children,
}: {
  user: SessionUser | null;
  loading: boolean;
  children: ReactNode;
}) {
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function App() {
  const session = useSession();
  const user = session.data?.user ?? null;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/app" replace /> : <Register />} />
      <Route
        path="/app"
        element={
          <Protected user={user} loading={session.isLoading}>
            <AppShell user={user as SessionUser} />
          </Protected>
        }
      >
        <Route index element={<Dashboard user={user as SessionUser} />} />
        <Route path="properties" element={<Properties user={user as SessionUser} />} />
        <Route path="tenancies/:id" element={<TenancyDetail user={user as SessionUser} />} />
        <Route path="settings" element={<Settings user={user as SessionUser} />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
