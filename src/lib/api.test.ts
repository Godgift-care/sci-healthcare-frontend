import { describe, expect, it } from 'vitest';

import { parseVoucherEvents } from './api';

/**
 * `GET /vouchers/:id/events` (#18, backend #13). The response envelope is
 * not settled yet and an indexer that predates the endpoint answers 404,
 * so parsing accepts both documented shapes and treats anything unexpected
 * as "no events" instead of throwing: the timeline then shows its dates
 * without links, which is the fallback the issue asks for.
 */
describe('parseVoucherEvents', () => {
  it('accepts a bare array of events', () => {
    const events = [
      { id: '0-1', name: 'voucher_created', txHash: 'HASHCREATE', voucherId: '1' },
      { id: '0-2', name: 'voucher_claimed', txHash: 'HASHCLAIM', voucherId: '1' },
    ];
    expect(parseVoucherEvents(events)).toEqual(events);
  });

  it('accepts an envelope carrying the rows', () => {
    const rows = [{ id: '0-1', name: 'voucher_created', txHash: 'HASHCREATE' }];
    expect(parseVoucherEvents({ total: 1, events: rows })).toEqual(rows);
    // Tolerates an envelope whose `events` is not a list.
    expect(parseVoucherEvents({ total: 1 })).toEqual([]);
  });

  it('reads an unavailable endpoint as "no events", not an error', () => {
    expect(parseVoucherEvents({ message: 'Not found' })).toEqual([]);
    expect(parseVoucherEvents({})).toEqual([]);
    expect(parseVoucherEvents(null)).toEqual([]);
    expect(parseVoucherEvents(undefined)).toEqual([]);
    expect(parseVoucherEvents('Not found')).toEqual([]);
  });

  it('drops malformed rows instead of failing the whole list', () => {
    const good = { id: '0-1', name: 'voucher_created', txHash: 'HASHCREATE' };
    expect(
      parseVoucherEvents([
        good,
        { id: '0-2', name: 'voucher_claimed', txHash: '' },
        { id: '0-3', txHash: 'HASHNONAME' },
        { id: '0-4', name: 'voucher_attested' },
        null,
        42,
      ]),
    ).toEqual([good]);
  });
});
