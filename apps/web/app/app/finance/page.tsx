'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type Category = {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
};

type Counterparty = {
  id: string;
  type: 'VENDOR' | 'CUSTOMER' | 'OTHER';
  name: string;
  email: string | null;
  phone: string | null;
};

type Account = {
  id: string;
  type: 'CASH' | 'BANK' | 'POS' | 'OTHER';
  name: string;
  currency: string;
  isActive: boolean;
};

type Entry = {
  id: string;
  amount: string;
  date: string;
  reference: string | null;
  description: string | null;
  category: Category;
  counterparty: Counterparty | null;
  account: Account | null;
};

type RecurringRule = {
  id: string;
  name: string;
  direction: 'INCOME' | 'EXPENSE';
  amount: string;
  frequency: 'WEEKLY' | 'MONTHLY';
  dayOfMonth: number | null;
  nextRunAt: string;
  isActive: boolean;
  category: Category;
  counterparty: Counterparty | null;
  account: Account | null;
};

type PnlMonthlyRow = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

type PnlReport = {
  totals: { income: number; expense: number; net: number };
  byCategory: Array<{ categoryId: string; categoryName: string; type: string; total: number }>;
};

type CashflowReport = {
  groupedByAccount: Array<{ accountId: string | null; accountName: string; income: number; expense: number; net: number }>;
};

type Capabilities = {
  manageCounterparty: boolean;
  manageAccount: boolean;
  manageRecurring: boolean;
  readReports: boolean;
  createEntry: boolean;
  deleteEntry: boolean;
};

type TabKey = 'entries' | 'counterparties' | 'accounts' | 'recurring' | 'reports';

