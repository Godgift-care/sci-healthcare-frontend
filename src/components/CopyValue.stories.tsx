import type { Meta, StoryObj } from '@storybook/nextjs';

import { CopyValue } from './CopyValue';

/**
 * CopyValue (#349).
 *
 * The clipboard only works in a secure context, so the copy click may fail in
 * Storybook; the failed state is the one to look at for that. What the stories
 * show is the layout: shortened address, a name when one is known, and the
 * button-only form used beside a value that is already on screen.
 */

const ADDRESS = 'GCKX5KAFVF7GLFZ3JWQGJ4F62RYYZU67PI3TACBGKVPJ73JELMI3L4KR';

const meta: Meta<typeof CopyValue> = {
  title: 'Data/CopyValue',
  component: CopyValue,
};
export default meta;

type Story = StoryObj<typeof CopyValue>;

export const Address: Story = {
  args: { value: ADDRESS, label: 'clinic address' },
};

/** A known name replaces the shortened address. */
export const NamedClinic: Story = {
  args: { value: ADDRESS, label: 'clinic address', name: 'Ikeja General Clinic' },
};

/** Beside a value that is already displayed in full. */
export const ButtonOnly: Story = {
  args: { value: ADDRESS, label: 'transaction hash', buttonOnly: true },
};

/** A long hash is shortened the same way, with the whole value in the title. */
export const TransactionHash: Story = {
  args: { value: 'ab'.repeat(32), label: 'transaction hash', chars: 8 },
};
