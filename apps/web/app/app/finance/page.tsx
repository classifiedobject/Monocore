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

type ProfitCenter = {
  id: string;
  name: string;
  code: string | null;
  type: 'GENERAL' | 'SERVICE' | 'DEPARTMENT' | 'LOCATION' | 'EVENT' | 'OTHER';
  parentId: string | null;
  isActive: boolean;
  _count?: { entries: number };
};

type Entry = {
  id: string;
  amount: string;
  date: string;
  reference: string | null;
  description: string | null;
  isAllocationGenerated: boolean;
  category: Category;
  counterparty: Counterparty | null;
  account: Account | null;
  profitCenter: ProfitCenter | null;
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

type ProfitCenterPnlSummary = {
  items: Array<{ profitCenterId: string | null; profitCenterName: string; income: number; expense: number; net: number }>;
};

type ProfitCenterPnlDetail = {
  profitCenter: { id: string; name: string; code: string | null; type: string };
  totals: { income: number; expense: number; net: number };
  byCategory: Array<{ categoryId: string; categoryName: string; type: string; total: number }>;
};

type AllocationRule = {
  id: string;
  name: string;
  allocationMethod: 'PERCENTAGE';
  isActive: boolean;
  sourceCategoryId: string | null;
  sourceEntryId: string | null;
  targets: Array<{ id: string; profitCenterId: string; percentage: string; profitCenter: ProfitCenter }>;
};

type AllocationBatch = {
  id: string;
  sourceEntryId: string;
  createdAt: string;
  allocationRule: { id: string; name: string };
  generatedEntries: Array<{ id: string; amount: string; profitCenter: ProfitCenter | null }>;
};

type InvoiceLine = {
  id?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

type Invoice = {
  id: string;
  direction: 'PAYABLE' | 'RECEIVABLE';
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  subtotal: string;
  taxTotal: string;
  total: string;
  counterpartyId: string;
  counterparty: Counterparty;
  lines: Array<{ id: string; description: string; quantity: string; unitPrice: string; taxRate: string | null; lineTotal: string }>;
  paymentAllocations: Array<{ id: string; amount: string; paymentId: string }>;
};

type Payment = {
  id: string;
  direction: 'OUTGOING' | 'INCOMING';
  paymentDate: string;
  amount: string;
  counterpartyId: string;
  counterparty: Counterparty;
  account: Account | null;
  allocations: Array<{ id: string; invoiceId: string; amount: string }>;
};

type AgingReport = {
  totals: { current: number; b1_30: number; b31_60: number; b61_90: number; b90_plus: number; total: number };
  items: Array<{
    counterpartyId: string;
    counterpartyName: string;
    buckets: { current: number; b1_30: number; b31_60: number; b61_90: number; b90_plus: number; total: number };
  }>;
};

type CounterpartyBalanceReport = {
  items: Array<{ counterpartyId: string; counterpartyName: string; outstanding: number; invoiceCount: number }>;
  totalOutstanding: number;
};

type Capabilities = {
  manageCounterparty: boolean;
  manageAccount: boolean;
  manageRecurring: boolean;
  manageProfitCenter: boolean;
  readProfitCenter: boolean;
  readProfitCenterReports: boolean;
  readReports: boolean;
  manageAllocation: boolean;
  applyAllocation: boolean;
  readAllocation: boolean;
  manageInvoice: boolean;
  readInvoice: boolean;
  managePayment: boolean;
  readPayment: boolean;
  readAgingReport: boolean;
  createEntry: boolean;
  deleteEntry: boolean;
};

type TabKey = 'entries' | 'counterparties' | 'accounts' | 'invoices' | 'payments' | 'profit-centers' | 'recurring' | 'allocation' | 'reports';

export default function FinancePage() {
  const [tab, setTab] = useState<TabKey>('entries');
  const [categories, setCategories] = useState<Category[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [profitCenters, setProfitCenters] = useState<ProfitCenter[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [monthlyPnl, setMonthlyPnl] = useState<PnlMonthlyRow[]>([]);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [allocationRules, setAllocationRules] = useState<AllocationRule[]>([]);
  const [allocationBatches, setAllocationBatches] = useState<AllocationBatch[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities>({
    manageCounterparty: false,
    manageAccount: false,
    manageRecurring: false,
    manageProfitCenter: false,
    readProfitCenter: false,
    readProfitCenterReports: false,
    readReports: false,
    manageAllocation: false,
    applyAllocation: false,
    readAllocation: false,
    manageInvoice: false,
    readInvoice: false,
    managePayment: false,
    readPayment: false,
    readAgingReport: false,
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
  const [entryProfitCenterId, setEntryProfitCenterId] = useState('');

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterCounterpartyId, setFilterCounterpartyId] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterProfitCenterId, setFilterProfitCenterId] = useState('');

  const [counterpartyType, setCounterpartyType] = useState<'VENDOR' | 'CUSTOMER' | 'OTHER'>('VENDOR');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyEmail, setCounterpartyEmail] = useState('');
  const [counterpartyPhone, setCounterpartyPhone] = useState('');

  const [accountType, setAccountType] = useState<'CASH' | 'BANK' | 'POS' | 'OTHER'>('BANK');
  const [accountName, setAccountName] = useState('');
  const [accountCurrency, setAccountCurrency] = useState('TRY');

  const [profitCenterName, setProfitCenterName] = useState('');
  const [profitCenterCode, setProfitCenterCode] = useState('');
  const [profitCenterType, setProfitCenterType] = useState<'GENERAL' | 'SERVICE' | 'DEPARTMENT' | 'LOCATION' | 'EVENT' | 'OTHER'>('GENERAL');
  const [profitCenterParentId, setProfitCenterParentId] = useState('');
  const [showInactiveProfitCenters, setShowInactiveProfitCenters] = useState(false);

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

  const [allocationRuleName, setAllocationRuleName] = useState('');
  const [allocationRuleSourceCategoryId, setAllocationRuleSourceCategoryId] = useState('');
  const [allocationTargetCenterId, setAllocationTargetCenterId] = useState('');
  const [allocationTargetPercentage, setAllocationTargetPercentage] = useState('');
  const [allocationTargets, setAllocationTargets] = useState<Array<{ profitCenterId: string; percentage: number }>>([]);
  const [applyRuleId, setApplyRuleId] = useState('');
  const [applySourceEntryId, setApplySourceEntryId] = useState('');

  const [reportFrom, setReportFrom] = useState(monthStart);
  const [reportTo, setReportTo] = useState(today);
  const [reportAccountId, setReportAccountId] = useState('');
  const [reportAgingDirection, setReportAgingDirection] = useState<'PAYABLE' | 'RECEIVABLE'>('RECEIVABLE');
  const [pnlReport, setPnlReport] = useState<PnlReport | null>(null);
  const [cashflowReport, setCashflowReport] = useState<CashflowReport | null>(null);
  const [profitCenterSummary, setProfitCenterSummary] = useState<ProfitCenterPnlSummary | null>(null);
  const [profitCenterDetail, setProfitCenterDetail] = useState<ProfitCenterPnlDetail | null>(null);
  const [agingReport, setAgingReport] = useState<AgingReport | null>(null);
  const [counterpartyBalanceReport, setCounterpartyBalanceReport] = useState<CounterpartyBalanceReport | null>(null);

  const [invoiceDirection, setInvoiceDirection] = useState<'PAYABLE' | 'RECEIVABLE'>('PAYABLE');
  const [invoiceCounterpartyId, setInvoiceCounterpartyId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceIssueDate, setInvoiceIssueDate] = useState(today);
  const [invoiceDueDate, setInvoiceDueDate] = useState(today);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([{ description: '', quantity: '1', unitPrice: '', taxRate: '' }]);
  const [invoiceFilterDirection, setInvoiceFilterDirection] = useState('');
  const [invoiceFilterStatus, setInvoiceFilterStatus] = useState('');
  const [invoiceFilterCounterpartyId, setInvoiceFilterCounterpartyId] = useState('');

  const [paymentDirection, setPaymentDirection] = useState<'OUTGOING' | 'INCOMING'>('OUTGOING');
  const [paymentCounterpartyId, setPaymentCounterpartyId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentFilterDirection, setPaymentFilterDirection] = useState('');
  const [paymentFilterCounterpartyId, setPaymentFilterCounterpartyId] = useState('');
  const [allocationPaymentId, setAllocationPaymentId] = useState('');
  const [paymentAllocations, setPaymentAllocations] = useState<Array<{ invoiceId: string; amount: string }>>([]);

  async function loadCapabilities() {
    try {
      const caps = (await apiFetch('/app-api/finance/capabilities')) as Capabilities;
      setCapabilities(caps);
      return caps;
    } catch (error) {
      handleApiError(error);
      return null;
    }
  }

  async function loadMasterData(caps?: Capabilities | null) {
    try {
      const canReadProfitCenter = Boolean(caps?.readProfitCenter || caps?.manageProfitCenter);

      const [categoryRows, counterpartyRows, accountRows, profitCenterRows] = await Promise.all([
        apiFetch('/app-api/finance/categories') as Promise<Category[]>,
        apiFetch('/app-api/finance/counterparties') as Promise<Counterparty[]>,
        apiFetch('/app-api/finance/accounts') as Promise<Account[]>,
        canReadProfitCenter
          ? (apiFetch('/app-api/finance/profit-centers') as Promise<ProfitCenter[]>)
          : Promise.resolve([] as ProfitCenter[])
      ]);
      setCategories(categoryRows);
      setCounterparties(counterpartyRows);
      setAccounts(accountRows);
      setProfitCenters(profitCenterRows);

      if (!entryCategoryId && categoryRows[0]) setEntryCategoryId(categoryRows[0].id);
      if (!ruleCategoryId && categoryRows[0]) setRuleCategoryId(categoryRows[0].id);
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
      if (filterProfitCenterId) query.set('profitCenterId', filterProfitCenterId);
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

  async function loadAllocation() {
    try {
      if (!capabilities.readAllocation && !capabilities.manageAllocation && !capabilities.applyAllocation) {
        setAllocationRules([]);
        setAllocationBatches([]);
        return;
      }

      const [rules, batches] = await Promise.all([
        apiFetch('/app-api/finance/allocation-rules') as Promise<AllocationRule[]>,
        apiFetch('/app-api/finance/allocation-batches') as Promise<AllocationBatch[]>
      ]);
      setAllocationRules(rules);
      setAllocationBatches(batches);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function loadInvoices(caps?: Capabilities | null) {
    try {
      const canRead = Boolean(caps ? caps.readInvoice || caps.manageInvoice : capabilities.readInvoice || capabilities.manageInvoice);
      if (!canRead) {
        setInvoices([]);
        return;
      }

      const query = new URLSearchParams();
      if (invoiceFilterDirection) query.set('direction', invoiceFilterDirection);
      if (invoiceFilterStatus) query.set('status', invoiceFilterStatus);
      if (invoiceFilterCounterpartyId) query.set('counterpartyId', invoiceFilterCounterpartyId);
      const suffix = query.toString() ? `?${query.toString()}` : '';
      const rows = (await apiFetch(`/app-api/finance/invoices${suffix}`)) as Invoice[];
      setInvoices(rows);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function loadPayments(caps?: Capabilities | null) {
    try {
      const canRead = Boolean(caps ? caps.readPayment || caps.managePayment : capabilities.readPayment || capabilities.managePayment);
      if (!canRead) {
        setPayments([]);
        return;
      }

      const query = new URLSearchParams();
      if (paymentFilterDirection) query.set('direction', paymentFilterDirection);
      if (paymentFilterCounterpartyId) query.set('counterpartyId', paymentFilterCounterpartyId);
      const suffix = query.toString() ? `?${query.toString()}` : '';
      const rows = (await apiFetch(`/app-api/finance/payments${suffix}`)) as Payment[];
      setPayments(rows);
    } catch (error) {
      handleApiError(error);
    }
  }

  useEffect(() => {
    (async () => {
      const caps = await loadCapabilities();
      await loadMasterData(caps);
      await loadEntries();
      await loadRecurring();
      if (caps?.readInvoice || caps?.manageInvoice) await loadInvoices(caps);
      if (caps?.readPayment || caps?.managePayment) await loadPayments(caps);
      if (caps?.readAllocation || caps?.manageAllocation || caps?.applyAllocation) {
        const [rules, batches] = await Promise.all([
          apiFetch('/app-api/finance/allocation-rules') as Promise<AllocationRule[]>,
          apiFetch('/app-api/finance/allocation-batches') as Promise<AllocationBatch[]>
        ]);
        setAllocationRules(rules);
        setAllocationBatches(batches);
      }
    })().catch(handleApiError);
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
          accountId: entryAccountId || null,
          profitCenterId: entryProfitCenterId || null
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
        body: JSON.stringify({ type: counterpartyType, name: counterpartyName, email: counterpartyEmail || null, phone: counterpartyPhone || null })
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
    } catch (error) {
      handleApiError(error);
    }
  }

  async function editCounterparty(cp: Counterparty) {
    const nextName = window.prompt('Counterparty name', cp.name);
    if (!nextName) return;
    try {
      await apiFetch(`/app-api/finance/counterparties/${cp.id}`, { method: 'PATCH', body: JSON.stringify({ name: nextName }) });
      await loadMasterData();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/app-api/finance/accounts', {
        method: 'POST',
        body: JSON.stringify({ type: accountType, name: accountName, currency: accountCurrency })
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
      await apiFetch(`/app-api/finance/accounts/${acc.id}`, { method: 'PATCH', body: JSON.stringify({ name: nextName }) });
      await loadMasterData();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createProfitCenter(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/app-api/finance/profit-centers', {
        method: 'POST',
        body: JSON.stringify({
          name: profitCenterName,
          code: profitCenterCode || null,
          type: profitCenterType,
          parentId: profitCenterParentId || null
        })
      });
      setProfitCenterName('');
      setProfitCenterCode('');
      setProfitCenterParentId('');
      await loadMasterData();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function editProfitCenter(center: ProfitCenter) {
    const nextName = window.prompt('Profit center name', center.name);
    if (!nextName) return;
    try {
      await apiFetch(`/app-api/finance/profit-centers/${center.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName })
      });
      await loadMasterData();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function toggleProfitCenter(center: ProfitCenter, isActive: boolean) {
    try {
      if (!isActive) {
        await apiFetch(`/app-api/finance/profit-centers/${center.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: true })
        });
      } else {
        await apiFetch(`/app-api/finance/profit-centers/${center.id}`, {
          method: 'DELETE',
          body: JSON.stringify({})
        });
      }
      await loadMasterData();
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
      await apiFetch(`/app-api/finance/recurring/${rule.id}`, { method: 'PATCH', body: JSON.stringify({ name: nextName }) });
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

  function addAllocationTarget() {
    if (!allocationTargetCenterId || !allocationTargetPercentage) return;
    const percentage = Number(allocationTargetPercentage);
    if (!Number.isFinite(percentage) || percentage <= 0) return;
    setAllocationTargets((prev) => {
      if (prev.some((item) => item.profitCenterId === allocationTargetCenterId)) {
        return prev;
      }
      return [...prev, { profitCenterId: allocationTargetCenterId, percentage }];
    });
    setAllocationTargetCenterId('');
    setAllocationTargetPercentage('');
  }

  function removeAllocationTarget(profitCenterId: string) {
    setAllocationTargets((prev) => prev.filter((target) => target.profitCenterId !== profitCenterId));
  }

  async function createAllocationRule(e: FormEvent) {
    e.preventDefault();
    try {
      const total = allocationTargets.reduce((sum, target) => sum + target.percentage, 0);
      if (Math.abs(total - 100) > 0.0001) {
        window.alert('Allocation targets must total 100%.');
        return;
      }

      await apiFetch('/app-api/finance/allocation-rules', {
        method: 'POST',
        body: JSON.stringify({
          name: allocationRuleName,
          sourceCategoryId: allocationRuleSourceCategoryId || null,
          allocationMethod: 'PERCENTAGE',
          isActive: true,
          targets: allocationTargets
        })
      });
      setAllocationRuleName('');
      setAllocationRuleSourceCategoryId('');
      setAllocationTargets([]);
      await loadAllocation();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function toggleAllocationRule(rule: AllocationRule, nextActive: boolean) {
    try {
      await apiFetch(`/app-api/finance/allocation-rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive })
      });
      await loadAllocation();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function applyAllocation(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(`/app-api/finance/allocation-rules/${applyRuleId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ sourceEntryId: applySourceEntryId })
      });
      setApplySourceEntryId('');
      await Promise.all([loadAllocation(), loadEntries(), loadReports()]);
    } catch (error) {
      handleApiError(error);
    }
  }

  function updateInvoiceLine(index: number, key: keyof InvoiceLine, value: string) {
    setInvoiceLines((prev) => prev.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  }

  function addInvoiceLine() {
    setInvoiceLines((prev) => [...prev, { description: '', quantity: '1', unitPrice: '', taxRate: '' }]);
  }

  function removeInvoiceLine(index: number) {
    setInvoiceLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function createInvoice(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/app-api/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({
          direction: invoiceDirection,
          counterpartyId: invoiceCounterpartyId,
          invoiceNo,
          issueDate: invoiceIssueDate,
          dueDate: invoiceDueDate,
          lines: invoiceLines.map((line) => ({
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            taxRate: line.taxRate ? Number(line.taxRate) : null
          }))
        })
      });
      setInvoiceNo('');
      setInvoiceLines([{ description: '', quantity: '1', unitPrice: '', taxRate: '' }]);
      await loadInvoices();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function voidInvoice(id: string) {
    try {
      await apiFetch(`/app-api/finance/invoices/${id}/void`, { method: 'POST', body: JSON.stringify({}) });
      await loadInvoices();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function createPayment(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/app-api/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          direction: paymentDirection,
          counterpartyId: paymentCounterpartyId,
          accountId: paymentAccountId || null,
          paymentDate,
          amount: Number(paymentAmount),
          reference: paymentReference || null
        })
      });
      setPaymentAmount('');
      setPaymentReference('');
      await loadPayments();
    } catch (error) {
      handleApiError(error);
    }
  }

  function setPaymentAllocationAmount(invoiceId: string, amount: string) {
    setPaymentAllocations((prev) => {
      const found = prev.find((row) => row.invoiceId === invoiceId);
      if (found) {
        return prev.map((row) => (row.invoiceId === invoiceId ? { ...row, amount } : row));
      }
      return [...prev, { invoiceId, amount }];
    });
  }

  async function allocatePayment(e: FormEvent) {
    e.preventDefault();
    try {
      const allocations = paymentAllocations
        .filter((row) => Number(row.amount) > 0)
        .map((row) => ({ invoiceId: row.invoiceId, amount: Number(row.amount) }));

      await apiFetch(`/app-api/finance/payments/${allocationPaymentId}/allocate`, {
        method: 'POST',
        body: JSON.stringify({ allocations })
      });
      setPaymentAllocations([]);
      await Promise.all([loadPayments(), loadInvoices(), loadReports()]);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function loadReports(e?: FormEvent) {
    e?.preventDefault();
    try {
      const pnlQuery = new URLSearchParams({ from: reportFrom, to: reportTo });
      const cfQuery = new URLSearchParams({ from: reportFrom, to: reportTo });
      const pcQuery = new URLSearchParams({ from: reportFrom, to: reportTo });
      if (reportAccountId) cfQuery.set('accountId', reportAccountId);

      if (capabilities.readReports) {
        const [pnlRows, cashRows] = await Promise.all([
          apiFetch(`/app-api/finance/reports/pnl?${pnlQuery.toString()}`) as Promise<PnlReport>,
          apiFetch(`/app-api/finance/reports/cashflow?${cfQuery.toString()}`) as Promise<CashflowReport>
        ]);
        setPnlReport(pnlRows);
        setCashflowReport(cashRows);
      } else {
        setPnlReport(null);
        setCashflowReport(null);
      }

      if (capabilities.readProfitCenterReports) {
        const pcRows = (await apiFetch(`/app-api/finance/reports/pnl-by-profit-center?${pcQuery.toString()}`)) as ProfitCenterPnlSummary;
        setProfitCenterSummary(pcRows);
      } else {
        setProfitCenterSummary(null);
      }

      if (capabilities.readAgingReport) {
        const [agingRows, balanceRows] = await Promise.all([
          apiFetch(`/app-api/finance/reports/aging?direction=${reportAgingDirection}&asOf=${reportTo}`) as Promise<AgingReport>,
          apiFetch(`/app-api/finance/reports/counterparty-balance?direction=${reportAgingDirection}`) as Promise<CounterpartyBalanceReport>
        ]);
        setAgingReport(agingRows);
        setCounterpartyBalanceReport(balanceRows);
      } else {
        setAgingReport(null);
        setCounterpartyBalanceReport(null);
      }
      setProfitCenterDetail(null);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function loadProfitCenterDetail(profitCenterId: string | null) {
    if (profitCenterId === null) {
      setProfitCenterDetail(null);
      return;
    }
    try {
      const query = new URLSearchParams({ from: reportFrom, to: reportTo, profitCenterId });
      const detail = (await apiFetch(`/app-api/finance/reports/pnl-by-profit-center?${query.toString()}`)) as ProfitCenterPnlDetail;
      setProfitCenterDetail(detail);
    } catch (error) {
      handleApiError(error);
    }
  }

  const csvContent = useMemo(() => {
    const header = 'date,category,type,counterparty,account,profit_center,reference,amount,description';
    const lines = entries.map((entry) => {
      const safeDescription = (entry.description ?? '').replace(/"/g, '""');
      const safeReference = (entry.reference ?? '').replace(/"/g, '""');
      const cp = (entry.counterparty?.name ?? '').replace(/"/g, '""');
      const acc = (entry.account?.name ?? '').replace(/"/g, '""');
      const pc = (entry.profitCenter?.name ?? '').replace(/"/g, '""');
      return `${entry.date.slice(0, 10)},${entry.category.name},${entry.category.type},"${cp}","${acc}","${pc}","${safeReference}",${entry.amount},"${safeDescription}"`;
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

  const visibleProfitCenters = showInactiveProfitCenters ? profitCenters : profitCenters.filter((p) => p.isActive);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Finance Core Pro</h1>
        <p className="text-sm text-slate-600">Entries, profit centers, recurring rules and advanced reporting.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['entries', 'Entries'],
          ['counterparties', 'Counterparties'],
          ['accounts', 'Accounts'],
          ['invoices', 'Invoices'],
          ['payments', 'Payments'],
          ['profit-centers', 'Profit Centers'],
          ['recurring', 'Recurring'],
          ['allocation', 'Allocation'],
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
            </article>

            <article className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">New Entry</h2>
              {capabilities.createEntry ? (
                <form className="space-y-2" onSubmit={createEntry}>
                  <select className="w-full rounded border p-2" value={entryCategoryId} onChange={(e) => setEntryCategoryId(e.target.value)} required>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name} ({category.type})</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <select className="rounded border p-2" value={entryCounterpartyId} onChange={(e) => setEntryCounterpartyId(e.target.value)}>
                      <option value="">Counterparty</option>
                      {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                    </select>
                    <select className="rounded border p-2" value={entryAccountId} onChange={(e) => setEntryAccountId(e.target.value)}>
                      <option value="">Account</option>
                      {accounts.filter((acc) => acc.isActive).map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                    <select className="rounded border p-2" value={entryProfitCenterId} onChange={(e) => setEntryProfitCenterId(e.target.value)}>
                      <option value="">Profit Center</option>
                      {profitCenters.filter((pc) => pc.isActive).map((pc) => <option key={pc.id} value={pc.id}>{pc.name}</option>)}
                    </select>
                  </div>
                  <input className="w-full rounded border p-2" placeholder="Reference" value={entryReference} onChange={(e) => setEntryReference(e.target.value)} />
                  <input className="w-full rounded border p-2" type="number" step="0.01" min="0" placeholder="Amount" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} required />
                  <input className="w-full rounded border p-2" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
                  <input className="w-full rounded border p-2" placeholder="Description" value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} />
                  <button className="rounded bg-mono-500 px-4 py-2 text-white">Create Entry</button>
                </form>
              ) : <p className="text-sm text-slate-500">You do not have permission to create entries.</p>}
            </article>
          </div>

          <article className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Entry Filters</h2>
            <div className="grid gap-2 md:grid-cols-6">
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
              <select className="rounded border p-2" value={filterProfitCenterId} onChange={(e) => setFilterProfitCenterId(e.target.value)}>
                <option value="">All profit centers</option>
                {profitCenters.map((pc) => <option key={pc.id} value={pc.id}>{pc.name}</option>)}
              </select>
            </div>
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => loadEntries().catch(handleApiError)}>Apply Filters</button>
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
                      {entry.isAllocationGenerated ? ' | Allocated' : ''}
                    </p>
                    <p className="text-slate-500">Counterparty: {entry.counterparty?.name ?? '-'} | Account: {entry.account?.name ?? '-'} | Profit Center: {entry.profitCenter?.name ?? '-'}</p>
                    {entry.description ? <p className="text-slate-500">{entry.description}</p> : null}
                  </div>
                  {capabilities.deleteEntry ? <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={() => deleteEntry(entry.id)}>Delete</button> : null}
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
                  <option value="VENDOR">Vendor</option><option value="CUSTOMER">Customer</option><option value="OTHER">Other</option>
                </select>
                <input className="rounded border p-2" placeholder="Name" value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} required />
                <input className="rounded border p-2" placeholder="Email" value={counterpartyEmail} onChange={(e) => setCounterpartyEmail(e.target.value)} />
                <input className="rounded border p-2" placeholder="Phone" value={counterpartyPhone} onChange={(e) => setCounterpartyPhone(e.target.value)} />
                <button className="rounded bg-mono-500 px-4 py-2 text-white md:col-span-4">Create Counterparty</button>
              </form>
            ) : <p className="text-sm text-slate-500">You do not have permission to manage counterparties.</p>}
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
                  <option value="BANK">Bank</option><option value="CASH">Cash</option><option value="POS">POS</option><option value="OTHER">Other</option>
                </select>
                <input className="rounded border p-2" placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
                <input className="rounded border p-2" placeholder="Currency" value={accountCurrency} onChange={(e) => setAccountCurrency(e.target.value.toUpperCase())} required />
                <button className="rounded bg-mono-500 px-4 py-2 text-white">Create Account</button>
              </form>
            ) : <p className="text-sm text-slate-500">You do not have permission to manage accounts.</p>}
          </article>
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <p>{acc.name} ({acc.type}) [{acc.currency}] {acc.isActive ? '' : '(inactive)'}</p>
                  {capabilities.manageAccount ? (
                    <div className="flex gap-2">
                      <button className="rounded bg-slate-700 px-2 py-1 text-xs text-white" onClick={() => editAccount(acc)}>Edit</button>
                      {acc.isActive ? <button className="rounded bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => deactivateAccount(acc.id)}>Deactivate</button> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {tab === 'invoices' ? (
        <div className="space-y-4">
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Invoices</h2>
            {capabilities.manageInvoice ? (
              <form className="space-y-3" onSubmit={createInvoice}>
                <div className="grid gap-2 md:grid-cols-5">
                  <select className="rounded border p-2" value={invoiceDirection} onChange={(e) => setInvoiceDirection(e.target.value as 'PAYABLE' | 'RECEIVABLE')}>
                    <option value="PAYABLE">Payable</option>
                    <option value="RECEIVABLE">Receivable</option>
                  </select>
                  <select className="rounded border p-2" value={invoiceCounterpartyId} onChange={(e) => setInvoiceCounterpartyId(e.target.value)} required>
                    <option value="">Counterparty</option>
                    {counterparties.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.name}
                      </option>
                    ))}
                  </select>
                  <input className="rounded border p-2" placeholder="Invoice No" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} required />
                  <input className="rounded border p-2" type="date" value={invoiceIssueDate} onChange={(e) => setInvoiceIssueDate(e.target.value)} required />
                  <input className="rounded border p-2" type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  {invoiceLines.map((line, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-5">
                      <input
                        className="rounded border p-2 md:col-span-2"
                        placeholder="Line description"
                        value={line.description}
                        onChange={(e) => updateInvoiceLine(index, 'description', e.target.value)}
                        required
                      />
                      <input className="rounded border p-2" type="number" min="0.0001" step="0.0001" placeholder="Qty" value={line.quantity} onChange={(e) => updateInvoiceLine(index, 'quantity', e.target.value)} required />
                      <input className="rounded border p-2" type="number" min="0" step="0.01" placeholder="Unit Price" value={line.unitPrice} onChange={(e) => updateInvoiceLine(index, 'unitPrice', e.target.value)} required />
                      <div className="flex gap-2">
                        <input className="w-full rounded border p-2" type="number" min="0" step="0.01" placeholder="Tax %" value={line.taxRate} onChange={(e) => updateInvoiceLine(index, 'taxRate', e.target.value)} />
                        <button type="button" className="rounded bg-red-600 px-3 text-xs text-white" onClick={() => removeInvoiceLine(index)} disabled={invoiceLines.length === 1}>
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={addInvoiceLine}>
                    Add Line
                  </button>
                  <button className="rounded bg-mono-500 px-3 py-2 text-sm text-white">Create Invoice</button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-slate-500">You do not have permission to manage invoices.</p>
            )}
          </article>

          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 grid gap-2 md:grid-cols-4">
              <select className="rounded border p-2" value={invoiceFilterDirection} onChange={(e) => setInvoiceFilterDirection(e.target.value)}>
                <option value="">All directions</option>
                <option value="PAYABLE">Payable</option>
                <option value="RECEIVABLE">Receivable</option>
              </select>
              <select className="rounded border p-2" value={invoiceFilterStatus} onChange={(e) => setInvoiceFilterStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ISSUED">Issued</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
                <option value="VOID">Void</option>
              </select>
              <select className="rounded border p-2" value={invoiceFilterCounterpartyId} onChange={(e) => setInvoiceFilterCounterpartyId(e.target.value)}>
                <option value="">All counterparties</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </select>
              <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => loadInvoices().catch(handleApiError)}>
                Load
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {invoices.map((invoice) => {
                const allocated = invoice.paymentAllocations.reduce((sum, row) => sum + Number(row.amount), 0);
                const remaining = Number(invoice.total) - allocated;
                return (
                  <div key={invoice.id} className="rounded border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p>
                        {invoice.invoiceNo} | {invoice.direction} | {invoice.counterparty.name} | total {invoice.total} | remaining {remaining.toFixed(2)} | {invoice.status}
                      </p>
                      {capabilities.manageInvoice ? (
                        <button className="rounded bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => voidInvoice(invoice.id)}>
                          Void
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      ) : null}

      {tab === 'payments' ? (
        <div className="space-y-4">
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Payments</h2>
            {capabilities.managePayment ? (
              <form className="grid gap-2 md:grid-cols-6" onSubmit={createPayment}>
                <select className="rounded border p-2" value={paymentDirection} onChange={(e) => setPaymentDirection(e.target.value as 'OUTGOING' | 'INCOMING')}>
                  <option value="OUTGOING">Outgoing</option>
                  <option value="INCOMING">Incoming</option>
                </select>
                <select className="rounded border p-2" value={paymentCounterpartyId} onChange={(e) => setPaymentCounterpartyId(e.target.value)} required>
                  <option value="">Counterparty</option>
                  {counterparties.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name}
                    </option>
                  ))}
                </select>
                <select className="rounded border p-2" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                  <option value="">Account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
                <input className="rounded border p-2" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                <input className="rounded border p-2" type="number" min="0.01" step="0.01" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required />
                <input className="rounded border p-2" placeholder="Reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                <button className="rounded bg-mono-500 px-3 py-2 text-sm text-white md:col-span-6">Create Payment</button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">You do not have permission to manage payments.</p>
            )}
          </article>

          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <select className="rounded border p-2" value={paymentFilterDirection} onChange={(e) => setPaymentFilterDirection(e.target.value)}>
                <option value="">All directions</option>
                <option value="OUTGOING">Outgoing</option>
                <option value="INCOMING">Incoming</option>
              </select>
              <select className="rounded border p-2" value={paymentFilterCounterpartyId} onChange={(e) => setPaymentFilterCounterpartyId(e.target.value)}>
                <option value="">All counterparties</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </select>
              <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => loadPayments().catch(handleApiError)}>
                Load
              </button>
            </div>

            <div className="space-y-2 text-sm">
              {payments.map((payment) => {
                const allocated = payment.allocations.reduce((sum, row) => sum + Number(row.amount), 0);
                const remaining = Number(payment.amount) - allocated;
                return (
                  <div key={payment.id} className="rounded border border-slate-200 px-3 py-2">
                    <p>
                      {payment.paymentDate.slice(0, 10)} | {payment.direction} | {payment.counterparty.name} | amount {payment.amount} | remaining {remaining.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </article>

          {capabilities.managePayment ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-semibold">Allocate Payment</h3>
              <form className="space-y-3" onSubmit={allocatePayment}>
                <select className="w-full rounded border p-2" value={allocationPaymentId} onChange={(e) => setAllocationPaymentId(e.target.value)} required>
                  <option value="">Select payment</option>
                  {payments.map((payment) => (
                    <option key={payment.id} value={payment.id}>
                      {payment.paymentDate.slice(0, 10)} | {payment.counterparty.name} | {payment.amount}
                    </option>
                  ))}
                </select>
                <div className="space-y-2">
                  {invoices
                    .filter((invoice) => {
                      const payment = payments.find((item) => item.id === allocationPaymentId);
                      if (!payment) return false;
                      const expectedInvoiceDirection = payment.direction === 'INCOMING' ? 'RECEIVABLE' : 'PAYABLE';
                      return invoice.counterpartyId === payment.counterpartyId && invoice.direction === expectedInvoiceDirection && invoice.status !== 'VOID';
                    })
                    .map((invoice) => {
                      const alreadyAllocated = invoice.paymentAllocations.reduce((sum, row) => sum + Number(row.amount), 0);
                      const outstanding = Number(invoice.total) - alreadyAllocated;
                      return (
                        <div key={invoice.id} className="grid gap-2 md:grid-cols-4">
                          <p className="rounded border border-slate-200 px-2 py-2">{invoice.invoiceNo}</p>
                          <p className="rounded border border-slate-200 px-2 py-2">Outstanding: {outstanding.toFixed(2)}</p>
                          <input
                            className="rounded border p-2"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Allocate amount"
                            value={paymentAllocations.find((row) => row.invoiceId === invoice.id)?.amount ?? ''}
                            onChange={(e) => setPaymentAllocationAmount(invoice.id, e.target.value)}
                          />
                        </div>
                      );
                    })}
                </div>
                <button className="rounded bg-mono-500 px-3 py-2 text-sm text-white">Allocate</button>
              </form>
            </article>
          ) : null}
        </div>
      ) : null}

      {tab === 'profit-centers' ? (
        <div className="space-y-4">
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Profit Centers</h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showInactiveProfitCenters} onChange={(e) => setShowInactiveProfitCenters(e.target.checked)} />
                Show inactive
              </label>
            </div>
            {capabilities.manageProfitCenter ? (
              <form className="grid gap-2 md:grid-cols-5" onSubmit={createProfitCenter}>
                <input className="rounded border p-2" placeholder="Name" value={profitCenterName} onChange={(e) => setProfitCenterName(e.target.value)} required />
                <input className="rounded border p-2" placeholder="Code" value={profitCenterCode} onChange={(e) => setProfitCenterCode(e.target.value)} />
                <select className="rounded border p-2" value={profitCenterType} onChange={(e) => setProfitCenterType(e.target.value as ProfitCenter['type'])}>
                  <option value="GENERAL">General</option><option value="SERVICE">Service</option><option value="DEPARTMENT">Department</option><option value="LOCATION">Location</option><option value="EVENT">Event</option><option value="OTHER">Other</option>
                </select>
                <select className="rounded border p-2" value={profitCenterParentId} onChange={(e) => setProfitCenterParentId(e.target.value)}>
                  <option value="">No parent</option>
                  {profitCenters.filter((pc) => pc.isActive).map((pc) => <option key={pc.id} value={pc.id}>{pc.name}</option>)}
                </select>
                <button className="rounded bg-mono-500 px-4 py-2 text-white">Create</button>
              </form>
            ) : <p className="text-sm text-slate-500">You do not have permission to manage profit centers.</p>}
          </article>

          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-2">
              {visibleProfitCenters.map((pc) => (
                <div key={pc.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <p>
                    {pc.name} {pc.code ? `(${pc.code})` : ''} | {pc.type} | {pc.isActive ? 'active' : 'inactive'} | entries: {pc._count?.entries ?? 0}
                  </p>
                  {capabilities.manageProfitCenter ? (
                    <div className="flex gap-2">
                      <button className="rounded bg-slate-700 px-2 py-1 text-xs text-white" onClick={() => editProfitCenter(pc)}>Edit</button>
                      <button className="rounded bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => toggleProfitCenter(pc, pc.isActive)}>
                        {pc.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
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
                  <option value="EXPENSE">Expense</option><option value="INCOME">Income</option>
                </select>
                <select className="rounded border p-2" value={ruleCategoryId} onChange={(e) => setRuleCategoryId(e.target.value)} required>
                  <option value="">Category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <input className="rounded border p-2" type="number" step="0.01" min="0" placeholder="Amount" value={ruleAmount} onChange={(e) => setRuleAmount(e.target.value)} required />
                <select className="rounded border p-2" value={ruleFrequency} onChange={(e) => setRuleFrequency(e.target.value as 'MONTHLY' | 'WEEKLY')}>
                  <option value="MONTHLY">Monthly</option><option value="WEEKLY">Weekly</option>
                </select>
                <input className="rounded border p-2" type="number" min="1" max="31" placeholder="Day of month" value={ruleDayOfMonth} onChange={(e) => setRuleDayOfMonth(e.target.value)} disabled={ruleFrequency !== 'MONTHLY'} />
                <input className="rounded border p-2" type="date" value={ruleStartDate} onChange={(e) => setRuleStartDate(e.target.value)} required />
                <input className="rounded border p-2" type="date" value={ruleNextRunAt} onChange={(e) => setRuleNextRunAt(e.target.value)} required />
                <select className="rounded border p-2" value={ruleCounterpartyId} onChange={(e) => setRuleCounterpartyId(e.target.value)}>
                  <option value="">Counterparty</option>
                  {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                </select>
                <select className="rounded border p-2" value={ruleAccountId} onChange={(e) => setRuleAccountId(e.target.value)}>
                  <option value="">Account</option>
                  {accounts.filter((acc) => acc.isActive).map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
                <button className="rounded bg-mono-500 px-4 py-2 text-white md:col-span-3">Create Rule</button>
              </form>
            ) : <p className="text-sm text-slate-500">You do not have permission to manage recurring rules.</p>}
          </article>

          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Rules</h2>
              {capabilities.manageRecurring ? <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => runDue().catch(handleApiError)}>Run Due</button> : null}
            </div>
            <div className="space-y-2">
              {recurring.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <p>{rule.name} | {rule.direction} | {rule.amount} | next: {rule.nextRunAt.slice(0, 10)}</p>
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

      {tab === 'allocation' ? (
        <div className="space-y-4">
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Allocation Rules</h2>
            {capabilities.manageAllocation ? (
              <form className="space-y-3" onSubmit={createAllocationRule}>
                <div className="grid gap-2 md:grid-cols-3">
                  <input
                    className="rounded border p-2"
                    placeholder="Rule name"
                    value={allocationRuleName}
                    onChange={(e) => setAllocationRuleName(e.target.value)}
                    required
                  />
                  <select
                    className="rounded border p-2"
                    value={allocationRuleSourceCategoryId}
                    onChange={(e) => setAllocationRuleSourceCategoryId(e.target.value)}
                  >
                    <option value="">Any expense category</option>
                    {categories
                      .filter((category) => category.type === 'EXPENSE')
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    Target total: {allocationTargets.reduce((sum, item) => sum + item.percentage, 0).toFixed(2)}%
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  <select
                    className="rounded border p-2"
                    value={allocationTargetCenterId}
                    onChange={(e) => setAllocationTargetCenterId(e.target.value)}
                  >
                    <option value="">Profit center</option>
                    {profitCenters
                      .filter((center) => center.isActive)
                      .map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.name}
                        </option>
                      ))}
                  </select>
                  <input
                    className="rounded border p-2"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    placeholder="Percentage"
                    value={allocationTargetPercentage}
                    onChange={(e) => setAllocationTargetPercentage(e.target.value)}
                  />
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" type="button" onClick={addAllocationTarget}>
                    Add Target
                  </button>
                  <button className="rounded bg-mono-500 px-3 py-2 text-sm text-white" type="submit">
                    Create Rule
                  </button>
                </div>
                <div className="space-y-1 text-sm">
                  {allocationTargets.map((target) => {
                    const centerName = profitCenters.find((center) => center.id === target.profitCenterId)?.name ?? target.profitCenterId;
                    return (
                      <div key={target.profitCenterId} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                        <span>
                          {centerName}: {target.percentage.toFixed(2)}%
                        </span>
                        <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" type="button" onClick={() => removeAllocationTarget(target.profitCenterId)}>
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </form>
            ) : (
              <p className="text-sm text-slate-500">You do not have permission to manage allocation rules.</p>
            )}
          </article>

          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-base font-semibold">Apply Allocation</h3>
            {capabilities.applyAllocation ? (
              <form className="grid gap-2 md:grid-cols-3" onSubmit={applyAllocation}>
                <select className="rounded border p-2" value={applyRuleId} onChange={(e) => setApplyRuleId(e.target.value)} required>
                  <option value="">Select rule</option>
                  {allocationRules
                    .filter((rule) => rule.isActive)
                    .map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.name}
                      </option>
                    ))}
                </select>
                <select className="rounded border p-2" value={applySourceEntryId} onChange={(e) => setApplySourceEntryId(e.target.value)} required>
                  <option value="">Select expense entry</option>
                  {entries
                    .filter((entry) => entry.category.type === 'EXPENSE' && !entry.isAllocationGenerated)
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.date.slice(0, 10)} | {entry.category.name} | {entry.amount}
                      </option>
                    ))}
                </select>
                <button className="rounded bg-mono-500 px-3 py-2 text-sm text-white">Apply</button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">You do not have permission to apply allocations.</p>
            )}
          </article>

          {capabilities.readAllocation ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">Rules</h3>
              <div className="space-y-2 text-sm">
                {allocationRules.map((rule) => (
                  <div key={rule.id} className="rounded border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p>
                        {rule.name} | {rule.isActive ? 'active' : 'inactive'}
                      </p>
                      {capabilities.manageAllocation ? (
                        <button
                          className="rounded bg-slate-700 px-2 py-1 text-xs text-white"
                          onClick={() => toggleAllocationRule(rule, !rule.isActive)}
                        >
                          {rule.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : null}
                    </div>
                    <p className="text-slate-500">
                      Source category: {categories.find((category) => category.id === rule.sourceCategoryId)?.name ?? 'Any expense category'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {rule.targets.map((target) => (
                        <span key={target.id} className="rounded bg-slate-100 px-2 py-1">
                          {target.profitCenter.name}: {Number(target.percentage).toFixed(2)}%
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {capabilities.readAllocation ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">Allocation Batches</h3>
              <div className="space-y-2 text-sm">
                {allocationBatches.map((batch) => (
                  <div key={batch.id} className="rounded border border-slate-200 px-3 py-2">
                    <p>
                      {batch.createdAt.slice(0, 10)} | {batch.allocationRule.name} | generated: {batch.generatedEntries.length}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {batch.generatedEntries.map((entry) => (
                        <span key={entry.id} className="rounded bg-slate-100 px-2 py-1">
                          {entry.profitCenter?.name ?? 'Unassigned'}: {entry.amount}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      {tab === 'reports' ? (
        <div className="space-y-4">
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Reports</h2>
            {capabilities.readReports || capabilities.readProfitCenterReports || capabilities.readAgingReport ? (
              <form className="grid gap-2 md:grid-cols-5" onSubmit={loadReports}>
                <input className="rounded border p-2" type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} required />
                <input className="rounded border p-2" type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} required />
                <select className="rounded border p-2" value={reportAccountId} onChange={(e) => setReportAccountId(e.target.value)}>
                  <option value="">All accounts</option>
                  {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
                <select className="rounded border p-2" value={reportAgingDirection} onChange={(e) => setReportAgingDirection(e.target.value as 'PAYABLE' | 'RECEIVABLE')}>
                  <option value="RECEIVABLE">Aging Receivable</option>
                  <option value="PAYABLE">Aging Payable</option>
                </select>
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Load Reports</button>
              </form>
            ) : <p className="text-sm text-slate-500">You do not have permission to read reports.</p>}
          </article>

          {pnlReport ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">P&amp;L Totals</h3>
              <p className="text-sm">Income: {pnlReport.totals.income.toFixed(2)} | Expense: {pnlReport.totals.expense.toFixed(2)} | Net: {pnlReport.totals.net.toFixed(2)}</p>
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

          {capabilities.readProfitCenterReports && profitCenterSummary ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">Profit Center P&amp;L</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b"><th className="py-2">Profit Center</th><th className="py-2">Income</th><th className="py-2">Expense</th><th className="py-2">Net</th></tr>
                  </thead>
                  <tbody>
                    {profitCenterSummary.items.map((row) => (
                      <tr key={row.profitCenterId ?? 'unassigned'} className="cursor-pointer border-b border-slate-100" onClick={() => loadProfitCenterDetail(row.profitCenterId)}>
                        <td className="py-2">{row.profitCenterName}</td>
                        <td className="py-2">{row.income.toFixed(2)}</td>
                        <td className="py-2">{row.expense.toFixed(2)}</td>
                        <td className={`py-2 ${row.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{row.net.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}

          {profitCenterDetail ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">{profitCenterDetail.profitCenter.name} Detail</h3>
              <p className="mb-2 text-sm">Income: {profitCenterDetail.totals.income.toFixed(2)} | Expense: {profitCenterDetail.totals.expense.toFixed(2)} | Net: {profitCenterDetail.totals.net.toFixed(2)}</p>
              <div className="space-y-1 text-sm">
                {profitCenterDetail.byCategory.map((row) => (
                  <div key={row.categoryId} className="rounded border border-slate-200 px-3 py-2">{row.categoryName} ({row.type}) : {row.total.toFixed(2)}</div>
                ))}
              </div>
            </article>
          ) : null}

          {agingReport ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">Aging Report</h3>
              <p className="mb-2 text-sm">
                Current: {agingReport.totals.current.toFixed(2)} | 1-30: {agingReport.totals.b1_30.toFixed(2)} | 31-60: {agingReport.totals.b31_60.toFixed(2)} | 61-90: {agingReport.totals.b61_90.toFixed(2)} | 90+: {agingReport.totals.b90_plus.toFixed(2)} | Total: {agingReport.totals.total.toFixed(2)}
              </p>
              <div className="space-y-1 text-sm">
                {agingReport.items.map((row) => (
                  <div key={row.counterpartyId} className="rounded border border-slate-200 px-3 py-2">
                    {row.counterpartyName}: {row.buckets.total.toFixed(2)}
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {counterpartyBalanceReport ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">Counterparty Balance</h3>
              <p className="mb-2 text-sm">Total Outstanding: {counterpartyBalanceReport.totalOutstanding.toFixed(2)}</p>
              <div className="space-y-1 text-sm">
                {counterpartyBalanceReport.items.map((row) => (
                  <div key={row.counterpartyId} className="rounded border border-slate-200 px-3 py-2">
                    {row.counterpartyName}: {row.outstanding.toFixed(2)} ({row.invoiceCount} invoices)
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
