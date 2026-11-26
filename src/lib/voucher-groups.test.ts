import { describe, expect, it } from 'vitest';

import type { Voucher } from './api';
import { groupVouchersByPatient, type SavedPatient } from './voucher-groups';

const MUM = 'aa'.repeat(32);
const UNCLE = 'bb'.repeat(32);
const STRANGER = 'cc'.repeat(32);

function voucher(id: string, beneficiaryRef: string): Voucher {
  return {
    id,
    funder: 'GFUNDER',
    beneficiaryRef,
    provider: { address: 'GCLINIC', name: 'Ikeja General Clinic', country: 'NG' },
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    status: 'Funded',
    createdAt: '2026-05-01T10:00:00.000Z',
    expiresAt: '2026-06-01T10:00:00.000Z',
    claimedAt: null,
    attestedAt: null,
    disputeDeadline: null,
    settledNet: null,
    settledFee: null,
    isSettleable: false,
    isRefundable: false,
  };
}

/** Just enough of a group to assert on without restating every voucher. */
function summarise(groups: ReturnType<typeof groupVouchersByPatient>) {
  return groups.map((g) => ({
    name: g.name,
    ref: g.ref,
    ids: g.vouchers.map((v) => v.id),
  }));
}

describe('groupVouchersByPatient', () => {
  it('groups a saved patient’s vouchers under their name', () => {
    const patients: SavedPatient[] = [{ name: 'Mum', ref: MUM }];
    const groups = groupVouchersByPatient(
      [voucher('1', MUM), voucher('2', MUM)],
      patients,
    );

    expect(summarise(groups)).toEqual([{ name: 'Mum', ref: MUM, ids: ['1', '2'] }]);
  });

  it('puts vouchers no saved key identifies into an unknown group', () => {
    const groups = groupVouchersByPatient(
      [
        voucher('1', MUM),
        voucher('2', STRANGER),
        voucher('3', UNCLE),
        voucher('4', STRANGER),
      ],
      [{ name: 'Mum', ref: MUM }],
    );

    expect(summarise(groups)).toEqual([
      { name: 'Mum', ref: MUM, ids: ['1'] },
      { name: null, ref: null, ids: ['2', '3', '4'] },
    ]);
  });

  it('keeps one group per saved patient, in the order saved', () => {
    const groups = groupVouchersByPatient(
      [voucher('1', UNCLE), voucher('2', MUM), voucher('3', UNCLE)],
      [
        { name: 'Mum', ref: MUM },
        { name: 'Uncle', ref: UNCLE },
      ],
    );

    expect(summarise(groups)).toEqual([
      { name: 'Mum', ref: MUM, ids: ['2'] },
      { name: 'Uncle', ref: UNCLE, ids: ['1', '3'] },
    ]);
  });

  it('preserves the incoming order inside each group', () => {
    const groups = groupVouchersByPatient(
      [voucher('3', MUM), voucher('1', MUM), voucher('2', MUM)],
      [{ name: 'Mum', ref: MUM }],
    );

    expect(groups[0].vouchers.map((v) => v.id)).toEqual(['3', '1', '2']);
  });

  it('leaves out saved patients with no vouchers', () => {
    const groups = groupVouchersByPatient(
      [voucher('1', MUM)],
      [
        { name: 'Mum', ref: MUM },
        { name: 'Uncle', ref: UNCLE },
      ],
    );

    expect(summarise(groups)).toEqual([{ name: 'Mum', ref: MUM, ids: ['1'] }]);
  });

  it('returns a single unknown group when nothing identifies the vouchers', () => {
    const groups = groupVouchersByPatient(
      [voucher('1', STRANGER), voucher('2', UNCLE)],
      [{ name: 'Mum', ref: MUM }],
    );

    expect(summarise(groups)).toEqual([
      { name: null, ref: null, ids: ['1', '2'] },
    ]);
  });

  it('ignores blank names and refs', () => {
    const groups = groupVouchersByPatient(
      [voucher('1', MUM)],
      [
        { name: '   ', ref: MUM },
        { name: 'Mum', ref: '' },
        { name: 'Mum', ref: MUM },
      ],
    );

    expect(summarise(groups)).toEqual([{ name: 'Mum', ref: MUM, ids: ['1'] }]);
  });

  it('lets the first saved name win for a duplicated reference', () => {
    const groups = groupVouchersByPatient(
      [voucher('1', MUM)],
      [
        { name: 'Mum', ref: MUM },
        { name: 'Mother', ref: MUM },
      ],
    );

    expect(summarise(groups)).toEqual([{ name: 'Mum', ref: MUM, ids: ['1'] }]);
  });

  it('has nothing to group when there are no vouchers', () => {
    expect(groupVouchersByPatient([], [{ name: 'Mum', ref: MUM }])).toEqual([]);
  });
});