export default function FinancePage() {
  const [tab, setTab] = useState<TabKey>('entries');
  const [categories, setCategories] = useState<Category[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [monthlyPnl, setMonthlyPnl] = useState<PnlMonthlyRow[]>([]);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities>({
    manageCounterparty: false,
    manageAccount: false,
    manageRecurring: false,
    readReports: false,
    createEntry: false,
    deleteEntry: false
  });

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;

  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  const [entryCategoryId, setEntryCategoryId] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(today);
  const [entryDescription, setEntryDescription] = useState('');
  const [entryReference, setEntryReference] = useState('');
  const [entryCounterpartyId, setEntryCounterpartyId] = useState('');
  const [entryAccountId, setEntryAccountId] = useState('');

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterCounterpartyId, setFilterCounterpartyId] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');

  const [counterpartyType, setCounterpartyType] = useState<'VENDOR' | 'CUSTOMER' | 'OTHER'>('VENDOR');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyEmail, setCounterpartyEmail] = useState('');
  const [counterpartyPhone, setCounterpartyPhone] = useState('');

  const [accountType, setAccountType] = useState<'CASH' | 'BANK' | 'POS' | 'OTHER'>('BANK');
  const [accountName, setAccountName] = useState('');
  const [accountCurrency, setAccountCurrency] = useState('TRY');

  const [ruleName, setRuleName] = useState('');
  const [ruleDirection, setRuleDirection] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [ruleCategoryId, setRuleCategoryId] = useState('');
  const [ruleAmount, setRuleAmount] = useState('');
  const [ruleFrequency, setRuleFrequency] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY');
  const [ruleDayOfMonth, setRuleDayOfMonth] = useState('1');
  const [ruleStartDate, setRuleStartDate] = useState(today);
  const [ruleNextRunAt, setRuleNextRunAt] = useState(today);
  const [ruleCounterpartyId, setRuleCounterpartyId] = useState('');
  const [ruleAccountId, setRuleAccountId] = useState('');

  const [reportFrom, setReportFrom] = useState(monthStart);
  const [reportTo, setReportTo] = useState(today);
  const [reportAccountId, setReportAccountId] = useState('');
  const [pnlReport, setPnlReport] = useState<PnlReport | null>(null);
  const [cashflowReport, setCashflowReport] = useState<CashflowReport | null>(null);

  async function loadCapabilities() {
    try {
      const caps = (await apiFetch('/app-api/finance/capabilities')) as Capabilities;
      setCapabilities(caps);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function loadMasterData() {
    try {
      const [categoryRows, counterpartyRows, accountRows] = await Promise.all([
        apiFetch('/app-api/finance/categories') as Promise<Category[]>,
        apiFetch('/app-api/finance/counterparties') as Promise<Counterparty[]>,
        apiFetch('/app-api/finance/accounts') as Promise<Account[]>
      ]);
      setCategories(categoryRows);
      setCounterparties(counterpartyRows);
      setAccounts(accountRows);

      if (!entryCategoryId && categoryRows[0]) {
        setEntryCategoryId(categoryRows[0].id);
      }
      if (!ruleCategoryId && categoryRows[0]) {
        setRuleCategoryId(categoryRows[0].id);
      }
    } catch (error) {
      handleApiError(error);
    }
  }

  async function loadEntries() {
    try {
      const query = new URLSearchParams();
      if (filterFrom) query.set('from', filterFrom);
      if (filterTo) query.set('to', filterTo);
      if (filterCategoryId) query.set('categoryId', filterCategoryId);
      if (filterCounterpartyId) query.set('counterpartyId', filterCounterpartyId);
      if (filterAccountId) query.set('accountId', filterAccountId);
      const suffix = query.toString() ? `?${query.toString()}` : '';

      const [entryRows, monthlyRows] = await Promise.all([
        apiFetch(`/app-api/finance/entries${suffix}`) as Promise<Entry[]>,
        apiFetch('/app-api/finance/pnl/monthly') as Promise<PnlMonthlyRow[]>
      ]);

      setEntries(entryRows);
      setMonthlyPnl(monthlyRows);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function loadRecurring() {
    try {
      const rows = (await apiFetch('/app-api/finance/recurring')) as RecurringRule[];
      setRecurring(rows);
    } catch (error) {
      handleApiError(error);
    }
  }

  useEffect(() => {
    loadCapabilities().catch(handleApiError);
    loadMasterData().catch(handleApiError);
    loadEntries().catch(handleApiError);
    loadRecurring().catch(handleApiError);
    // Initial module data load should run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCategory(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/app-api/finance/categories', {
        method: 'POST',
        body: JSON.stringify({ name: categoryName, type: categoryType })
      });
      setCategoryName('');
      await loadMasterData();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createEntry(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/app-api/finance/entries', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: entryCategoryId,
          amount: Number(entryAmount),
          date: entryDate,
          description: entryDescription || undefined,
          reference: entryReference || undefined,
          counterpartyId: entryCounterpartyId || null,
          accountId: entryAccountId || null
        })
      });
      setEntryAmount('');
      setEntryDescription('');
      setEntryReference('');
      await loadEntries();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function deleteEntry(id: string) {
    try {
      await apiFetch(`/app-api/finance/entries/${id}`, { method: 'DELETE', body: JSON.stringify({}) });
      await loadEntries();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createCounterparty(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/app-api/finance/counterparties', {
        method: 'POST',
        body: JSON.stringify({
          type: counterpartyType,
          name: counterpartyName,
          email: counterpartyEmail || null,
          phone: counterpartyPhone || null
        })
      });
      setCounterpartyName('');
      setCounterpartyEmail('');
      setCounterpartyPhone('');
      await loadMasterData();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function removeCounterparty(id: string) {
    try {
      await apiFetch(`/app-api/finance/counterparties/${id}`, { method: 'DELETE', body: JSON.stringify({}) });
      await loadMasterData();
      await loadEntries();
      await loadRecurring();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function editCounterparty(cp: Counterparty) {
    const nextName = window.prompt('Counterparty name', cp.name);
    if (!nextName) return;
    try {
      await apiFetch(`/app-api/finance/counterparties/${cp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName })
      });
      await loadMasterData();
      await loadEntries();
      await loadRecurring();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/app-api/finance/accounts', {
        method: 'POST',
        body: JSON.stringify({
          type: accountType,
          name: accountName,
          currency: accountCurrency
        })
      });
      setAccountName('');
      setAccountCurrency('TRY');
      await loadMasterData();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function deactivateAccount(id: string) {
    try {
      await apiFetch(`/app-api/finance/accounts/${id}`, { method: 'DELETE', body: JSON.stringify({}) });
      await loadMasterData();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function editAccount(acc: Account) {
    const nextName = window.prompt('Account name', acc.name);
    if (!nextName) return;
    try {
      await apiFetch(`/app-api/finance/accounts/${acc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName })
      });
      await loadMasterData();
      await loadEntries();
      await loadRecurring();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createRecurringRule(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/app-api/finance/recurring', {
        method: 'POST',
        body: JSON.stringify({
          name: ruleName,
          direction: ruleDirection,
          categoryId: ruleCategoryId,
          amount: Number(ruleAmount),
          startDate: ruleStartDate,
          frequency: ruleFrequency,
          dayOfMonth: ruleFrequency === 'MONTHLY' ? Number(ruleDayOfMonth) : null,
          nextRunAt: ruleNextRunAt,
          counterpartyId: ruleCounterpartyId || null,
          accountId: ruleAccountId || null,
          isActive: true
        })
      });
      setRuleName('');
      setRuleAmount('');
      await loadRecurring();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function runNow(id: string) {
    try {
      await apiFetch(`/app-api/finance/recurring/${id}/run-now`, { method: 'POST', body: JSON.stringify({}) });
      await Promise.all([loadRecurring(), loadEntries()]);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function editRecurring(rule: RecurringRule) {
    const nextName = window.prompt('Rule name', rule.name);
    if (!nextName) return;
    try {
      await apiFetch(`/app-api/finance/recurring/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName })
      });
      await loadRecurring();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function runDue() {
    try {
      await apiFetch('/app-api/finance/recurring/run-due', { method: 'POST', body: JSON.stringify({}) });
      await Promise.all([loadRecurring(), loadEntries()]);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function loadReports(e?: FormEvent) {
    e?.preventDefault();
    try {
      const pnlQuery = new URLSearchParams({ from: reportFrom, to: reportTo });
      const cfQuery = new URLSearchParams({ from: reportFrom, to: reportTo });
      if (reportAccountId) cfQuery.set('accountId', reportAccountId);

      const [pnlRows, cashRows] = await Promise.all([
        apiFetch(`/app-api/finance/reports/pnl?${pnlQuery.toString()}`) as Promise<PnlReport>,
        apiFetch(`/app-api/finance/reports/cashflow?${cfQuery.toString()}`) as Promise<CashflowReport>
      ]);
      setPnlReport(pnlRows);
      setCashflowReport(cashRows);
    } catch (error) {
      handleApiError(error);
    }
  }

  const csvContent = useMemo(() => {
    const header = 'date,category,type,counterparty,account,reference,amount,description';
    const lines = entries.map((entry) => {
      const safeDescription = (entry.description ?? '').replace(/"/g, '""');
      const safeReference = (entry.reference ?? '').replace(/"/g, '""');
      const cp = (entry.counterparty?.name ?? '').replace(/"/g, '""');
      const acc = (entry.account?.name ?? '').replace(/"/g, '""');
      return `${entry.date.slice(0, 10)},${entry.category.name},${entry.category.type},"${cp}","${acc}","${safeReference}",${entry.amount},"${safeDescription}"`;
    });
    return [header, ...lines].join('\n');
  }, [entries]);

  function exportCsv() {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finance-entries-pro.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Finance Core Pro</h1>
        <p className="text-sm text-slate-600">Entries, counterparties, accounts, recurring and reporting in one module.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['entries', 'Entries'],
          ['counterparties', 'Counterparties'],
          ['accounts', 'Accounts'],
          ['recurring', 'Recurring'],
          ['reports', 'Reports']
        ] as Array<[TabKey, string]>).map(([key, label]) => (
          <button
            key={key}
            className={`rounded px-3 py-2 text-sm ${tab === key ? 'bg-mono-500 text-white' : 'bg-white text-slate-700'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'entries' ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Categories</h2>
              <form className="flex gap-2" onSubmit={createCategory}>
                <input className="flex-1 rounded border p-2" placeholder="Category name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
                <select className="rounded border p-2" value={categoryType} onChange={(e) => setCategoryType(e.target.value as 'INCOME' | 'EXPENSE')}>
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
                <button className="rounded bg-mono-500 px-4 text-white">Add</button>
              </form>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                    {category.name} <span className="text-slate-500">({category.type})</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">New Entry</h2>
              {capabilities.createEntry ? (
                <form className="space-y-2" onSubmit={createEntry}>
                  <select className="w-full rounded border p-2" value={entryCategoryId} onChange={(e) => setEntryCategoryId(e.target.value)} required>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.type})
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="rounded border p-2" value={entryCounterpartyId} onChange={(e) => setEntryCounterpartyId(e.target.value)}>
                      <option value="">Counterparty (optional)</option>
                      {counterparties.map((cp) => (
                        <option key={cp.id} value={cp.id}>{cp.name}</option>
                      ))}
                    </select>
                    <select className="rounded border p-2" value={entryAccountId} onChange={(e) => setEntryAccountId(e.target.value)}>
                      <option value="">Account (optional)</option>
                      {accounts.filter((acc) => acc.isActive).map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <input className="w-full rounded border p-2" placeholder="Reference (invoice no etc.)" value={entryReference} onChange={(e) => setEntryReference(e.target.value)} />
                  <input className="w-full rounded border p-2" type="number" step="0.01" min="0" placeholder="Amount" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} required />
                  <input className="w-full rounded border p-2" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
                  <input className="w-full rounded border p-2" placeholder="Description" value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} />
                  <button className="rounded bg-mono-500 px-4 py-2 text-white">Create Entry</button>
                </form>
              ) : (
                <p className="text-sm text-slate-500">You do not have permission to create entries.</p>
              )}
            </article>
          </div>

          <article className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Entry Filters</h2>
            <div className="grid gap-2 md:grid-cols-5">
              <input className="rounded border p-2" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              <input className="rounded border p-2" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
              <select className="rounded border p-2" value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select className="rounded border p-2" value={filterCounterpartyId} onChange={(e) => setFilterCounterpartyId(e.target.value)}>
                <option value="">All counterparties</option>
                {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
              </select>
              <select className="rounded border p-2" value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}>
                <option value="">All accounts</option>
                {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
            </div>
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => loadEntries().catch(handleApiError)}>
              Apply Filters
            </button>
          </article>

          <article className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Monthly P&amp;L</h2>
              <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={exportCsv}>Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b"><th className="py-2">Month</th><th className="py-2">Income</th><th className="py-2">Expense</th><th className="py-2">Net</th></tr>
                </thead>
                <tbody>
                  {monthlyPnl.map((row) => (
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
                    <p className="text-slate-500">
                      Counterparty: {entry.counterparty?.name ?? '-'} | Account: {entry.account?.name ?? '-'} | Ref: {entry.reference ?? '-'}
                    </p>
                    {entry.description ? <p className="text-slate-500">{entry.description}</p> : null}
                  </div>
                  {capabilities.deleteEntry ? (
                    <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={() => deleteEntry(entry.id)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {tab === 'counterparties' ? (
        <div className="space-y-4">
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Counterparties</h2>
            {capabilities.manageCounterparty ? (
              <form className="grid gap-2 md:grid-cols-4" onSubmit={createCounterparty}>
                <select className="rounded border p-2" value={counterpartyType} onChange={(e) => setCounterpartyType(e.target.value as 'VENDOR' | 'CUSTOMER' | 'OTHER')}>
                  <option value="VENDOR">Vendor</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="OTHER">Other</option>
                </select>
                <input className="rounded border p-2" placeholder="Name" value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} required />
                <input className="rounded border p-2" placeholder="Email" value={counterpartyEmail} onChange={(e) => setCounterpartyEmail(e.target.value)} />
                <input className="rounded border p-2" placeholder="Phone" value={counterpartyPhone} onChange={(e) => setCounterpartyPhone(e.target.value)} />
                <button className="rounded bg-mono-500 px-4 py-2 text-white md:col-span-4">Create Counterparty</button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">You do not have permission to manage counterparties.</p>
            )}
          </article>

          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-2">
              {counterparties.map((cp) => (
                <div key={cp.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <p>{cp.name} ({cp.type}) {cp.email ? `| ${cp.email}` : ''}</p>
                  {capabilities.manageCounterparty ? (
                    <div className="flex gap-2">
                      <button className="rounded bg-slate-700 px-2 py-1 text-xs text-white" onClick={() => editCounterparty(cp)}>Edit</button>
                      <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={() => removeCounterparty(cp.id)}>Delete</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {tab === 'accounts' ? (
        <div className="space-y-4">
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Payment Accounts</h2>
            {capabilities.manageAccount ? (
              <form className="grid gap-2 md:grid-cols-4" onSubmit={createAccount}>
                <select className="rounded border p-2" value={accountType} onChange={(e) => setAccountType(e.target.value as 'CASH' | 'BANK' | 'POS' | 'OTHER')}>
                  <option value="BANK">Bank</option>
                  <option value="CASH">Cash</option>
                  <option value="POS">POS</option>
                  <option value="OTHER">Other</option>
                </select>
                <input className="rounded border p-2" placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
                <input className="rounded border p-2" placeholder="Currency" value={accountCurrency} onChange={(e) => setAccountCurrency(e.target.value.toUpperCase())} required />
                <button className="rounded bg-mono-500 px-4 py-2 text-white">Create Account</button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">You do not have permission to manage accounts.</p>
            )}
          </article>

          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <p>
                    {acc.name} ({acc.type}) [{acc.currency}] {acc.isActive ? '' : '(inactive)'}
                  </p>
                  {capabilities.manageAccount && acc.isActive ? (
                    <div className="flex gap-2">
                      <button className="rounded bg-slate-700 px-2 py-1 text-xs text-white" onClick={() => editAccount(acc)}>Edit</button>
                      <button className="rounded bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => deactivateAccount(acc.id)}>Deactivate</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {tab === 'recurring' ? (
        <div className="space-y-4">
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Recurring Rules</h2>
            {capabilities.manageRecurring ? (
              <form className="grid gap-2 md:grid-cols-3" onSubmit={createRecurringRule}>
                <input className="rounded border p-2" placeholder="Rule name" value={ruleName} onChange={(e) => setRuleName(e.target.value)} required />
                <select className="rounded border p-2" value={ruleDirection} onChange={(e) => setRuleDirection(e.target.value as 'INCOME' | 'EXPENSE')}>
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
                <select className="rounded border p-2" value={ruleCategoryId} onChange={(e) => setRuleCategoryId(e.target.value)} required>
                  <option value="">Category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <input className="rounded border p-2" type="number" step="0.01" min="0" placeholder="Amount" value={ruleAmount} onChange={(e) => setRuleAmount(e.target.value)} required />
                <select className="rounded border p-2" value={ruleFrequency} onChange={(e) => setRuleFrequency(e.target.value as 'MONTHLY' | 'WEEKLY')}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
                <input className="rounded border p-2" type="number" min="1" max="31" placeholder="Day of month" value={ruleDayOfMonth} onChange={(e) => setRuleDayOfMonth(e.target.value)} disabled={ruleFrequency !== 'MONTHLY'} />
                <input className="rounded border p-2" type="date" value={ruleStartDate} onChange={(e) => setRuleStartDate(e.target.value)} required />
                <input className="rounded border p-2" type="date" value={ruleNextRunAt} onChange={(e) => setRuleNextRunAt(e.target.value)} required />
                <select className="rounded border p-2" value={ruleCounterpartyId} onChange={(e) => setRuleCounterpartyId(e.target.value)}>
                  <option value="">Counterparty (optional)</option>
                  {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                </select>
                <select className="rounded border p-2" value={ruleAccountId} onChange={(e) => setRuleAccountId(e.target.value)}>
                  <option value="">Account (optional)</option>
                  {accounts.filter((acc) => acc.isActive).map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
                <button className="rounded bg-mono-500 px-4 py-2 text-white md:col-span-3">Create Rule</button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">You do not have permission to manage recurring rules.</p>
            )}
          </article>

          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Rules</h2>
              {capabilities.manageRecurring ? (
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => runDue().catch(handleApiError)}>Run Due</button>
              ) : null}
            </div>
            <div className="space-y-2">
              {recurring.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <p>
                    {rule.name} | {rule.direction} | {rule.amount} | next: {rule.nextRunAt.slice(0, 10)}
                  </p>
                  {capabilities.manageRecurring ? (
                    <div className="flex gap-2">
                      <button className="rounded bg-slate-700 px-2 py-1 text-xs text-white" onClick={() => editRecurring(rule)}>Edit</button>
                      <button className="rounded bg-mono-500 px-2 py-1 text-xs text-white" onClick={() => runNow(rule.id)}>Run now</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {tab === 'reports' ? (
        <div className="space-y-4">
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Reports</h2>
            {capabilities.readReports ? (
              <form className="grid gap-2 md:grid-cols-4" onSubmit={loadReports}>
                <input className="rounded border p-2" type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} required />
                <input className="rounded border p-2" type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} required />
                <select className="rounded border p-2" value={reportAccountId} onChange={(e) => setReportAccountId(e.target.value)}>
                  <option value="">All accounts</option>
                  {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Load Reports</button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">You do not have permission to read reports.</p>
            )}
          </article>

          {pnlReport ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">P&amp;L Totals</h3>
              <p className="text-sm">Income: {pnlReport.totals.income.toFixed(2)} | Expense: {pnlReport.totals.expense.toFixed(2)} | Net: {pnlReport.totals.net.toFixed(2)}</p>
              <div className="mt-3 space-y-1 text-sm">
                {pnlReport.byCategory.map((row) => (
                  <div key={row.categoryId} className="rounded border border-slate-200 px-3 py-2">
                    {row.categoryName} ({row.type}) : {row.total.toFixed(2)}
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {cashflowReport ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">Cashflow by Account</h3>
              <div className="space-y-1 text-sm">
                {cashflowReport.groupedByAccount.map((row) => (
                  <div key={row.accountId ?? 'unassigned'} className="rounded border border-slate-200 px-3 py-2">
                    {row.accountName}: income {row.income.toFixed(2)} | expense {row.expense.toFixed(2)} | net {row.net.toFixed(2)}
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
