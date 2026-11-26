// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadCsv } from './csv';

describe('downloadCsv (#316 coverage)', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'mock-url');
    revokeObjectURLSpy = vi.fn();
    appendChildSpy = vi.fn();
    removeSpy = vi.fn();
    clickSpy = vi.fn();

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    } as unknown as typeof URL);

    const link = {
      href: '',
      download: '',
      style: { display: '' },
      click: clickSpy,
      remove: removeSpy,
    };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => link),
      body: { appendChild: appendChildSpy },
    } as unknown as Document);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a blob URL, triggers a click, and cleans up', () => {
    downloadCsv('test.csv', [['a', 'b'], ['1', '2']]);
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('mock-url');
  });
});
