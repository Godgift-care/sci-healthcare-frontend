'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useLocaleContext } from '@/i18n/LocaleContext';
import { isTestnet } from '@/lib/config';
import { markTourDone, useTourDone } from '@/lib/tour';

import { Button, Card, Modal } from './ui';

type Step = {
  title: string;
  body: string;
  href: string;
  cta: string;
};

/**
 * Optional guided tour for reviewers and first-time visitors: the three
 * steps that show the whole product (get test USDC, fund care, follow the
 * voucher).
 *
 * Offered as a card on the home page rather than an overlay that opens on
 * its own, so it never blocks navigation. Completing or dismissing it is
 * remembered (`src/lib/tour.ts`). The faucet step is testnet-only, so a
 * mainnet build leads with connecting a wallet instead.
 */
export function DemoTour() {
  const { t } = useLocaleContext();
  const done = useTourDone();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (done) return null;

  const steps: Step[] = [
    isTestnet
      ? {
          title: t('components.demoTour.steps.testUsdcTitle'),
          body: t('components.demoTour.steps.testUsdcBody'),
          href: '/my',
          cta: t('components.demoTour.steps.testUsdcCta'),
        }
      : {
          title: t('components.demoTour.steps.connectTitle'),
          body: t('components.demoTour.steps.connectBody'),
          href: '/my',
          cta: t('components.demoTour.steps.connectCta'),
        },
    {
      title: t('components.demoTour.steps.fundTitle'),
      body: t('components.demoTour.steps.fundBody'),
      href: '/',
      cta: t('components.demoTour.steps.fundCta'),
    },
    {
      title: t('components.demoTour.steps.followTitle'),
      body: t('components.demoTour.steps.followBody'),
      href: '/my',
      cta: t('components.demoTour.steps.followCta'),
    },
  ];

  const step = steps[index];
  const isLast = index === steps.length - 1;

  function finish() {
    setOpen(false);
    markTourDone();
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h2 className="text-sm font-semibold">{t('components.demoTour.title')}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {isTestnet
                ? t('components.demoTour.introTestnet')
                : t('components.demoTour.introMainnet')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setOpen(true)}>{t('components.demoTour.start')}</Button>
            <button
              type="button"
              onClick={finish}
              aria-label={t('components.demoTour.dismiss')}
              className="rounded-md px-2 py-1 text-lg leading-none text-[var(--color-ink-soft)] transition motion-reduce:transition-none hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
            >
              ×
            </button>
          </div>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={finish}
        title={t('components.demoTour.stepTitle', {
          step: index + 1,
          total: steps.length,
        })}
        actions={
          <>
            <Button
              variant="ghost"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              {t('components.demoTour.back')}
            </Button>
            {isLast ? (
              <Button onClick={finish}>{t('components.demoTour.finish')}</Button>
            ) : (
              <Button onClick={() => setIndex((i) => i + 1)}>
                {t('components.demoTour.next')}
              </Button>
            )}
            <Button variant="ghost" onClick={finish}>
              {t('components.demoTour.skip')}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{step.title}</h3>
          <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
            {step.body}
          </p>
          <Link
            href={step.href}
            onClick={finish}
            className="inline-block text-sm text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80"
          >
            {step.cta}{' '}
            {/* Points onwards, so it follows the reading direction (#131). */}
            <span aria-hidden className="inline-block rtl-flip">
              →
            </span>
          </Link>
        </div>
      </Modal>
    </>
  );
}
