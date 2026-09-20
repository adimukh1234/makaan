import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export const queryKeys = {
  session: ['session'] as const,
  properties: ['properties'] as const,
  tenancies: ['tenancies'] as const,
  tenancy: (id: string) => ['tenancy', id] as const,
  consents: ['consents'] as const,
};

export function useSession() {
  return useQuery({ queryKey: queryKeys.session, queryFn: api.getSession, staleTime: 30_000 });
}

export function useProperties() {
  return useQuery({ queryKey: queryKeys.properties, queryFn: api.listProperties });
}

export function useTenancies() {
  return useQuery({ queryKey: queryKeys.tenancies, queryFn: api.listTenancies });
}

export function useTenancy(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tenancy(id ?? 'none'),
    queryFn: () => api.getTenancy(id as string),
    enabled: Boolean(id),
  });
}

export function useConsents() {
  return useQuery({ queryKey: queryKeys.consents, queryFn: api.listConsents });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      client.clear();
      window.location.assign('/login');
    },
  });
}
