import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileWarning,
  Loader2,
  Printer,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  ADVISORY_BANNER,
  ADVISORY_DISCLAIMER,
  NOT_AUTHORITY_FOOTER,
  parseRupeesToPaise,
  statutoryNoteForState,
  type AuditFinding,
  type Classification,
  type Dispute,
  type InspectionStage,
  type SessionUser,
  type TenancyAggregate,
} from '@makaan/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import {
  classificationLabel,
  formatDate,
  formatDateTime,
  formatPaise,
  shortHash,
} from '@/lib/format';
import { queryKeys, useTenancy } from '@/hooks/use-api';

const STAGES: { stage: InspectionStage; title: string; hint: string }[] = [
  { stage: 'move_in', title: 'Move-in baseline', hint: 'Taken on or before the handover day.' },
  {
    stage: 'move_out',
    title: 'Move-out inspection',
    hint: 'Taken at handover, before the deposit is settled.',
  },
];

function ClassificationBadge({ classification }: { classification: Classification }) {
  switch (classification) {
    case 'WEAR_AND_TEAR':
      return <Badge variant="sage">{classificationLabel(classification)}</Badge>;
    case 'DAMAGE':
      return <Badge variant="destructive">{classificationLabel(classification)}</Badge>;
    case 'PRE_EXISTING':
      return <Badge variant="muted">{classificationLabel(classification)}</Badge>;
    default:
      return <Badge variant="outline">{classificationLabel(classification)}</Badge>;
  }
}

function FindingCard({ finding, onChallenge }: { finding: AuditFinding; onChallenge: () => void }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{finding.area}</span>
        <ClassificationBadge classification={finding.classification} />
        {finding.reviewRequired ? <Badge variant="outline">Needs review</Badge> : null}
        <span className="text-xs text-muted-foreground">
          confidence {(finding.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{finding.rationale}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          <span className="mono">
            Benchmark {formatPaise(finding.benchmarkLowPaise)} to{' '}
            {formatPaise(finding.benchmarkHighPaise)}
          </span>
          <span className="mx-2">·</span>
          <span className="mono">engine {finding.engine}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Deduction
            </div>
            <div className="mono text-base font-semibold">
              {formatPaise(finding.recommendedDeductionPaise)}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onChallenge}>
            Challenge
          </Button>
        </div>
      </div>
      {finding.statutoryNote ? (
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          {finding.statutoryNote}
        </p>
      ) : null}
    </div>
  );
}

function TotalsRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className={strong ? 'font-medium text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
      <span className={`mono ${strong ? 'text-lg font-semibold text-foreground' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}

function CaptureColumn({
  aggregate,
  stage,
  title,
  hint,
  areaValue,
  onAreaChange,
  onAddArea,
  isAdding,
  onUpload,
  uploadingId,
}: {
  aggregate: TenancyAggregate;
  stage: InspectionStage;
  title: string;
  hint: string;
  areaValue: string;
  onAreaChange: (value: string) => void;
  onAddArea: () => void;
  isAdding: boolean;
  onUpload: (inspectionId: string, file: File) => void;
  uploadingId: string | null;
}) {
  const inspections = aggregate.inspections.filter((inspection) => inspection.stage === stage);
  const evidence = aggregate.evidence;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Label htmlFor={`area-${stage}`} className="sr-only">
            Area name
          </Label>
          <Input
            id={`area-${stage}`}
            placeholder="e.g. Living room walls and skirting"
            value={areaValue}
            onChange={(event) => onAreaChange(event.target.value)}
          />
          <Button onClick={onAddArea} disabled={isAdding || areaValue.trim().length < 2}>
            <Camera className="h-4 w-4" aria-hidden="true" /> Add area
          </Button>
        </div>

        {inspections.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No areas captured yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {inspections.map((inspection) => {
              const photos = evidence.filter((asset) => asset.inspectionId === inspection.id);
              return (
                <li key={inspection.id} className="rounded-md border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{inspection.area}</span>
                    <span className="text-xs text-muted-foreground">
                      {photos.length} photo{photos.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {photos.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {photos.map((photo) => (
                        <figure
                          key={photo.id}
                          className="overflow-hidden rounded-md border border-border"
                        >
                          <img
                            src={api.evidenceUrl(aggregate.tenancy.id, photo.id)}
                            crossOrigin="use-credentials"
                            alt={`${inspection.area} evidence`}
                            className="h-24 w-full object-cover"
                            loading="lazy"
                          />
                          <figcaption className="mono truncate px-2 py-1 text-[10px] text-muted-foreground">
                            {shortHash(photo.sha256, 10)}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm hover:bg-accent">
                      {uploadingId === inspection.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Upload className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span>Upload photo</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic"
                        className="sr-only"
                        disabled={uploadingId !== null}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) onUpload(inspection.id, file);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function TenancyDetail({ user }: { user: SessionUser }) {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const tenancyQuery = useTenancy(id);

  const [claimed, setClaimed] = useState('25000');
  const [areaDraft, setAreaDraft] = useState<Record<InspectionStage, string>>({
    move_in: '',
    move_out: '',
  });
  const [disputeReason, setDisputeReason] = useState('');
  const [challengeFindingId, setChallengeFindingId] = useState<string>('none');
  const [resolveTarget, setResolveTarget] = useState<Dispute | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const refresh = () => {
    if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.tenancy(id) });
  };

  const acceptTenancy = useMutation({
    mutationFn: () => api.acceptTenancy(id as string),
    onSuccess: () => {
      toast.success('Invitation accepted');
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not accept'),
  });

  const endTenancy = useMutation({
    mutationFn: () => api.endTenancy(id as string),
    onSuccess: () => {
      toast.success('Tenancy ended');
      refresh();
    },
  });

  const addInspection = useMutation({
    mutationFn: ({ stage, area }: { stage: InspectionStage; area: string }) =>
      api.createInspection(id as string, { stage, area }),
    onSuccess: (_result, variables) => {
      toast.success('Area added');
      setAreaDraft((draft) => ({ ...draft, [variables.stage]: '' }));
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not add the area'),
  });

  const upload = useMutation({
    mutationFn: ({ inspectionId, file }: { inspectionId: string; file: File }) =>
      api.uploadEvidence(id as string, inspectionId, file),
    onSuccess: () => {
      toast.success('Photo stored with a SHA-256 record');
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not upload the photo'),
  });

  const runAudit = useMutation({
    mutationFn: () => api.runAudit(id as string, parseRupeesToPaise(claimed) ?? 0),
    onSuccess: (result) => {
      toast.success(`Audit complete using the ${result.engine} engine`);
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not run the audit'),
  });

  const acceptStatement = useMutation({
    mutationFn: () => api.acceptStatement(id as string),
    onSuccess: () => {
      toast.success('Statement accepted');
      refresh();
    },
  });

  const openDispute = useMutation({
    mutationFn: () =>
      api.openDispute(id as string, {
        reason: disputeReason,
        findingId: challengeFindingId === 'none' ? undefined : challengeFindingId,
      }),
    onSuccess: () => {
      toast.success('Dispute opened');
      setDisputeReason('');
      setChallengeFindingId('none');
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not open the dispute'),
  });

  const resolveDispute = useMutation({
    mutationFn: () => api.resolveDispute(id as string, resolveTarget?.id ?? '', resolveNote),
    onSuccess: () => {
      toast.success('Dispute resolved');
      setResolveTarget(null);
      setResolveNote('');
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not resolve the dispute'),
  });

  const aggregate = tenancyQuery.data;
  const statutoryNote = useMemo(
    () => (aggregate ? statutoryNoteForState(aggregate.property.stateCode) : ''),
    [aggregate],
  );

  if (tenancyQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (tenancyQuery.isError || !aggregate) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <FileWarning className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {tenancyQuery.error instanceof Error
              ? tenancyQuery.error.message
              : 'This tenancy could not be loaded.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { tenancy, property, statement, findings, disputes } = aggregate;
  const isLandlord = tenancy.landlordId === user.id;
  const isTenant = tenancy.tenantId === user.id;
  const canAccept = tenancy.status === 'invited' && isTenant;
  const canCapture = tenancy.status === 'active';
  const uploadingId = upload.isPending ? (upload.variables?.inspectionId ?? null) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Tenancy</p>
            <Badge
              variant={tenancy.status === 'active' ? 'sage' : 'outline'}
              className="capitalize"
            >
              {tenancy.status}
            </Badge>
          </div>
          <h1 className="mt-2 text-3xl text-foreground">{property.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {property.addressLine}, {property.city}, {property.stateCode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAccept ? (
            <Button onClick={() => acceptTenancy.mutate()} disabled={acceptTenancy.isPending}>
              Accept invitation
            </Button>
          ) : null}
          {isLandlord || isTenant ? (
            <Button
              variant="outline"
              onClick={() => endTenancy.mutate()}
              disabled={tenancy.status !== 'active' || endTenancy.isPending}
            >
              End tenancy
            </Button>
          ) : null}
          <Button variant="outline" className="no-print" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" /> Print
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="capture">Capture</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="disputes" id="tab-disputes">
            Disputes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Deposit and terms</CardTitle>
              </CardHeader>
              <CardContent>
                <TotalsRow
                  label="Security deposit"
                  value={formatPaise(tenancy.depositPaise)}
                  strong
                />
                <TotalsRow label="Monthly rent" value={formatPaise(tenancy.monthlyRentPaise)} />
                <TotalsRow label="Start" value={formatDate(tenancy.startDate)} />
                <TotalsRow label="End" value={formatDate(tenancy.endDate)} />
                <TotalsRow label="Tenant" value={tenancy.tenantEmail} />
                <TotalsRow
                  label="Joined"
                  value={
                    tenancy.respondedAt ? formatDateTime(tenancy.respondedAt) : 'Not accepted yet'
                  }
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Applicable context</CardTitle>
                <CardDescription>Advisory only. Makaan does not decide liability.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>{statutoryNote}</p>
                <p className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {ADVISORY_BANNER}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="capture">
          {!canCapture ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Capture opens once the tenancy is active.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {STAGES.map((stage) => (
                <CaptureColumn
                  key={stage.stage}
                  aggregate={aggregate}
                  stage={stage.stage}
                  title={stage.title}
                  hint={stage.hint}
                  areaValue={areaDraft[stage.stage]}
                  onAreaChange={(value) =>
                    setAreaDraft((draft) => ({ ...draft, [stage.stage]: value }))
                  }
                  onAddArea={() =>
                    addInspection.mutate({ stage: stage.stage, area: areaDraft[stage.stage] })
                  }
                  isAdding={addInspection.isPending}
                  onUpload={(inspectionId, file) => upload.mutate({ inspectionId, file })}
                  uploadingId={uploadingId}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit">
          <div className="space-y-4">
            <Card className="relative overflow-hidden">
              {runAudit.isPending ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                  <div className="flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm text-background">
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Comparing evidence and pricing differences
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 animate-scan-sweep bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
                </div>
              ) : null}
              <CardHeader>
                <CardTitle className="text-lg">Run the deposit audit</CardTitle>
                <CardDescription>
                  Enter the amount the owner is claiming to deduct. The audit returns an advisory
                  assessment, not a legal decision.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="claimed">Owner claim (Rs)</Label>
                    <Input
                      id="claimed"
                      inputMode="numeric"
                      value={claimed}
                      onChange={(event) => setClaimed(event.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => runAudit.mutate()}
                    disabled={runAudit.isPending || !canCapture}
                  >
                    <ScanLine className="h-4 w-4" aria-hidden="true" /> Run audit
                  </Button>
                </div>
                {statement ? (
                  <p className="text-xs text-muted-foreground">
                    Latest statement used the {statement.engine} engine. Re-running creates a new
                    version.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {findings.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No findings yet. Capture move-in and move-out evidence, then run the audit.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {findings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    onChallenge={() => {
                      setChallengeFindingId(finding.id);
                      document.getElementById('tab-disputes')?.click();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="statement">
          {!statement ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No statement has been produced yet. Run the audit first.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{ADVISORY_DISCLAIMER}</span>
                </div>
              </div>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">Deposit statement</CardTitle>
                    <CardDescription>
                      Version {statement.version} · generated {formatDateTime(statement.createdAt)}
                    </CardDescription>
                  </div>
                  <Badge variant={statement.status === 'accepted' ? 'sage' : 'outline'}>
                    {statement.status.replace('_', ' ')}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <TotalsRow label="Deposit held" value={formatPaise(statement.depositPaise)} />
                  <TotalsRow label="Owner claim" value={formatPaise(statement.claimedPaise)} />
                  <TotalsRow
                    label="Approved deduction"
                    value={formatPaise(statement.approvedDeductionPaise)}
                  />
                  <TotalsRow
                    label="Protected amount"
                    value={formatPaise(statement.protectedPaise)}
                  />
                  {statement.shortfallPaise > 0 ? (
                    <TotalsRow
                      label="Shortfall beyond deposit"
                      value={formatPaise(statement.shortfallPaise)}
                    />
                  ) : null}
                  <div className="my-2 h-px bg-border" />
                  <TotalsRow
                    label="Refund owed to tenant"
                    value={formatPaise(statement.refundPaise)}
                    strong
                  />

                  <div className="mt-6 flex flex-wrap items-center gap-3 no-print">
                    <Button
                      onClick={() => acceptStatement.mutate()}
                      disabled={acceptStatement.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Accept statement
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Landlord:{' '}
                      {statement.acceptedByLandlordAt
                        ? formatDateTime(statement.acceptedByLandlordAt)
                        : 'pending'}{' '}
                      · Tenant:{' '}
                      {statement.acceptedByTenantAt
                        ? formatDateTime(statement.acceptedByTenantAt)
                        : 'pending'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Findings</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Area</TableHead>
                        <TableHead>Classification</TableHead>
                        <TableHead className="text-right">Deduction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {findings.map((finding) => (
                        <TableRow key={finding.id}>
                          <TableCell className="font-medium">{finding.area}</TableCell>
                          <TableCell>
                            <ClassificationBadge classification={finding.classification} />
                          </TableCell>
                          <TableCell className="mono text-right">
                            {formatPaise(finding.recommendedDeductionPaise)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground">{NOT_AUTHORITY_FOOTER}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="disputes">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Open a dispute</CardTitle>
                <CardDescription>Challenge a finding or the statement as a whole.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="finding">Finding (optional)</Label>
                  <Select value={challengeFindingId} onValueChange={setChallengeFindingId}>
                    <SelectTrigger id="finding">
                      <SelectValue placeholder="Whole statement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Whole statement</SelectItem>
                      {findings.map((finding) => (
                        <SelectItem key={finding.id} value={finding.id}>
                          {finding.area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    rows={4}
                    value={disputeReason}
                    onChange={(event) => setDisputeReason(event.target.value)}
                    placeholder="Explain what you disagree with and why."
                  />
                </div>
                <Button
                  onClick={() => openDispute.mutate()}
                  disabled={openDispute.isPending || disputeReason.trim().length < 10}
                >
                  Open dispute
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dispute trail</CardTitle>
              </CardHeader>
              <CardContent>
                {disputes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No disputes opened.</p>
                ) : (
                  <ul className="space-y-4">
                    {disputes.map((dispute) => (
                      <li key={dispute.id} className="rounded-md border border-border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant={dispute.status === 'resolved' ? 'sage' : 'outline'}>
                            {dispute.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(dispute.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{dispute.reason}</p>
                        {dispute.resolutionNote ? (
                          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                            Resolution: {dispute.resolutionNote}
                          </p>
                        ) : null}
                        {dispute.status === 'open' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setResolveTarget(dispute)}
                          >
                            Resolve
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={resolveTarget !== null}
        onOpenChange={(open) => (!open ? setResolveTarget(null) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve dispute</DialogTitle>
            <DialogDescription>Record how this was settled. The trail is kept.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolution">Resolution note</Label>
            <Textarea
              id="resolution"
              rows={4}
              value={resolveNote}
              onChange={(event) => setResolveNote(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => resolveDispute.mutate()}
              disabled={resolveDispute.isPending || resolveNote.trim().length < 3}
            >
              Mark resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
