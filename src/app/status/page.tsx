'use client';

import type { ReactNode } from 'react';

import { formatDate } from '@/lib/amounts';
import { config } from '@/lib/config';
import { useReady, useVersion } from '@/lib/hooks';
import {
  deploymentMismatches,
  describeLag,
  overallStatus,
  readinessProblems,
  shortCommit,
  type Overall,
} from '@/lib/status';
import { Alert, Button, Card } from '@/components/ui';
import { useLocaleContext } from '@/i18n/LocaleContext';
import { localeTag } from '@/i18n/translate';

/** Re-check readiness while the page is open; it is what people watch. */
const READY_REFRESH_MS = 30_000;

const HEADLINE_KIND: Record<Overall, 'success' | 'error' | 'info'> = {
  checking: 'info',
  operational: 'success',
  degraded: 'error',
  unreachable: 'error',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="text-sm text-[var(--color-ink-soft)]">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

function Check({ ok, okText, failText }: { ok: boolean | undefined; okText: string; failText: string }) {
  const { t } = useLocaleContext();
  if (ok === undefined) return <span className="text-[var(--color-ink-soft)]">{t('status.notReported')}</span>;
  return ok ? (
    <span className="text-[var(--color-ok)]">{okText}</span>
  ) : (
    <span className="text-[var(--color-danger)]">{failText}</span>
  );
}

/**
 * Service status (#168).
 *
 * Answers the first support question — "is it me, or is it down?" — by
 * showing the indexer's own readiness check, how far behind the chain it
 * is, which network it reads, and which versions are deployed. Everything
 * here comes from `GET /ready` and `GET /version`; nothing is inferred.
 */
export default function StatusPage() {
  const { t, locale } = useLocaleContext();
  const {
    ready,
    error: readyError,
    isValidating,
    mutate,
  } = useReady({ refreshInterval: READY_REFRESH_MS, shouldRetryOnError: false });
  const { version, error: versionError } = useVersion({ shouldRetryOnError: false });

  // A cached answer stays on screen while a refresh fails, so the page only
  // calls the API unreachable when there is no answer at all.
  const overall = overallStatus(ready, Boolean(readyError));
  const headlineKind = HEADLINE_KIND[overall];
  // A few ledgers of lag is normal; the reasons are listed only once the
  // indexer itself says it is degraded.
  const problems = ready?.status === 'degraded' ? readinessProblems(ready) : [];
  const mismatches = version ? deploymentMismatches(config, version) : [];
  const apiNetwork = version?.network ?? ready?.checks.network;
  const appCommit = shortCommit(process.env.APP_COMMIT);
  const apiCommit = shortCommit(version?.commit);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('status.title')}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {t('status.subtitle')}
          </p>
        </div>
        <Button variant="ghost" disabled={isValidating} onClick={() => void mutate()}>
          {isValidating ? t('status.checking') : t('status.checkAgain')}
        </Button>
      </div>

      <div role="status" aria-live="polite">
        <Alert kind={headlineKind}>
          <p className="font-semibold">{t(`status.headline.${overall}`)}</p>
          {overall === 'unreachable' && (
            <p className="mt-1">
              {t('status.unreachableBodyStart')}{' '}
              <span className="mono break-all">{config.apiUrl}</span>{' '}
              {t('status.unreachableBodyEnd')}
            </p>
          )}
          {problems.length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </Alert>
      </div>

      {mismatches.length > 0 && (
        <Alert>
          <p className="font-semibold">{t('status.mismatchTitle')}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {mismatches.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      )}

      <section aria-labelledby="status-api" className="space-y-2">
        <h2 id="status-api" className="text-base font-semibold">{t('status.apiReadiness')}</h2>
        <Card className="px-5 py-2">
          <dl className="divide-y divide-[var(--color-line)]">
            <Row label={t('status.readiness')}>
              {ready ? (
                <Check ok={ready.status === 'ready'} okText={t('status.ready')} failText={t('status.degraded')} />
              ) : overall === 'unreachable' ? (
                <span className="text-[var(--color-danger)]">{t('status.unreachable')}</span>
              ) : (
                '…'
              )}
            </Row>
            <Row label={t('status.database')}>
              {ready ? (
                <Check ok={ready.checks.database} okText={t('status.connected')} failText={t('status.unreachable')} />
              ) : (
                '—'
              )}
            </Row>
            <Row label={t('status.indexerLag')}>
              {ready ? describeLag(ready.checks.lagLedgers) : '—'}
            </Row>
            <Row label={t('status.latestIndexedLedger')}>
              {ready?.checks.indexedLedger !== undefined ? (
                <span className="mono">{ready.checks.indexedLedger.toLocaleString(localeTag(locale))}</span>
              ) : (
                '—'
              )}
            </Row>
            <Row label={t('status.ledgerHistory')}>
              {ready?.checks.gapDetected !== undefined ? (
                <Check ok={!ready.checks.gapDetected} okText={t('status.complete')} failText={t('status.gapDetected')} />
              ) : (
                '—'
              )}
            </Row>
          </dl>
        </Card>
      </section>

      <section aria-labelledby="status-network" className="space-y-2">
        <h2 id="status-network" className="text-base font-semibold">{t('status.network')}</h2>
        <Card className="px-5 py-2">
          <dl className="divide-y divide-[var(--color-line)]">
            <Row label={t('status.thisAppSignsFor')}>{config.network}</Row>
            <Row label={t('status.apiIndexes')}>{apiNetwork ?? '—'}</Row>
          </dl>
        </Card>
      </section>

      <section aria-labelledby="status-versions" className="space-y-2">
        <h2 id="status-versions" className="text-base font-semibold">{t('status.versions')}</h2>
        <Card className="px-5 py-2">
          <dl className="divide-y divide-[var(--color-line)]">
            <Row label={t('status.webApp')}>
              <span className="mono">
                {process.env.APP_VERSION ?? t('status.unknown')}
                {appCommit && ` (${appCommit})`}
              </span>
            </Row>
            <Row label={t('status.api')}>
              {version ? (
                <span className="mono">
                  {version.version}
                  {apiCommit && ` (${apiCommit})`}
                </span>
              ) : versionError ? (
                <span className="text-[var(--color-ink-soft)]">{t('status.notAvailable')}</span>
              ) : (
                '…'
              )}
            </Row>
            {version?.startedAt && (
              <Row label={t('status.apiRunningSince')}>{formatDate(version.startedAt, locale)}</Row>
            )}
          </dl>
        </Card>
      </section>
    </div>
  );
}
