import type { ReadyStatus, VersionInfo } from './api';

/**
 * Registry status change reason codes.
 *
 * The registry records a reason code with each status change. These codes
 * are a shared convention between the app, the indexer and whoever resolves
 * status changes. Add codes, never renumber.
 */
export const REGISTRY_STATUS_REASONS = [
  { code: 1, label: 'Verified by administrator' },
  { code: 2, label: 'Suspended by administrator' },
  { code: 3, label: 'Retired by administrator' },
  { code: 4, label: 'Other' },
] as const;

export const REGISTRY_STATUS_REASONS_I18N: Record<string, Record<number, string>> = {
  en: {
    1: 'Verified by administrator',
    2: 'Suspended by administrator',
    3: 'Retired by administrator',
    4: 'Other',
  },
  fr: {
    1: 'Vérifié par l\'administrateur',
    2: 'Suspendu par l\'administrateur',
    3: 'Retiré par l\'administrateur',
    4: 'Autre',
  },
  sw: {
    1: 'Imehibitishwa na msimamizi',
    2: 'Imesimamishwa na msimamizi',
    3: 'Imesimamiwa na msimamizi',
    4: 'Saaidi',
  },
  yo: {
    1: 'Dìẹ́tà sí admini',
    2: 'Dìẹ́tà sí admini',
    3: 'Dìẹ́tà sí admini',
    4: 'Ìdá',
  },
};

export type RegistryStatusReasonCode = (typeof REGISTRY_STATUS_REASONS)[number]['code'];

export function registryStatusReasonLabel(
  code: number | null | undefined,
  locale = 'en',
): string | null {
  if (code === null || code === undefined) return null;
  const table = REGISTRY_STATUS_REASONS_I18N[locale] ?? REGISTRY_STATUS_REASONS_I18N.en;
  if (table && table[code]) {
    return table[code];
  }
  const fallback = REGISTRY_STATUS_REASONS.find((r) => r.code === code)?.label;
  if (fallback) return fallback;
  return locale === 'fr'
    ? `Motif #${code}`
    : locale === 'sw'
      ? `Sababu #${code}`
      : locale === 'yo'
        ? `Ìdí #${code}`
        : `Reason #${code}`;
}

/** Stellar closes a ledger roughly every five seconds. */
export const LEDGER_SECONDS = 5;

export type Overall = 'checking' | 'operational' | 'degraded' | 'unreachable';

export function overallStatus(
  ready: ReadyStatus | null,
  unreachable: boolean,
): Overall {
  if (ready) return ready.status === 'ready' ? 'operational' : 'degraded';
  return unreachable ? 'unreachable' : 'checking';
}

/** "12 ledgers behind (about 1 min)", or "Up to date". */
export function describeLag(lagLedgers: number | undefined): string {
  if (lagLedgers === undefined) return 'Not reported';
  if (lagLedgers <= 0) return 'Up to date';
  const seconds = lagLedgers * LEDGER_SECONDS;
  const approx =
    seconds < 60
      ? `${seconds}s`
      : seconds < 3600
        ? `${Math.round(seconds / 60)} min`
        : `${Math.round(seconds / 3600)} h`;
  return `${lagLedgers} ledger${lagLedgers === 1 ? '' : 's'} behind (about ${approx})`;
}

/**
 * One plain sentence per failing check, saying what a user will notice.
 * Empty when every reported check passes.
 */
export function readinessProblems(ready: ReadyStatus): string[] {
  const { checks } = ready;
  const problems: string[] = [];
  if (checks.database === false) {
    problems.push('The indexer cannot reach its database, so lists and vouchers may not load.');
  }
  if (typeof checks.lagLedgers === 'number' && checks.lagLedgers > 0) {
    problems.push(
      `The indexer is ${describeLag(checks.lagLedgers)}: recent funding, claims and ` +
        'attestations are on chain but may not show here yet.',
    );
  }
  if (checks.gapDetected === true) {
    problems.push(
      'The indexer found a gap in the ledger history it could fetch, so some past ' +
        'events may be missing from lists until it is backfilled.',
    );
  }
  if (ready.status === 'degraded' && problems.length === 0) {
    problems.push('The indexer reports itself degraded without naming a failing check.');
  }
  return problems;
}

/**
 * Differences between what this build signs for and what the indexer reads.
 * A mismatch means writes go to one deployment and reads come from another.
 */
export function deploymentMismatches(
  app: { network: string; contracts: { registry: string; voucher: string } },
  api: Pick<VersionInfo, 'network' | 'contracts'>,
): string[] {
  const out: string[] = [];
  if (api.network && api.network !== app.network) {
    out.push(`This app is built for ${app.network}, but the API indexes ${api.network}.`);
  }
  for (const name of ['registry', 'voucher'] as const) {
    const ours = app.contracts[name];
    const theirs = api.contracts?.[name];
    if (ours && theirs && ours !== theirs) {
      out.push(`The API indexes a different ${name} contract than this app writes to.`);
    }
  }
  return out;
}

/** First seven characters of a commit, the length git itself shows. */
export function shortCommit(commit: string | null | undefined): string | null {
  return commit ? commit.slice(0, 7) : null;
}
