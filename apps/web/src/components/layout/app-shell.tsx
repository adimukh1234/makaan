import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Building2, LayoutDashboard, LogOut, Settings, ShieldCheck } from 'lucide-react';
import type { SessionUser } from '@makaan/core';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLogout } from '@/hooks/use-api';

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/properties', label: 'Properties', icon: Building2, end: false },
  { to: '/app/settings', label: 'Settings', icon: Settings, end: false },
];

export function AppShell({ user }: { user: SessionUser }) {
  const logout = useLogout();
  const location = useLocation();

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <NavLink to="/app" aria-label="Makaan home">
              <Logo />
            </NavLink>
            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold leading-tight">{user.name}</div>
              <div className="text-xs capitalize text-muted-foreground">{user.role}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        <nav aria-label="Primary mobile" className="border-t border-border md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main id="main" key={location.pathname} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-muted-foreground sm:px-6">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Makaan is not a court, an arbitrator, or the Rent Authority. Assessments are advisory.
          Money never moves through Makaan.
        </p>
      </footer>
    </div>
  );
}
