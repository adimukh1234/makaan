import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Building2, CalendarClock, FileText, Plus, Users } from 'lucide-react';
import type { SessionUser, Tenancy, TenancyStatus } from '@makaan/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDate, formatPaise, titleCase } from '@/lib/format';
import { queryKeys, useProperties, useTenancies } from '@/hooks/use-api';

function StatusBadge({ status }: { status: TenancyStatus }) {
  const map: Record<
    TenancyStatus,
    { variant: 'sage' | 'muted' | 'destructive' | 'outline'; label: string }
  > = {
    active: { variant: 'sage', label: 'Active' },
    invited: { variant: 'outline', label: 'Invited' },
    ended: { variant: 'muted', label: 'Ended' },
    cancelled: { variant: 'destructive', label: 'Cancelled' },
  };
  const entry = map[status];
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl text-foreground">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

function TenancyRow({ tenancy, userId }: { tenancy: Tenancy; userId: string }) {
  const role = tenancy.landlordId === userId ? 'Landlord' : 'Tenant';
  return (
    <li className="flex flex-col gap-3 border-b border-border py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/app/tenancies/${tenancy.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {tenancy.tenantEmail}
          </Link>
          <StatusBadge status={tenancy.status} />
          <Badge variant="muted">{role}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Deposit {formatPaise(tenancy.depositPaise)} · {formatDate(tenancy.startDate)} to{' '}
          {formatDate(tenancy.endDate)}
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link to={`/app/tenancies/${tenancy.id}`}>
          Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}

export function Dashboard({ user }: { user: SessionUser }) {
  const tenancies = useTenancies();
  const properties = useProperties();
  const queryClient = useQueryClient();

  const accept = useMutation({
    mutationFn: (id: string) => api.acceptTenancy(id),
    onSuccess: async () => {
      toast.success('Invitation accepted. You can start capturing the condition.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenancies });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not accept'),
  });

  const list = tenancies.data?.tenancies ?? [];
  const invites = list.filter((t) => t.status === 'invited' && t.tenantEmail === user.email);
  const active = list.filter((t) => t.status === 'active');

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{titleCase(user.role)} dashboard</p>
          <h1 className="mt-2 text-3xl text-foreground">Hello, {user.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.role === 'landlord'
              ? 'Manage properties, invite tenants, and settle deposits with a clear record.'
              : 'Capture your home condition and keep your deposit protected.'}
          </p>
        </div>
        {user.role === 'landlord' ? (
          <Button asChild>
            <Link to="/app/properties">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add a property
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={user.role === 'landlord' ? 'Properties' : 'Active tenancies'}
          value={String(
            user.role === 'landlord' ? (properties.data?.properties.length ?? 0) : active.length,
          )}
          icon={Building2}
        />
        <Stat label="Open tenancies" value={String(active.length)} icon={Users} />
        <Stat label="Pending invites" value={String(invites.length)} icon={CalendarClock} />
      </div>

      {invites.length > 0 ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Invitations waiting for you</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Deposit {formatPaise(invite.depositPaise)} · starts {formatDate(invite.startDate)}
                </p>
                <Button
                  size="sm"
                  onClick={() => accept.mutate(invite.id)}
                  disabled={accept.isPending}
                >
                  Accept
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Your tenancies</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          {tenancies.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {user.role === 'landlord'
                  ? 'Add a property, then invite a tenant to create the first tenancy.'
                  : 'No tenancies yet. Ask your landlord to invite this email address.'}
              </p>
            </div>
          ) : (
            <ul>
              {list.map((tenancy) => (
                <TenancyRow key={tenancy.id} tenancy={tenancy} userId={user.id} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
