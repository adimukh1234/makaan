import { cn } from '@/lib/utils';

/**
 * Makaan mark: a roofline that doubles as a seal. The wordmark is set in the
 * display serif. The mark uses currentColor so it adapts to light and dark
 * surfaces.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Makaan"
      className={cn('h-8 w-8', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 14.5 16 4.5l12 10"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 15.5V25a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-9.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m12.5 21.5 2.6 2.6 5-5.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="text-primary">
        <LogoMark />
      </span>
      {showWordmark ? (
        <span className="font-display text-xl font-semibold tracking-tight text-foreground">
          Makaan
        </span>
      ) : null}
    </span>
  );
}
