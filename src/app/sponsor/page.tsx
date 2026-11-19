'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';

import { formatUsdc, toBaseUnits } from '@/lib/amounts';
import { explorerTx } from '@/lib/config';
import { humaniseError, SPONSOR_ERRORS } from '@/lib/errors';
import { sponsor as desk } from '@/lib/protocol';
import {
  percentToBps,
  parseCountries,
  parseServiceCodes,
  validateSponsorRules,
  type SponsorRules,
} from '@/lib/sponsor-rules';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/Toast';
import { Alert, Button, Card, Empty, ExplorerLink, Field } from '@/components/ui';
import { Skeleton } from '@/components/Skeleton';
import { useLocaleContext } from '@/i18n/LocaleContext';

/**
 * Matching-sponsor desk (#293).
 *
 * A sponsor deposits a budget, sets the rules it wants, and the contract
 * funds a second voucher for every qualifying voucher. Everything here is
 * read from and written to the sponsor contract directly; the indexer is
 * not in the path. With `NEXT_PUBLIC_SPONSOR_CONTRACT_ID` unset the page is
 * not linked and this component says so instead of making any call.
 */
export default function SponsorPage() {
  const { address, signTransaction, connect } = useWallet();
  const { t, locale } = useLocaleContext();
  const toast = useToast();

  const [busy, setBusy] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [matchId, setMatchId] = useState('');

  // null means "show the saved rule"; typing replaces it. This keeps the
  // form in step with the chain without a setState-in-effect prefill.
  const [matchPercent, setMatchPercent] = useState<string | null>(null);
  const [cap, setCap] = useState<string | null>(null);
  const [minimum, setMinimum] = useState<string | null>(null);
  const [ageDays, setAgeDays] = useState<string | null>(null);
  const [countries, setCountries] = useState<string | null>(null);
  const [services, setServices] = useState<string | null>(null);

  const enabled = desk.enabled();

  const {
    data: account,
    error: accountError,
    mutate: mutateAccount,
  } = useSWR(
    enabled && address ? ['sponsor-account', address] : null,
    () => desk.account(address!),
  );
  const {
    data: budget,
    error: budgetError,
    mutate: mutateBudget,
  } = useSWR(enabled ? ['sponsor-budget'] : null, () => desk.budgetSummary());

  const savedRules = account && account.rules.matchBps > 0 ? account.rules : null;
  const matchPercentValue = matchPercent ?? (savedRules ? String(savedRules.matchBps / 100) : '');
  const capValue = cap ?? (savedRules ? formatUsdc(savedRules.capPerVoucher, locale) : '');
  const minimumValue =
    minimum ?? (savedRules ? formatUsdc(savedRules.minVoucherAmount, locale) : '0');
  const ageDaysValue = ageDays ?? (savedRules ? String(Math.round(savedRules.minVoucherAgeSecs / 86_400)) : '0');
  const countriesValue = countries ?? (savedRules ? savedRules.eligibleCountries.join(', ') : '');
  const servicesValue =
    services ?? (savedRules ? savedRules.eligibleServiceCodes.join(', ') : '');

  function refresh() {
    void mutateAccount();
    void mutateBudget();
  }

  async function submit(key: string, fn: () => Promise<{ hash: string }>) {
    if (!address) {
      void connect();
      return;
    }
    setBusy(key);
    try {
      const res = await fn();
      refresh();
      toast.success(
        <>
          {t('common.submitted')}{' '}
          <ExplorerLink href={explorerTx(res.hash)}>
            {t('common.viewTransaction')}
          </ExplorerLink>
        </>,
      );
    } catch (err) {
      toast.error(humaniseError(err, SPONSOR_ERRORS, locale));
    } finally {
      setBusy(null);
    }
  }

  function amountFrom(value: string, allowZero = false): bigint | null {
    try {
      const amount = toBaseUnits(value);
      if (amount > 0n) return amount;
      return allowZero && amount === 0n ? amount : null;
    } catch {
      return null;
    }
  }

  function saveRules() {
    const matchBps = percentToBps(matchPercentValue);
    const capAmount = amountFrom(capValue);
    const minimumAmount = amountFrom(minimumValue || '0', true);
    const age = Number(ageDaysValue);
    if (matchBps === null) {
      toast.error(t('sponsor.error.matchBps'));
      return;
    }
    if (capAmount === null) {
      toast.error(t('sponsor.error.cap'));
      return;
    }
    if (minimumAmount === null) {
      toast.error(t('sponsor.error.minimum'));
      return;
    }
    const rules: SponsorRules = {
      matchBps,
      capPerVoucher: capAmount,
      minVoucherAmount: minimumAmount,
      minVoucherAgeSecs: Number.isFinite(age) ? Math.round(age * 86_400) : -1,
      eligibleCountries: parseCountries(countriesValue),
      eligibleServiceCodes: parseServiceCodes(servicesValue),
    };
    // Validate before the wallet is asked to sign: the contract would reject
    // the same rules, and a wallet prompt for a known-bad call is noise.
    const invalid = validateSponsorRules(rules);
    if (invalid) {
      toast.error(t(invalid));
      return;
    }
    void submit('rules', () => desk.setRules(address!, rules, signTransaction));
  }

  if (!enabled) {
    return <Empty>{t('sponsor.notConfigured')}</Empty>;
  }
  if (!address) {
    return <Empty>{t('sponsor.connectWallet')}</Empty>;
  }

  const rulesSet = account ? account.rules.matchBps > 0 : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {t('sponsor.title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-ink-soft)]">
          {t('sponsor.intro')}
        </p>
      </div>

      {(accountError || budgetError) && (
        <Alert>{humaniseError(accountError ?? budgetError, SPONSOR_ERRORS, locale)}</Alert>
      )}

      <section aria-labelledby="sponsor-budget" className="space-y-3">
        <h2 id="sponsor-budget" className="text-lg font-semibold">
          {t('sponsor.budget')}
        </h2>
        {!account || !budget ? (
          <Card className="space-y-3 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56" />
          </Card>
        ) : (
          <Card className="p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <BudgetItem label={t('sponsor.available')} value={budget.available} locale={locale} />
              <BudgetItem label={t('sponsor.deposited')} value={account.deposited} locale={locale} />
              <BudgetItem label={t('sponsor.committed')} value={account.committed} locale={locale} />
              <BudgetItem label={t('sponsor.withdrawn')} value={account.withdrawn} locale={locale} />
            </dl>
            <p className="mt-4 text-xs text-[var(--color-ink-soft)]">
              {t('sponsor.deskBalance')}: ${formatUsdc(budget.balance, locale)}
            </p>
          </Card>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h2 className="font-medium">{t('sponsor.deposit')}</h2>
          <Field label={t('sponsor.depositAmount')}>
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              aria-label={t('sponsor.depositAmount')}
              inputMode="decimal"
              className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </Field>
          <p className="text-xs text-[var(--color-ink-soft)]">
            {t('sponsor.depositNote')}
          </p>
          <Button
            disabled={busy !== null || amountFrom(depositAmount) === null}
            onClick={() =>
              void submit('deposit', () =>
                desk.deposit(address, amountFrom(depositAmount)!, signTransaction),
              )
            }
          >
            {busy === 'deposit' ? t('common.confirming') : t('sponsor.deposit')}
          </Button>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-medium">{t('sponsor.withdraw')}</h2>
          <Field label={t('sponsor.withdrawAmount')}>
            <input
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              aria-label={t('sponsor.withdrawAmount')}
              inputMode="decimal"
              className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </Field>
          <p className="text-xs text-[var(--color-ink-soft)]">
            {t('sponsor.withdrawNote')}
          </p>
          <Button
            variant="ghost"
            disabled={busy !== null || amountFrom(withdrawAmount) === null}
            onClick={() =>
              void submit('withdraw', () =>
                desk.withdraw(address, amountFrom(withdrawAmount)!, signTransaction),
              )
            }
          >
            {busy === 'withdraw' ? t('common.confirming') : t('sponsor.withdraw')}
          </Button>
        </Card>
      </div>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">{t('sponsor.rules')}</h2>
          <span className="text-xs text-[var(--color-ink-soft)]">
            {rulesSet ? '' : t('sponsor.notSet')}
          </span>
        </div>
        <p className="text-xs text-[var(--color-ink-soft)]">
          {t('sponsor.rulesNote')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('sponsor.matchPercent')}>
            <input
              value={matchPercentValue}
              onChange={(e) => setMatchPercent(e.target.value)}
              aria-label={t('sponsor.matchPercent')}
              inputMode="decimal"
              className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('sponsor.cap')}>
            <input
              value={capValue}
              onChange={(e) => setCap(e.target.value)}
              aria-label={t('sponsor.cap')}
              inputMode="decimal"
              className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('sponsor.minimum')}>
            <input
              value={minimumValue}
              onChange={(e) => setMinimum(e.target.value)}
              aria-label={t('sponsor.minimum')}
              inputMode="decimal"
              className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('sponsor.minAgeDays')}>
            <input
              value={ageDaysValue}
              onChange={(e) => setAgeDays(e.target.value.replace(/\D/g, ''))}
              aria-label={t('sponsor.minAgeDays')}
              inputMode="numeric"
              className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('sponsor.countries')}>
            <input
              value={countriesValue}
              onChange={(e) => setCountries(e.target.value)}
              aria-label={t('sponsor.countries')}
              placeholder="NG, KE"
              className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('sponsor.services')}>
            <input
              value={servicesValue}
              onChange={(e) => setServices(e.target.value)}
              aria-label={t('sponsor.services')}
              placeholder="101, 102"
              className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <Button disabled={busy !== null} onClick={saveRules}>
          {busy === 'rules' ? t('common.confirming') : t('sponsor.saveRules')}
        </Button>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-medium">{t('sponsor.matchVoucher')}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label={t('sponsor.voucherId')}>
              <input
                value={matchId}
                onChange={(e) => setMatchId(e.target.value.replace(/\D/g, ''))}
                aria-label={t('sponsor.voucherId')}
                inputMode="numeric"
                className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Button
            disabled={busy !== null || !matchId}
            onClick={() =>
              void submit('match', () =>
                desk.matchVoucher(address, matchId, signTransaction),
              )
            }
          >
            {busy === 'match' ? t('common.confirming') : t('sponsor.match')}
          </Button>
        </div>
        <p className="text-xs text-[var(--color-ink-soft)]">
          {t('sponsor.ruleSavedRefresh')}
        </p>
      </Card>

      <section aria-labelledby="sponsor-matches" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sponsor-matches" className="text-lg font-semibold">
            {t('sponsor.openMatches')}
          </h2>
          <Button variant="ghost" disabled={busy !== null} onClick={refresh}>
            {t('sponsor.reconcile')}
          </Button>
        </div>
        {!account || account.openMatches.length === 0 ? (
          <Empty>{t('sponsor.noOpenMatches')}</Empty>
        ) : (
          <Card className="divide-y divide-[var(--color-line)]">
            {account.openMatches.map((match) => (
              <div
                key={match.matchedVoucherId}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <Link
                  href={`/vouchers/${match.matchedVoucherId}`}
                  className="mono text-sm underline underline-offset-2"
                >
                  #{match.matchedVoucherId}
                </Link>
                <span className="mono text-sm">
                  ${formatUsdc(match.amount, locale)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function BudgetItem({
  label,
  value,
  locale,
}: {
  label: string;
  value: bigint;
  locale: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="mono mt-0.5 text-sm">${formatUsdc(value, locale)}</dd>
    </div>
  );
}
