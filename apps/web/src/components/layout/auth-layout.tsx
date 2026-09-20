import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/logo';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden flex-col justify-between border-r border-border bg-ink p-10 text-background lg:flex">
        <Link to="/" aria-label="Makaan home">
          <span className="inline-flex items-center gap-2.5 text-background">
            <Logo className="[&_span:last-child]:text-background" />
          </span>
        </Link>
        <div>
          <h2 className="max-w-sm text-3xl leading-tight text-background">
            The record both sides can trust, from move-in to refund.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-background/70">
            Timestamped evidence, an advisory assessment, and one itemized statement. Advisory only,
            no money movement, no tenant blacklist.
          </p>
        </div>
        <p className="text-xs text-background/50">
          Makaan is not a court, an arbitrator, or the Rent Authority.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <Logo />
          </div>
          <h1 className="mt-6 text-3xl text-foreground lg:mt-0">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
        </div>
      </main>
    </div>
  );
}
