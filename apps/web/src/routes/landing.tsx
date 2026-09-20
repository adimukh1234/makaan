import { Link } from 'react-router-dom';
import { ArrowRight, Camera, ScanLine, Scale, ShieldCheck, Wallet } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

const LOOP = [
  {
    icon: Camera,
    title: 'Capture',
    body: 'Photograph each area at move-in and move-out. Every photo gets a timestamp and a SHA-256 hash, so the record cannot be quietly edited.',
  },
  {
    icon: ScanLine,
    title: 'Assess',
    body: 'The audit separates normal wear and tear, which is never deductible, from genuine damage, which is priced against a city benchmark range.',
  },
  {
    icon: Wallet,
    title: 'Settle',
    body: 'Both sides get the same itemized statement: deposit held, claim, approved deduction, refund owed. Accept it or dispute it, with the evidence attached.',
  },
];

const FACTS = [
  { value: 'Rs 1,26,042 cr', label: 'locked in security deposits across six metros' },
  { value: '35%', label: 'of Bengaluru tenants get the full deposit back' },
  { value: '6 to 10', label: 'months of rent demanded as deposit in Bengaluru' },
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="animate-fade-up">
            <p className="eyebrow">Rental deposit trust for India</p>
            <h1 className="mt-4 text-4xl leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
              Your home.
              <br />
              Your proof.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Indian renters hand over months of rent as a deposit, often with no record of what the
              flat looked like on day one. Makaan fixes the missing part: evidence both sides can
              trust, a fair assessment, and one clear number at the end.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/register">
                  Start a condition record <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">I already have an account</Link>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Advisory only. Makaan never holds your deposit and never decides who is right.
            </p>
          </div>

          <div className="animate-fade-up rounded-[calc(var(--radius)+6px)] border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Deposit statement</span>
              <span className="rounded-full bg-sage/15 px-2.5 py-0.5 text-xs font-semibold text-sage">
                Advisory
              </span>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Deposit held</span>
                <span className="mono font-semibold">Rs 1,00,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Owner claim</span>
                <span className="mono font-semibold text-destructive">Rs 25,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Approved deduction</span>
                <span className="mono font-semibold">Rs 1,250</span>
              </div>
              <div className="my-4 h-px bg-border" />
              <div className="flex items-center justify-between text-base">
                <span className="font-medium">Refund owed</span>
                <span className="mono text-lg font-semibold text-sage">Rs 98,750</span>
              </div>
            </div>
            <ul className="mt-6 space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Full repainting claimed at Rs 25,000 collapsed to Rs 0, normal wear and tear.
              </li>
              <li className="flex gap-2">
                <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Broken exhaust fan priced at the Bengaluru benchmark, flagged for review.
              </li>
            </ul>
          </div>
        </section>

        <section aria-label="The problem" className="border-y border-border bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
            {FACTS.map((fact) => (
              <div key={fact.value}>
                <div className="font-display text-3xl text-foreground">{fact.value}</div>
                <p className="mt-2 text-sm text-muted-foreground">{fact.label}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">
            Source: NoBroker Rent Report 2026, reported by Economic Times, Business Standard and
            Hindustan Times.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 max-w-2xl text-3xl text-foreground sm:text-4xl">
            One loop, at the two moments that hurt.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {LOOP.map((step, index) => (
              <article key={step.title} className="surface p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="mono text-xs text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-xl text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2">
            <div>
              <p className="eyebrow">What Makaan is not</p>
              <h2 className="mt-3 text-2xl text-foreground">No blacklist. No money. No verdict.</h2>
            </div>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Not a tenant score.</strong> Records are owned
                by the tenant, positive-primary and consent based. We do not build searchable tenant
                histories.
              </li>
              <li>
                <strong className="text-foreground">Not a payment app.</strong> Makaan records and
                assesses. The refund happens between the two parties, on their own rails.
              </li>
              <li>
                <strong className="text-foreground">Not a judge.</strong> Every statement is an
                advisory opinion and every finding can be challenged.
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>Proof for every deposit. Built for India's long-term rentals.</p>
        </div>
      </footer>
    </div>
  );
}
