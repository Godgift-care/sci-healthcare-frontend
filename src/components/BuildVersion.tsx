'use client';

import { useLocaleContext } from '@/i18n/LocaleContext';

export function BuildVersion() {
  const { t } = useLocaleContext();
  const commit = process.env.APP_COMMIT;

  if (!commit) return null;

  return (
    <span className="block">{t('footer.build', { commit })}</span>
  );
}
