/**
 * State tenancy regimes.
 *
 * The Model Tenancy Act 2021 is a model law. It binds only the states that
 * adopted it. Everything here is advisory context for the product; it is not
 * legal advice and it never blocks a user action.
 */

export interface StateRule {
  code: string;
  name: string;
  regime: 'MTA' | 'LEGACY_RENT_CONTROL';
  depositCapMonthsResidential: number | null;
  authorityName: string | null;
  authorityUrl: string | null;
  notes: string;
}

export const STATE_RULES: StateRule[] = [
  {
    code: 'TN',
    name: 'Tamil Nadu',
    regime: 'MTA',
    depositCapMonthsResidential: 2,
    authorityName: 'Rent Authority, Tamil Nadu',
    authorityUrl: 'https://tenancy.tn.gov.in',
    notes:
      'Model Tenancy Act adopted. Residential deposit is capped at two months. Tenancy agreements are intimated to the Rent Authority.',
  },
  {
    code: 'AP',
    name: 'Andhra Pradesh',
    regime: 'MTA',
    depositCapMonthsResidential: 2,
    authorityName: 'Rent Authority, Andhra Pradesh',
    authorityUrl: null,
    notes: 'Model Tenancy Act adopted. Residential deposit is capped at two months.',
  },
  {
    code: 'UP',
    name: 'Uttar Pradesh',
    regime: 'MTA',
    depositCapMonthsResidential: 2,
    authorityName: 'Rent Authority, Uttar Pradesh',
    authorityUrl: 'https://upawas.up.gov.in',
    notes:
      'State tenancy law aligned with the Model Tenancy Act. Online tenancy registration is available.',
  },
  {
    code: 'AS',
    name: 'Assam',
    regime: 'MTA',
    depositCapMonthsResidential: 2,
    authorityName: 'Rent Authority, Assam',
    authorityUrl: null,
    notes: 'Model Tenancy Act adopted. Residential deposit is capped at two months.',
  },
  {
    code: 'MH',
    name: 'Maharashtra',
    regime: 'LEGACY_RENT_CONTROL',
    depositCapMonthsResidential: null,
    authorityName: 'Rent Authority under the Maharashtra Rent Control Act, 1999',
    authorityUrl: null,
    notes:
      'Every Leave and Licence agreement must be registered regardless of duration. The Model Tenancy Act deposit cap is not operative here.',
  },
  {
    code: 'KA',
    name: 'Karnataka',
    regime: 'LEGACY_RENT_CONTROL',
    depositCapMonthsResidential: null,
    authorityName: null,
    authorityUrl: null,
    notes:
      'Legacy rent control regime. Agreements are registered through Kaveri. The Model Tenancy Act cap is not operative.',
  },
];

export const OTHER_STATES: Array<{ code: string; name: string }> = [
  { code: 'DL', name: 'Delhi' },
  { code: 'HR', name: 'Haryana' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'WB', name: 'West Bengal' },
  { code: 'KL', name: 'Kerala' },
  { code: 'TS', name: 'Telangana' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'OD', name: 'Odisha' },
  { code: 'BR', name: 'Bihar' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'GA', name: 'Goa' },
];

const FALLBACK_RULE: StateRule = {
  code: 'XX',
  name: 'Unspecified state',
  regime: 'LEGACY_RENT_CONTROL',
  depositCapMonthsResidential: null,
  authorityName: null,
  authorityUrl: null,
  notes:
    'No Model Tenancy Act deposit cap is assumed. This assessment is advisory and does not create a legal determination.',
};

export function listStates(): Array<{ code: string; name: string }> {
  return [...STATE_RULES.map((rule) => ({ code: rule.code, name: rule.name })), ...OTHER_STATES];
}

export function getStateRule(code: string): StateRule {
  const normalized = code.trim().toUpperCase();
  return (
    STATE_RULES.find((rule) => rule.code === normalized) ?? { ...FALLBACK_RULE, code: normalized }
  );
}

export function isKnownState(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return (
    STATE_RULES.some((rule) => rule.code === normalized) ||
    OTHER_STATES.some((s) => s.code === normalized)
  );
}

/**
 * Returns an advisory warning when a deposit exceeds the residential cap of an
 * adopting state. Returns null when there is nothing to warn about.
 */
export function depositCapWarning(
  stateCode: string,
  monthlyRentPaise: number,
  depositPaise: number,
): string | null {
  const rule = getStateRule(stateCode);
  if (rule.regime !== 'MTA' || rule.depositCapMonthsResidential === null) {
    return null;
  }
  if (monthlyRentPaise <= 0) {
    return null;
  }
  const capPaise = monthlyRentPaise * rule.depositCapMonthsResidential;
  if (depositPaise <= capPaise) {
    return null;
  }
  return `In ${rule.name}, the Model Tenancy Act caps a residential deposit at ${rule.depositCapMonthsResidential} months of rent. This deposit is higher. That is a legal question, not a product rule, so Makaan only flags it.`;
}

/** Returns the advisory statutory note used on statements for a state. */
export function statutoryNoteForState(stateCode: string): string {
  const rule = getStateRule(stateCode);
  if (rule.regime === 'MTA') {
    return `Advisory context: Model Tenancy Act 2021, Section 15(1) requires the premises to be kept in as good a condition as at commencement, except for normal wear and tear. ${rule.name} is an adopting state. This is not a legal determination.`;
  }
  return `Advisory context: ${rule.name} follows ${rule.notes} Normal wear and tear is not a tenant liability, but no Model Tenancy Act cap applies here. This is not a legal determination.`;
}
