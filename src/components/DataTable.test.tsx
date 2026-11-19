// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DataTable, type DataTableColumn } from './DataTable';

/**
 * DataTable (#348).
 *
 * Sorting is the behaviour every list page relies on and the one thing that
 * cannot be seen in a screenshot: the order of the rows and the `aria-sort`
 * that tells a screen reader which column is active.
 */

afterEach(cleanup);

type Row = { name: string; amount: number };

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Clinic', accessor: (row) => row.name },
  { key: 'amount', header: 'Amount', accessor: (row) => row.amount, align: 'right' },
];

const rows: Row[] = [
  { name: 'Lekki Care Centre', amount: 3 },
  { name: 'Ikeja General Clinic', amount: 10 },
];

function bodyNames(): string[] {
  const [, body] = screen.getAllByRole('rowgroup');
  return within(body)
    .getAllByRole('row')
    .map((row) => row.querySelector('td, th')?.textContent ?? '');
}

it('sorts by the first column and says so', () => {
  render(
    <DataTable caption="Recent vouchers" columns={columns} rows={rows} getRowKey={(r) => r.name} />,
  );

  // A caption for screen readers, and a real button in each sortable header.
  expect(screen.getByText('Recent vouchers')).toBeTruthy();
  const header = screen.getByRole('button', { name: /Clinic/ });
  expect(header.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
  expect(bodyNames()).toEqual(['Ikeja General Clinic', 'Lekki Care Centre']);
});

it('reverses when the same header is activated again', () => {
  render(
    <DataTable caption="Recent vouchers" columns={columns} rows={rows} getRowKey={(r) => r.name} />,
  );

  fireEvent.click(screen.getByRole('button', { name: /Clinic/ }));
  expect(screen.getByRole('button', { name: /Clinic/ }).closest('th')?.getAttribute('aria-sort')).toBe(
    'descending',
  );
  expect(bodyNames()).toEqual(['Lekki Care Centre', 'Ikeja General Clinic']);
});

it('sorts a numeric column by value, not by text', () => {
  render(
    <DataTable caption="Recent vouchers" columns={columns} rows={rows} getRowKey={(r) => r.name} />,
  );

  fireEvent.click(screen.getByRole('button', { name: /Amount/ }));
  expect(bodyNames()).toEqual(['Lekki Care Centre', 'Ikeja General Clinic']);
  fireEvent.click(screen.getByRole('button', { name: /Amount/ }));
  expect(bodyNames()).toEqual(['Ikeja General Clinic', 'Lekki Care Centre']);
});

it('shows the empty message instead of an empty table', () => {
  render(<DataTable caption="Recent vouchers" columns={columns} rows={[]} getRowKey={(r) => r.name} />);
  expect(screen.getByText('No data recorded yet.')).toBeTruthy();
});
