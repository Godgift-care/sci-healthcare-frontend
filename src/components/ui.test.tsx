// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Alert, Button, Modal, StatusBadge } from './ui';

/**
 * Shared UI primitives (#348).
 *
 * Every page depends on these, so they were only tested through the slow
 * end-to-end runs. These ask the same questions a screen reader or keyboard
 * user would: what is the dialog called, where does focus go, what happens on
 * Escape, what does a disabled button announce.
 */

afterEach(cleanup);

describe('Modal', () => {
  it('is a modal dialog labelled by its title', () => {
    render(
      <Modal open onClose={() => {}} title="Confirm transaction">
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const heading = screen.getByRole('heading', { name: 'Confirm transaction' });
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('takes focus when it opens and gives it back when it closes', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();

    const { rerender } = render(
      <Modal open onClose={() => {}} title="Confirm">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);

    // Closing returns focus to whatever had it, so the keyboard is not lost.
    rerender(
      <Modal open={false} onClose={() => {}} title="Confirm">
        <p>Body</p>
      </Modal>,
    );
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Confirm">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the dialog', () => {
    render(
      <Modal open onClose={() => {}} title="Confirm" actions={<button>Confirm</button>}>
        <p>Body</p>
      </Modal>,
    );
    const close = screen.getByRole('button', { name: 'Close dialog' });
    close.focus();
    // Tab from the last focusable wraps to the first, never to the page.
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('renders nothing while closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Confirm">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Button', () => {
  it('is disabled while it is working', () => {
    render(<Button disabled>Fund voucher</Button>);
    const button = screen.getByRole('button', { name: 'Fund voucher' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Alert', () => {
  it('announces itself as an alert', () => {
    render(<Alert>Nothing was sent.</Alert>);
    expect(screen.getByRole('alert').textContent).toContain('Nothing was sent.');
  });
});

describe('StatusBadge', () => {
  it('names the state in text, not only in colour', () => {
    render(<StatusBadge status="Settled" />);
    expect(screen.getByText('Settled')).toBeTruthy();
  });
});
