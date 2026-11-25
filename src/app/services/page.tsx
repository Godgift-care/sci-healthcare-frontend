import type { Metadata } from 'next';

import { ServicesCatalogue } from '@/components/ServicesCatalogue';
import { ServicesHeader } from '@/components/ServicesHeader';

export const metadata: Metadata = {
  title: 'Services — SCI Healthcare',
  description:
    'Search for the care you want to pay for and compare what clinics charge for it, then fund a voucher from the clinic page.',
};

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <ServicesHeader />
      <ServicesCatalogue />
    </div>
  );
}
