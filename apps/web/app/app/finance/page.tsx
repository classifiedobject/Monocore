'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type Category = {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
};

type Entry = {
  id: string;
  amount: string;
  date: string;
  description: string | null;
  category: Category;
};

type PnlRow = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

export default function FinancePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pnl, setPnl] = useState<PnlRow[]>([]);

  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  async function load() {
    try {
      const [categoryRows, entryRows, pnlRows] = await Promise.all([
        apiFetch('/app-api/finance/categories') as Promise<Category[]>,
        apiFetch('/app-api/finance/entries') as Promise<Entry[]>,
        apiFetch('/app-api/finance/pnl/monthly') as Promise<PnlRow[]>
      ]);

      setCategories(categoryRows);
      setEntries(entryRows);
      setPnl(pnlRows);

      if (!categoryId && categoryRows[0]) {
        setCategoryId(categoryRows[0].id);
      }
    } catch (error) {
      handleApiError(error);
    }
  }

  useEffect(() => {
    load().catch(handleApiError);
  }, []);

  async function createCategory(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/app-api/finance/categories', {
        method: 'POST',
        body: JSON.stringify({ name: categoryName, type: categoryType })
      });
      setCategoryName('');
      await load();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function deleteCategory(id: string) {
    try {
      await apiFetch(`/app-api/finance/categories/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({})
      });
      if (categoryId === id) setCategoryId('');
      await load();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createEntry(e: FormEvent) {
    e.preventDefault();
    if (!categoryId) return;

    try {
      await apiFetch('/app-api/finance/entries', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          amount: Number(amount),
          date,
          description: description || undefined
        })
      });
      setAmount('');
      setDescription('');
      await load();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function deleteEntry(id: string) {
    try {
      await apiFetch(`/app-api/finance/entries/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({})
      });
      await load();
    } catch (error) {
      handleApiError(error);
    }
  }

  const csvContent = useMemo(() => {
    const header = 'date,category,type,amount,description';
    const lines = entries.map((entry) => {
      const safeDescription = (entry.description ?? '').replace(/"/g, '""');
      return `${entry.date.slice(0, 10)},${entry.category.name},${entry.category.type},${entry.amount},"${safeDescription}"`;
    });
    return [header, ...lines].join('\n');
  }, [entries]);

  function exportCsv() {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finance-entries.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Finance Core Lite</h1>
        <p className="text-sm text-slate-600">Manage categories, entries and monthly P&amp;L.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Categories</h2>
          <form className="flex gap-2" onSubmit={createCategory}>
            <input
              className="flex-1 rounded border p-2"
              placeholder="Category name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
            />
            <select className="rounded border p-2" value={categoryType} onChange={(e) => setCategoryType(e.target.value as 'INCOME' | 'EXPENSE')}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
            <button className="rounded bg-mono-500 px-4 text-white">Add</button>
          </form>
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                <p className="text-sm">
                  {category.name} <span className="text-slate-500">({category.type})</span>
                </p>
                <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={() => deleteCategory(category.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">New Entry</h2>
          <form className="space-y-2" onSubmit={createEntry}>
            <select
              className="w-full rounded border p-2"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.type})
                </option>
              ))}
            </select>
            <input
              className="w-full rounded border p-2"
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <input className="w-full rounded border p-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <input
              className="w-full rounded border p-2"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button className="rounded bg-mono-500 px-4 py-2 text-white">Create Entry</button>
          </form>
        </article>
      </div>

      <article className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Monthly P&amp;L</h2>
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Month</th>
                <th className="py-2">Income</th>
                <th className="py-2">Expense</th>
                <th className="py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {pnl.map((row) => (
                <tr key={row.month} className="border-b border-slate-100">
                  <td className="py-2">{row.month}</td>
                  <td className="py-2">{row.income.toFixed(2)}</td>
                  <td className="py-2">{row.expense.toFixed(2)}</td>
                  <td className={`py-2 ${row.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{row.net.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Entries</h2>
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
              <div>
                <p>
                  {entry.date.slice(0, 10)} | {entry.category.name} ({entry.category.type}) | {entry.amount}
                </p>
                {entry.description ? <p className="text-slate-500">{entry.description}</p> : null}
              </div>
              <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={() => deleteEntry(entry.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
