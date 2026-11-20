import type { Meta, StoryObj } from '@storybook/nextjs';

import { DataTable, type DataTableColumn } from './DataTable';

/**
 * DataTable (#349).
 *
 * Sorting is the behaviour to look at: click a header and watch the rows and
 * the arrow move. The empty and long-content states are here because they are
 * the two that break layout.
 */

type Row = { clinic: string; service: string; amount: number };

const columns: DataTableColumn<Row>[] = [
  { key: 'clinic', header: 'Clinic', accessor: (row) => row.clinic },
  { key: 'service', header: 'Service', accessor: (row) => row.service },
  { key: 'amount', header: 'Amount', accessor: (row) => row.amount, align: 'right' },
];

const rows: Row[] = [
  { clinic: 'Ikeja General Clinic', service: 'Outpatient consult', amount: 3 },
  { clinic: 'Lekki Care Centre', service: 'Malaria test', amount: 5 },
  { clinic: 'Kano Community Health', service: 'Antenatal visit', amount: 10 },
];

const meta: Meta<typeof DataTable<Row>> = {
  title: 'Data/DataTable',
  component: DataTable,
};
export default meta;

type Story = StoryObj<typeof DataTable<Row>>;

export const Sorted: Story = {
  args: { caption: 'Recent vouchers', columns, rows, getRowKey: (row: Row) => row.clinic },
};

export const Empty: Story = {
  args: { caption: 'Recent vouchers', columns, rows: [], getRowKey: (row: Row) => row.clinic },
};

/** One value much longer than the rest: the table must not scroll sideways. */
export const LongContent: Story = {
  args: {
    caption: 'Recent vouchers',
    columns,
    rows: [
      {
        clinic: 'Saint Mary Mother of God Specialist Teaching Hospital and Referral Centre, Annex B',
        service: 'Comprehensive maternal and child health package including antenatal, delivery and postnatal review',
        amount: 1250,
      },
      ...rows,
    ],
    getRowKey: (row: Row) => row.clinic,
  },
};
