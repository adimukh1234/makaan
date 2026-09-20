import { formatPaise } from '@makaan/core';

export { formatPaise };

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function shortHash(value: string, length = 12): string {
  return value.slice(0, length);
}

export function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function classificationLabel(classification: string): string {
  switch (classification) {
    case 'WEAR_AND_TEAR':
      return 'Wear and tear';
    case 'DAMAGE':
      return 'Damage';
    case 'PRE_EXISTING':
      return 'Pre-existing';
    case 'UNCERTAIN':
      return 'Needs review';
    default:
      return classification;
  }
}
