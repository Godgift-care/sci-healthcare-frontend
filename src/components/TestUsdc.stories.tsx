import type { Meta, StoryObj } from '@storybook/nextjs';

import { WalletProvider } from '@/lib/wallet';

import { TestUsdc } from './TestUsdc';

const meta: Meta<typeof TestUsdc> = {
  title: 'Faucet/TestUsdc',
  component: TestUsdc,
  decorators: [
    (Story) => (
      <WalletProvider>
        <div className="max-w-xl">
          <Story />
        </div>
      </WalletProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TestUsdc>;

/**
 * Disconnected wallet: shows the connect hint and the top-up button.
 * Requires NEXT_PUBLIC_FAUCET_CONTRACT_ID to render; without it the
 * component returns null (production hides it entirely).
 */
export const Disconnected: Story = {
  args: {},
};

export const Compact: Story = {
  args: { compact: true },
};
