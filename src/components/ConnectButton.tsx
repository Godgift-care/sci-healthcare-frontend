'use client';

import { shortAddress } from '@/lib/amounts';
import { useWallet } from '@/lib/wallet';

import { Button } from './ui';

export function ConnectButton() {
  const { address, connecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <span className="mono rounded-md bg-[var(--color-brand-soft)] px-2.5 py-1 text-xs text-[var(--color-brand)]">
          {shortAddress(address, 6)}
        </span>
        <Button variant="ghost" onClick={() => void disconnect()}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={() => void connect()} disabled={connecting}>
      {connecting ? 'Connecting…' : 'Connect wallet'}
    </Button>
  );
}
