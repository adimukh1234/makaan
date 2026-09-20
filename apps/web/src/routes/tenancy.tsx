import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  FileWarning,
  Loader2,
  Printer,
  RefreshCw,
  Scale,
  ScanLine,
  ShieldCheck,
  Sparkles,
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
  type EvidenceAsset,
  type Inspection,
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

interface PreviewImageInfo {
  url: string;
  title: string;
  hash: string;
  stage: string;
  timestamp?: string | null;
}

function FindingCard({
  finding,
  tenancyId,
  inspections,
  evidence,
  propertyCity,
  onChallenge,
  onViewImage,
}: {
  finding: AuditFinding;
  tenancyId: string;
  inspections: Inspection[];
  evidence: EvidenceAsset[];
  propertyCity: string;
  onChallenge: () => void;
  onViewImage: (info: PreviewImageInfo) => void;
}) {
  const moveInInspection = inspections.find(
    (i) =>
      i.stage === 'move_in' &&
      i.area.trim().toLowerCase() === finding.area.trim().toLowerCase(),
  );
  const moveOutInspection = inspections.find(
    (i) =>
      i.stage === 'move_out' &&
      i.area.trim().toLowerCase() === finding.area.trim().toLowerCase(),
  );

  const moveInPhoto = moveInInspection
    ? evidence.find((asset) => asset.inspectionId === moveInInspection.id)
    : undefined;
  const moveOutPhoto = moveOutInspection
    ? evidence.find((asset) => asset.inspectionId === moveOutInspection.id)
    : undefined;

  const hasPhotos = Boolean(moveInPhoto || moveOutPhoto);

  return (
    <div className="rounded-md border border-border bg-card p-4 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground text-base">{finding.area}</span>
          <ClassificationBadge classification={finding.classification} />
          {finding.reviewRequired ? <Badge variant="outline">Needs review</Badge> : null}
          <span className="text-xs text-muted-foreground">
            confidence {(finding.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Recommended Deduction
          </div>
          <div className="mono text-lg font-bold text-foreground">
            {formatPaise(finding.recommendedDeductionPaise)}
          </div>
        </div>
      </div>

      {hasPhotos && (
        <div className="mt-4 rounded-lg border border-border/80 bg-secondary/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Visual Evidence Comparison
            </span>
            <span className="mono text-[11px] text-muted-foreground">
              SHA-256 Verified
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Move-in photo card */}
            <div className="overflow-hidden rounded-md border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs">
                <span className="inline-flex items-center gap-1 font-medium text-sage">
                  <span className="h-1.5 w-1.5 rounded-full bg-sage" /> Move-in Baseline
                </span>
                {moveInPhoto ? (
                  <span className="mono text-[10px] text-muted-foreground">
                    {shortHash(moveInPhoto.sha256, 8)}
                  </span>
                ) : null}
              </div>
              {moveInPhoto ? (
                <div
                  role="button"
                  tabIndex={0}
                  className="group relative cursor-pointer overflow-hidden"
                  onClick={() =>
                    onViewImage({
                      url: api.evidenceUrl(tenancyId, moveInPhoto.id),
                      title: `${finding.area} — Move-in Baseline`,
                      hash: moveInPhoto.sha256,
                      stage: 'Move-in Baseline',
                      timestamp: moveInPhoto.createdAt,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onViewImage({
                        url: api.evidenceUrl(tenancyId, moveInPhoto.id),
                        title: `${finding.area} — Move-in Baseline`,
                        hash: moveInPhoto.sha256,
                        stage: 'Move-in Baseline',
                        timestamp: moveInPhoto.createdAt,
                      });
                    }
                  }}
                >
                  <img
                    src={api.evidenceUrl(tenancyId, moveInPhoto.id)}
                    crossOrigin="use-credentials"
                    alt={`${finding.area} move-in`}
                    className="h-36 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground">
                      Inspect photo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">
                  No move-in photo recorded
                </div>
              )}
            </div>

            {/* Move-out photo card */}
            <div className="overflow-hidden rounded-md border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs">
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Move-out Handover
                </span>
                {moveOutPhoto ? (
                  <span className="mono text-[10px] text-muted-foreground">
                    {shortHash(moveOutPhoto.sha256, 8)}
                  </span>
                ) : null}
              </div>
              {moveOutPhoto ? (
                <div
                  role="button"
                  tabIndex={0}
                  className="group relative cursor-pointer overflow-hidden"
                  onClick={() =>
                    onViewImage({
                      url: api.evidenceUrl(tenancyId, moveOutPhoto.id),
                      title: `${finding.area} — Move-out Handover`,
                      hash: moveOutPhoto.sha256,
                      stage: 'Move-out Handover',
                      timestamp: moveOutPhoto.createdAt,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onViewImage({
                        url: api.evidenceUrl(tenancyId, moveOutPhoto.id),
                        title: `${finding.area} — Move-out Handover`,
                        hash: moveOutPhoto.sha256,
                        stage: 'Move-out Handover',
                        timestamp: moveOutPhoto.createdAt,
                      });
                    }
                  }}
                >
                  <img
                    src={api.evidenceUrl(tenancyId, moveOutPhoto.id)}
                    crossOrigin="use-credentials"
                    alt={`${finding.area} move-out`}
                    className="h-36 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground">
                      Inspect photo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">
                  No move-out photo recorded
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rationale & benchmark */}
      <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Assessor Rationale
        </div>
        <p className="mt-1 leading-relaxed text-foreground">{finding.rationale}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono">
            Benchmark ({propertyCity}): {formatPaise(finding.benchmarkLowPaise)} to{' '}
            {formatPaise(finding.benchmarkHighPaise)}
          </span>
          <span>·</span>
          <span className="mono">engine {finding.engine}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onChallenge}>
          Challenge finding
        </Button>
      </div>

      {finding.statutoryNote ? (
        <div className="mt-3 flex items-start gap-1.5 border-t border-border/70 pt-2 text-xs text-muted-foreground">
          <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" />
          <span>{finding.statutoryNote}</span>
        </div>
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
  onViewImage,
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
  onViewImage: (info: PreviewImageInfo) => void;
}) {
  const inspections = aggregate.inspections.filter((inspection) => inspection.stage === stage);
  const evidence = aggregate.evidence;

  const isEnded = aggregate.tenancy.status === 'ended';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!isEnded ? (
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
        ) : (
          <div className="rounded border border-border/70 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            Tenancy concluded — photo record is locked for deposit settlement.
          </div>
        )}

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
                          role="button"
                          tabIndex={0}
                          className="group relative cursor-pointer overflow-hidden rounded-md border border-border"
                          onClick={() =>
                            onViewImage({
                              url: api.evidenceUrl(aggregate.tenancy.id, photo.id),
                              title: `${inspection.area} (${stage === 'move_in' ? 'Move-in Baseline' : 'Move-out Handover'})`,
                              hash: photo.sha256,
                              stage: stage === 'move_in' ? 'Move-in Baseline' : 'Move-out Handover',
                              timestamp: photo.createdAt,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              onViewImage({
                                url: api.evidenceUrl(aggregate.tenancy.id, photo.id),
                                title: `${inspection.area} (${stage === 'move_in' ? 'Move-in Baseline' : 'Move-out Handover'})`,
                                hash: photo.sha256,
                                stage: stage === 'move_in' ? 'Move-in Baseline' : 'Move-out Handover',
                                timestamp: photo.createdAt,
                              });
                            }
                          }}
                        >
                          <img
                            src={api.evidenceUrl(aggregate.tenancy.id, photo.id)}
                            crossOrigin="use-credentials"
                            alt={`${inspection.area} evidence`}
                            className="h-24 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            loading="lazy"
                          />
                          <figcaption className="mono truncate px-2 py-1 text-[10px] text-muted-foreground">
                            {shortHash(photo.sha256, 10)}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                  {!isEnded ? (
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
                  ) : null}
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
  const [previewImage, setPreviewImage] = useState<PreviewImageInfo | null>(null);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

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

  const { tenancy, property, inspections, evidence, statement, findings, disputes } =
    aggregate;
  const isLandlord = tenancy.landlordId === user.id;
  const isTenant = tenancy.tenantId === user.id;
  const canAccept = tenancy.status === 'invited' && isTenant;
  const canCapture = tenancy.status === 'active';
  const uploadingId = upload.isPending ? (upload.variables?.inspectionId ?? null) : null;

  return (
    <div className="space-y-8">
      {/* Print-Only Official Dossier Header */}
      <div className="hidden print:block mb-6 border-b border-border pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">MAKAAN</h1>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
              Rental Deposit Adjudication Dossier
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>
              <span className="font-semibold">Statement:</span> v{statement?.version ?? '1'}
            </div>
            <div>
              <span className="font-semibold">Generated:</span>{' '}
              {statement?.createdAt
                ? formatDateTime(statement.createdAt)
                : formatDateTime(new Date().toISOString())}
            </div>
            <div>
              <span className="font-semibold">Status:</span>{' '}
              {statement?.status ? statement.status.toUpperCase() : 'PENDING'}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-border pt-3">
          <div>
            <span className="font-semibold text-foreground">Property:</span> {property.title},{' '}
            {property.addressLine}, {property.city} ({property.stateCode})
          </div>
          <div>
            <span className="font-semibold text-foreground">Agreed Deposit:</span>{' '}
            {formatPaise(tenancy.depositPaise)} |{' '}
            <span className="font-semibold text-foreground">Rent:</span>{' '}
            {formatPaise(tenancy.monthlyRentPaise)}/mo
          </div>
          <div>
            <span className="font-semibold text-foreground">Tenant Email:</span>{' '}
            {tenancy.tenantEmail}
          </div>
          <div>
            <span className="font-semibold text-foreground">Tenancy Period:</span>{' '}
            {formatDate(tenancy.startDate)} to{' '}
            {tenancy.endDate ? formatDate(tenancy.endDate) : 'Handover'}
          </div>
        </div>
      </div>

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
        <div className="flex flex-wrap gap-2 no-print">
          {canAccept ? (
            <Button onClick={() => acceptTenancy.mutate()} disabled={acceptTenancy.isPending}>
              Accept invitation
            </Button>
          ) : null}
          {isLandlord || isTenant ? (
            <Button
              variant="outline"
              onClick={() => setConfirmEndOpen(true)}
              disabled={tenancy.status !== 'active' || endTenancy.isPending}
            >
              End tenancy
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" /> Print
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap no-print">
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
          {tenancy.status === 'invited' ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Capture opens once the invitation is accepted.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {tenancy.status === 'ended' && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Badge variant="outline">Tenancy Concluded</Badge>
                  <span>Handover is complete. Photos are preserved for deposit adjudication.</span>
                </div>
              )}
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
                    onViewImage={setPreviewImage}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit">
          <div className="space-y-4">
            {/* AWS Bedrock Engine Telemetry Banner */}
            <Card className="border-border bg-gradient-to-r from-card via-secondary/15 to-card">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                      <Sparkles className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {statement?.engine === 'bedrock'
                            ? 'Amazon Bedrock Nova Lite'
                            : 'Deterministic Legal Benchmark Engine'}
                        </span>
                        <Badge variant={statement?.engine === 'bedrock' ? 'sage' : 'outline'}>
                          {statement?.engine === 'bedrock' ? 'AWS Bedrock Active' : 'Local Fallback'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {statement?.engine === 'bedrock'
                          ? 'Model: amazon.nova-lite-v1:0 · AWS Region: ap-south-1 (Mumbai) · Multimodal Vision-Language Analysis'
                          : 'Evaluating visual diff against statutory wear-and-tear thresholds & city repair benchmark database.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="rounded border border-border/80 bg-background/80 px-3 py-1.5 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Benchmark City
                      </div>
                      <div className="font-semibold capitalize text-foreground">
                        {property.city}
                      </div>
                    </div>
                    <div className="rounded border border-border/80 bg-background/80 px-3 py-1.5 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Integrity
                      </div>
                      <div className="font-semibold text-sage">SHA-256 Hashed</div>
                    </div>
                  </div>
                </div>

                {statutoryNote ? (
                  <div className="mt-4 flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground">
                    <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" />
                    <span>{statutoryNote}</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>

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
                    disabled={runAudit.isPending || tenancy.status === 'invited'}
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
                    tenancyId={tenancy.id}
                    inspections={inspections}
                    evidence={evidence}
                    propertyCity={property.city}
                    onChallenge={() => {
                      setChallengeFindingId(finding.id);
                      document.getElementById('tab-disputes')?.click();
                    }}
                    onViewImage={setPreviewImage}
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
                    <Button
                      variant="outline"
                      onClick={() => window.print()}
                    >
                      <Printer className="h-4 w-4" aria-hidden="true" /> Print / Export Dossier
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Itemized Findings & Deductions</CardTitle>
                    <CardDescription>
                      Evaluated against city repair benchmarks and statutory fair wear-and-tear rules.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Area</TableHead>
                          <TableHead>Classification</TableHead>
                          <TableHead className="hidden md:table-cell">Evidence Hashes</TableHead>
                          <TableHead className="hidden lg:table-cell">Assessor Rationale</TableHead>
                          <TableHead className="text-right">Deduction</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {findings.map((finding) => {
                          const inInsp = inspections.find(
                            (i) =>
                              i.stage === 'move_in' &&
                              i.area.trim().toLowerCase() === finding.area.trim().toLowerCase(),
                          );
                          const outInsp = inspections.find(
                            (i) =>
                              i.stage === 'move_out' &&
                              i.area.trim().toLowerCase() === finding.area.trim().toLowerCase(),
                          );
                          const inPhoto = inInsp
                            ? evidence.find((e) => e.inspectionId === inInsp.id)
                            : undefined;
                          const outPhoto = outInsp
                            ? evidence.find((e) => e.inspectionId === outInsp.id)
                            : undefined;

                          return (
                            <TableRow key={finding.id}>
                              <TableCell className="align-top font-medium">
                                <div>{finding.area}</div>
                                {finding.reviewRequired ? (
                                  <Badge variant="outline" className="mt-1 text-[10px]">
                                    Review
                                  </Badge>
                                ) : null}
                              </TableCell>
                              <TableCell className="align-top">
                                <ClassificationBadge classification={finding.classification} />
                              </TableCell>
                              <TableCell className="hidden align-top text-xs md:table-cell">
                                {inPhoto ? (
                                  <div className="mono text-[11px] text-muted-foreground">
                                    <span className="font-medium text-sage">In:</span>{' '}
                                    {shortHash(inPhoto.sha256, 8)}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-muted-foreground">In: None</div>
                                )}
                                {outPhoto ? (
                                  <div className="mono text-[11px] text-muted-foreground">
                                    <span className="font-medium text-primary">Out:</span>{' '}
                                    {shortHash(outPhoto.sha256, 8)}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-muted-foreground">Out: None</div>
                                )}
                              </TableCell>
                              <TableCell className="hidden max-w-xs align-top text-xs text-muted-foreground lg:table-cell">
                                <p className="line-clamp-2 text-foreground">{finding.rationale}</p>
                                <p className="mono mt-1 text-[11px]">
                                  Range: {formatPaise(finding.benchmarkLowPaise)} –{' '}
                                  {formatPaise(finding.benchmarkHighPaise)}
                                </p>
                              </TableCell>
                              <TableCell className="mono align-top text-right font-semibold">
                                {formatPaise(finding.recommendedDeductionPaise)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Official Print-Only Adjudication Pack Footer */}
              <div className="hidden print-avoid-break mt-8 border-t border-border pt-6 print:block">
                <div className="grid grid-cols-2 gap-8 text-xs">
                  <div className="rounded border border-border p-4">
                    <div className="mb-1 text-sm font-semibold">Landlord Acceptance</div>
                    <div className="mb-4 text-muted-foreground">
                      {statement.acceptedByLandlordAt
                        ? `Digitally accepted on ${formatDateTime(statement.acceptedByLandlordAt)}`
                        : 'Status: Pending signature / acceptance'}
                    </div>
                    <div className="mt-10 border-t border-dashed border-border pt-1 text-[11px] text-muted-foreground">
                      Authorized Signature & Date
                    </div>
                  </div>
                  <div className="rounded border border-border p-4">
                    <div className="mb-1 text-sm font-semibold">Tenant Acceptance</div>
                    <div className="mb-4 text-muted-foreground">
                      {statement.acceptedByTenantAt
                        ? `Digitally accepted on ${formatDateTime(statement.acceptedByTenantAt)}`
                        : 'Status: Pending signature / acceptance'}
                    </div>
                    <div className="mt-10 border-t border-dashed border-border pt-1 text-[11px] text-muted-foreground">
                      Authorized Signature & Date
                    </div>
                  </div>
                </div>
                <div className="mt-6 border-t border-border/70 pt-4 text-[10px] leading-relaxed text-muted-foreground">
                  <p className="mb-1 font-semibold text-foreground">Legal & Evidentiary Disclaimer:</p>
                  <p>{NOT_AUTHORITY_FOOTER}</p>
                  <p className="mt-1">{statutoryNote}</p>
                  <p className="mono mt-1">
                    Statement ID: {statement.id} · Engine: {statement.engine} · Version: v{statement.version} · Verification: SHA-256 Immutable Evidence Chain
                  </p>
                </div>
              </div>

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

      <Dialog
        open={previewImage !== null}
        onOpenChange={(open) => (!open ? setPreviewImage(null) : null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewImage?.title}</DialogTitle>
            <DialogDescription>
              {previewImage?.stage}
              {previewImage?.timestamp ? ` · ${formatDateTime(previewImage.timestamp)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {previewImage ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-md border border-border bg-black/5">
                <img
                  src={previewImage.url}
                  crossOrigin="use-credentials"
                  alt={previewImage.title}
                  className="max-h-[60vh] w-full object-contain"
                />
              </div>
              <div className="rounded border border-border bg-muted/40 p-2.5 text-xs">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Cryptographic SHA-256 Hash
                </div>
                <div className="mono break-all font-medium text-foreground mt-0.5">
                  {previewImage.hash}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewImage(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Tenancy?</DialogTitle>
            <DialogDescription>
              Marking this tenancy as ended records that handover has occurred. Further photo capture will be locked, and you can proceed with deposit audit and settlement.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEndOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmEndOpen(false);
                endTenancy.mutate();
              }}
              disabled={endTenancy.isPending}
            >
              End tenancy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
