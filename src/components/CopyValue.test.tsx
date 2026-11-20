// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyValue } from './CopyValue';

/**
 * CopyValue (#348, #78).
 *
 * The value is shortened on screen, so the copy button is the only way to get
 * the whole address out. Because the icon changes silently, the announcement
 * in the live region is the part that must work: it is what a screen reader
 * hears, and it keeps the button's accessible name stable.
 */

const ADDRESS = 'GCKX5KAFVF7GLFZ3JWQGJ4F62RYYZU67PI3TACBGKVPJ73JELMI3L4KR';

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

afterEach(cleanup);

it('copies the full value, not the shortened one', async () => {
  writeText.mockResolvedValue(undefined);
  render(<CopyValue value={ADDRESS} label="clinic address" />);

  fireEvent.click(screen.getByRole('button', { name: 'Copy clinic address' }));

  await waitFor(() => expect(writeText).toHaveBeenCalledWith(ADDRESS));
});

it('announces success without renaming the button', async () => {
  writeText.mockResolvedValue(undefined);
  render(<CopyValue value={ADDRESS} label="clinic address" />);

  fireEvent.click(screen.getByRole('button', { name: 'Copy clinic address' }));

  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('clinic address copied'),
  );
  // The accessible name never changes, so the button cannot be "lost".
  expect(screen.getByRole('button', { name: 'Copy clinic address' })).toBeTruthy();
});

it('says so when the clipboard refuses', async () => {
  writeText.mockRejectedValue(new Error('denied'));
  render(<CopyValue value={ADDRESS} label="clinic address" />);

  fireEvent.click(screen.getByRole('button', { name: 'Copy clinic address' }));

  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('Could not copy clinic address'),
  );
});

it('exposes the full value as the hover title', () => {
  render(<CopyValue value={ADDRESS} label="clinic address" />);
  expect(screen.getByRole('button', { name: 'Copy clinic address' }).getAttribute('title')).toBe(
    ADDRESS,
  );
});
