import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, ShieldCheck } from 'lucide-react';
import {
  CONSENT_PURPOSE_LABELS,
  PRIVACY_SUMMARY,
  type ConsentPurpose,
  type SessionUser,
} from '@makaan/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { queryKeys, useConsents } from '@/hooks/use-api';

const PURPOSES: ConsentPurpose[] = ['service', 'evidence_retention', 'ai_processing'];

export function Settings({ user }: { user: SessionUser }) {
  const consents = useConsents();
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: ({ purpose, granted }: { purpose: ConsentPurpose; granted: boolean }) =>
      api.updateConsent(purpose, granted),
    onSuccess: async () => {
      toast.success('Consent updated');
      await queryClient.invalidateQueries({ queryKey: queryKeys.consents });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not update consent'),
  });

  const consentMap = new Map(
    (consents.data?.consents ?? []).map((record) => [record.purpose, record]),
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Account</p>
        <h1 className="mt-2 text-3xl text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control what Makaan stores, and export everything you own.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
            <p className="mt-1 text-sm font-medium">{user.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
            <p className="mt-1 text-sm font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
            <Badge variant="muted" className="mt-1 capitalize">
              {user.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consent</CardTitle>
          <CardDescription>{PRIVACY_SUMMARY}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {consents.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            PURPOSES.map((purpose) => {
              const record = consentMap.get(purpose);
              return (
                <label key={purpose} className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={record?.granted ?? false}
                    disabled={update.isPending}
                    onCheckedChange={(checked) =>
                      update.mutate({ purpose, granted: checked === true })
                    }
                    aria-label={CONSENT_PURPOSE_LABELS[purpose]}
                  />
                  <span className="text-sm text-muted-foreground">
                    {CONSENT_PURPOSE_LABELS[purpose]}
                  </span>
                </label>
              );
            })
          )}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Withdrawing consent for evidence retention or AI processing may limit what the audit can
            produce.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your data</CardTitle>
          <CardDescription>
            Export a JSON copy of your account, tenancies and consents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              window.open(api.exportUrl(), '_blank', 'noopener');
              toast.success('Export started. Check your downloads.');
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Export my data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
