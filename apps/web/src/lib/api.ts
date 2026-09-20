import type {
  AuditFinding,
  ConsentPurpose,
  ConsentRecord,
  Dispute,
  EvidenceAsset,
  Inspection,
  Property,
  SessionUser,
  Statement,
  Tenancy,
  TenancyAggregate,
} from '@makaan/core';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  raw?: BodyInit;
  headers?: Record<string, string>;
}

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  let body = options.raw;

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (method !== 'GET' && csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error;
    if (response.status === 401) {
      csrfToken = null;
    }
    throw new ApiError(
      response.status,
      error?.code ?? 'ERROR',
      error?.message ?? 'Request failed',
      error?.details,
    );
  }

  return payload as T;
}

export interface SessionResponse {
  user: SessionUser | null;
  csrfToken: string | null;
}

export interface AuthResponse {
  user: SessionUser;
  csrfToken: string;
}

export interface PropertyResponse {
  property: Property;
  warning?: string | null;
}

export const api = {
  async getSession(): Promise<SessionResponse> {
    const session = await apiFetch<SessionResponse>('/api/auth/session');
    setCsrfToken(session.csrfToken);
    return session;
  },

  async register(input: {
    email: string;
    name: string;
    password: string;
    role: 'tenant' | 'landlord';
    consent: { service: true; evidence_retention: true; ai_processing: true };
  }): Promise<AuthResponse> {
    const result = await apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: input,
    });
    setCsrfToken(result.csrfToken);
    return result;
  },

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const result = await apiFetch<AuthResponse>('/api/auth/login', { method: 'POST', body: input });
    setCsrfToken(result.csrfToken);
    return result;
  },

  async logout(): Promise<void> {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setCsrfToken(null);
  },

  listProperties: () => apiFetch<{ properties: Property[] }>('/api/properties'),
  createProperty: (body: unknown) =>
    apiFetch<PropertyResponse>('/api/properties', { method: 'POST', body }),
  getProperty: (id: string) => apiFetch<PropertyResponse>(`/api/properties/${id}`),

  listTenancies: () => apiFetch<{ tenancies: Tenancy[] }>('/api/tenancies'),
  createTenancy: (body: unknown) =>
    apiFetch<{ tenancy: Tenancy }>('/api/tenancies', { method: 'POST', body }),
  getTenancy: (id: string) => apiFetch<TenancyAggregate>(`/api/tenancies/${id}`),
  acceptTenancy: (id: string) =>
    apiFetch<{ tenancy: Tenancy }>(`/api/tenancies/${id}/accept`, { method: 'POST' }),
  endTenancy: (id: string) =>
    apiFetch<{ tenancy: Tenancy }>(`/api/tenancies/${id}/end`, { method: 'POST' }),

  createInspection: (tenancyId: string, body: unknown) =>
    apiFetch<{ inspection: Inspection }>(`/api/tenancies/${tenancyId}/inspections`, {
      method: 'POST',
      body,
    }),

  uploadEvidence: async (
    tenancyId: string,
    inspectionId: string,
    file: File,
  ): Promise<{ evidence: Omit<EvidenceAsset, 'storageKey'> }> => {
    const form = new FormData();
    form.append('file', file);
    return apiFetch(
      `/api/tenancies/${tenancyId}/evidence?inspectionId=${encodeURIComponent(inspectionId)}`,
      {
        method: 'POST',
        raw: form,
      },
    );
  },

  evidenceUrl: (tenancyId: string, assetId: string) =>
    `${BASE_URL}/api/tenancies/${tenancyId}/evidence/${assetId}`,

  runAudit: (tenancyId: string, claimedPaise: number) =>
    apiFetch<{
      statement: Statement;
      findings: AuditFinding[];
      engine: string;
      fallbackReason: string | null;
    }>(`/api/tenancies/${tenancyId}/audit`, { method: 'POST', body: { claimedPaise } }),

  getStatement: (tenancyId: string) =>
    apiFetch<{ statement: Statement; findings: AuditFinding[] }>(
      `/api/tenancies/${tenancyId}/statement`,
    ),

  acceptStatement: (tenancyId: string) =>
    apiFetch<{ statement: Statement }>(`/api/tenancies/${tenancyId}/statement/accept`, {
      method: 'POST',
    }),

  openDispute: (tenancyId: string, body: unknown) =>
    apiFetch<{ dispute: Dispute }>(`/api/tenancies/${tenancyId}/disputes`, {
      method: 'POST',
      body,
    }),

  resolveDispute: (tenancyId: string, disputeId: string, resolutionNote: string) =>
    apiFetch<{ dispute: Dispute }>(`/api/tenancies/${tenancyId}/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: { resolutionNote },
    }),

  listConsents: () => apiFetch<{ consents: ConsentRecord[] }>('/api/me/consents'),
  updateConsent: (purpose: ConsentPurpose, granted: boolean) =>
    apiFetch<{ consent: ConsentRecord }>('/api/me/consents', {
      method: 'POST',
      body: { purpose, granted },
    }),

  exportUrl: () => `${BASE_URL}/api/me/export`,
};
