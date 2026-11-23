'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Provider } from '@/lib/api';
import { useAdminAccess, useProviders } from '@/lib/hooks';
import { useWallet } from '@/lib/wallet';
import { useLocaleContext } from '@/i18n/LocaleContext';
import { Modal } from '@/components/ui';

type Command = {
  id: string;
  label: string;
  description: string;
  href: string;
};

type PageCommand = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  href: string;
};

const PAGES: PageCommand[] = [
  {
    id: 'clinics',
    labelKey: 'nav.clinics',
    descriptionKey: 'components.commandPalette.pages.clinics',
    href: '/',
  },
  {
    id: 'how-it-works',
    labelKey: 'nav.howItWorks',
    descriptionKey: 'components.commandPalette.pages.howItWorks',
    href: '/how-it-works',
  },
  {
    id: 'my-vouchers',
    labelKey: 'nav.myVouchers',
    descriptionKey: 'components.commandPalette.pages.myVouchers',
    href: '/my',
  },
  {
    id: 'clinic-desk',
    labelKey: 'nav.clinicDesk',
    descriptionKey: 'components.commandPalette.pages.clinicDesk',
    href: '/clinic',
  },
  {
    id: 'attest',
    labelKey: 'nav.attest',
    descriptionKey: 'components.commandPalette.pages.attest',
    href: '/attest',
  },
  {
    id: 'attesters',
    labelKey: 'nav.attesters',
    descriptionKey: 'components.commandPalette.pages.attesters',
    href: '/attesters',
  },
  {
    id: 'stats',
    labelKey: 'nav.stats',
    descriptionKey: 'components.commandPalette.pages.stats',
    href: '/stats',
  },
  {
    id: 'faq',
    labelKey: 'nav.faq',
    descriptionKey: 'components.commandPalette.pages.faq',
    href: '/faq',
  },
  {
    id: 'privacy',
    labelKey: 'nav.privacy',
    descriptionKey: 'components.commandPalette.pages.privacy',
    href: '/privacy',
  },
];

const ADMIN_PAGE: PageCommand = {
  id: 'admin',
  labelKey: 'components.commandPalette.pages.adminLabel',
  descriptionKey: 'components.commandPalette.pages.admin',
  href: '/admin',
};

type Translate = ReturnType<typeof useLocaleContext>['t'];

function clinicCommand(provider: Provider, t: Translate): Command {
  return {
    id: `clinic-${provider.address}`,
    label: provider.name,
    description: t('components.commandPalette.clinicCountry', {
      country: provider.country,
    }),
    href: `/clinics/${provider.address}`,
  };
}

function matches(command: Command, query: string): boolean {
  const value = query.trim().toLocaleLowerCase();
  return !value || `${command.label} ${command.description}`.toLocaleLowerCase().includes(value);
}

export function CommandPalette() {
  const router = useRouter();
  const { address } = useWallet();
  const { isAdmin } = useAdminAccess(address);
  const { t } = useLocaleContext();
  const [open, setOpen] = useState(false);
  // The palette is mounted in the root layout, so fetching here on mount
  // would make every page in the app read the clinic directory. Clinic
  // results are only ever shown while it is open.
  const { providers } = useProviders(open ? { status: 'Active' } : null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { commands, voucherCommand } = useMemo(() => {
    const term = query.trim();
    const pageCommands = isAdmin ? [...PAGES, ADMIN_PAGE] : PAGES;
    const pages = pageCommands
      .map(({ labelKey, descriptionKey, ...command }) => ({
        ...command,
        label: t(labelKey),
        description: t(descriptionKey),
      }))
      .filter((command) => matches(command, term));
    const clinics = term
      ? providers
          .filter((provider) =>
            `${provider.name} ${provider.country} ${provider.services.map((service) => service.label).join(' ')}`
              .toLocaleLowerCase()
              .includes(term.toLocaleLowerCase()),
          )
          .map((provider) => clinicCommand(provider, t))
      : [];
    const voucherId = term.replace(/^#/, '');
    const voucher = /^\d+$/.test(voucherId)
      ? {
          id: `voucher-${voucherId}`,
          label: t('components.commandPalette.openVoucher', { id: voucherId }),
          description: t('components.commandPalette.openVoucherDescription'),
          href: `/vouchers/${encodeURIComponent(voucherId)}`,
        }
      : null;
    return { commands: [...pages, ...clinics], voucherCommand: voucher };
  }, [isAdmin, providers, query, t]);
  const results = voucherCommand ? [voucherCommand, ...commands] : commands;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => {
          if (!current) {
            setQuery('');
            setActiveIndex(0);
          }
          return !current;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  function navigate(command: Command) {
    close();
    router.push(command.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index - 1 + results.length) % results.length : 0));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      navigate(results[activeIndex]);
    }
  }

  return (
    <Modal open={open} onClose={close} title={t('components.commandPalette.title')}>
      <label htmlFor="command-search" className="sr-only">
        {t('components.commandPalette.search')}
      </label>
      <input
        ref={inputRef}
        id="command-search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls="command-results"
        aria-activedescendant={results[activeIndex] ? `command-option-${activeIndex}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onInputKeyDown}
        placeholder={t('components.commandPalette.search')}
        className="h-12 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20"
      />
      <div
        id="command-results"
        role="listbox"
        aria-label={t('components.commandPalette.results')}
        className="mt-2 max-h-[min(55vh,24rem)] overflow-y-auto"
      >
        {results.map((command, index) => (
          <button
            key={command.id}
            type="button"
            id={`command-option-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            tabIndex={index === activeIndex ? 0 : -1}
            onFocus={() => setActiveIndex(index)}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => navigate(command)}
            className={`flex min-h-12 w-full cursor-pointer flex-col justify-center rounded-md border-0 bg-transparent px-3 py-2 text-start ${
              index === activeIndex
                ? 'bg-[var(--color-canvas)] text-[var(--color-ink)]'
                : 'text-[var(--color-ink-soft)]'
            }`}
          >
            <span className="font-medium text-[var(--color-ink)]">{command.label}</span>
            <span className="text-xs">{command.description}</span>
          </button>
        ))}
      </div>
      {results.length === 0 && (
        <p aria-live="polite" className="px-3 py-4 text-sm text-[var(--color-ink-soft)]">
          {t('components.commandPalette.noResults')}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {t('components.commandPalette.resultCount', { count: results.length })}
      </p>
    </Modal>
  );
}
