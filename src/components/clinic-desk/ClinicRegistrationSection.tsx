import { Button, Card } from '@/components/ui';

export interface ClinicRegistrationSectionProps {
  name: string;
  setName: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  submitting: boolean;
  registerClinic: () => void;
  t: (key: string) => string;
}

export function ClinicRegistrationSection({
  name,
  setName,
  country,
  setCountry,
  submitting,
  registerClinic,
  t,
}: ClinicRegistrationSectionProps) {
  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-medium">{t('clinic.registerTitle')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('clinic.clinicName')}
          className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
        />
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
          placeholder={t('clinic.countryCode')}
          className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
        />
      </div>
      <Button
        disabled={submitting || !name || country.length !== 2}
        onClick={registerClinic}
      >
        {submitting ? t('common.confirming') : t('clinic.registerButton')}
      </Button>
    </Card>
  );
}
