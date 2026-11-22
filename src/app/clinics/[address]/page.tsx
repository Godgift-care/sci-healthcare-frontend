'use client';

import type { Service } from '@sci-healthcare/client';
import { notFound, useSearchParams } from 'next/navigation';
import { use, useMemo, useState } from 'react';
import { StrKey } from '@stellar/stellar-sdk';

import { ApiError } from '@/lib/api';
import { useProvider, useVouchers } from '@/lib/hooks';
import { Alert } from '@/components/ui';
import { SkeletonDetail } from '@/components/Skeleton';
import {
  ClinicCheckout,
  ClinicHistory,
  ClinicProfileHeader,
  ClinicServiceList,
} from '@/components/clinic';

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  Active: {
    label: 'Active',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  PendingVerification: {
    label: 'Pending verification',
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  Suspended: {
    label: 'Suspended',
    className: 'bg-rose-50 text-rose-800 ring-rose-200',
  },
};

const UNKNOWN_STATUS = {
  label: 'Unknown',
  className: 'bg-slate-100 text-slate-700 ring-slate-200',
};

function isValidAddress(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value);
}

export default function ClinicPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const searchParams = useSearchParams();

  // Validate the route parameter before it reaches any API or contract call.
  if (!isValidAddress(address)) notFound();

  const { provider, error: loadError, rawError: loadRawError } = useProvider(address);
  const serviceParam = searchParams.get('service');
  const prefilledServiceCode =
    serviceParam && /^\d+$/.test(serviceParam) ? Number(serviceParam) : null;
  const prefilledService = provider?.services.find(
    (service) => service.code === prefilledServiceCode && service.active !== false,
  );

  const [selectedCodesOverride, setSelectedCodesOverride] = useState<number[] | null>(null);
  const firstActive = provider?.services.find((s) => s.active !== false) ?? null;
  const selectedCodes = useMemo(
    () =>
      selectedCodesOverride ??
      (prefilledService ? [prefilledService.code] : firstActive ? [firstActive.code] : []),
    [selectedCodesOverride, prefilledService, firstActive],
  );

  const setSelectedCodes = (update: (current: number[]) => number[]) =>
    setSelectedCodesOverride(update(selectedCodes));

  const selectedServices = useMemo(() => {
    if (!provider) return [] as Service[];
    return provider.services.filter((service) => selectedCodes.includes(service.code));
  }, [provider, selectedCodes]);

  const toggleService = (service: Service) => {
    setSelectedCodes((current) =>
      current.includes(service.code)
        ? current.filter((code) => code !== service.code)
        : [...current, service.code],
    );
  };

  const {
    total: settledCount,
    isLoading: loadingSettled,
    error: settledError,
  } = useVouchers({ provider: address, status: 'Settled', limit: 1 });

  // An unknown clinic is a missing page, not an API failure.
  if (loadRawError instanceof ApiError && loadRawError.status === 404) notFound();
  if (loadError) return <Alert>{loadError}</Alert>;
  if (!provider) {
    return <SkeletonDetail />;
  }

  const status = STATUS_BADGES[provider.status] ?? UNKNOWN_STATUS;
  const registeredAt = Number.isFinite(new Date(provider.registeredAt).getTime())
    ? String(provider.registeredAt)
    : null;
  const showSettled = !loadingSettled && !settledError;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <ClinicProfileHeader
          provider={provider}
          status={status}
          registeredAt={registeredAt}
          showSettled={showSettled}
          settledCount={settledCount}
        />

        <ClinicServiceList
          services={provider.services}
          selectedCodes={selectedCodes}
          onToggleService={toggleService}
        />

        <ClinicHistory address={provider.address} settledCount={settledCount} />
      </div>

      <ClinicCheckout
        provider={provider}
        selectedServices={selectedServices}
        prefilledServiceCode={prefilledServiceCode}
      />
    </div>
  );
}
