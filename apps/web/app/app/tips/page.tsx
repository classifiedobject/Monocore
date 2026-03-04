'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type Tab = 'configuration' | 'daily' | 'weekly' | 'advance' | 'report';

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  department: 'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER';
  tipWeight: string;
};

type TipConfig = {
  id: string;
  serviceRate: string;
  serviceTaxDeductionRate: string;
  visaTaxDeductionRate: string;
  defaultWastePoints: string;
  allowDepartmentSubPool: boolean;
};

type TipDailyInput = {
  id: string;
  date: string;
  grossRevenue: string;
  discounts: string;
  comps: string;
  wastageSales: string;
  netServiceFee: string;
  cashTips: string;
  visaTipsGross: string;
  visaTipsNet: string;
  expenseAdjustments: string;
};

type TipWeekDistribution = {
  id: string;
  tipWeightUsed: string;
  grossShare: string;
  advanceDeducted: string;
  netShare: string;
  employee: Employee;
};

type TipWeek = {
  id: string;
  periodStart: string;
  periodEnd: string;
  serviceRateUsed: string;
  wastePointsUsed: string;
  totalPoolGross: string;
  totalPoolNet: string;
  totalDistributed: string;
  status: 'DRAFT' | 'CALCULATED' | 'LOCKED' | 'PAID';
  payableDate: string | null;
  distributions: TipWeekDistribution[];
  advances: Array<{ id: string; amount: string; employee: Employee }>;
};

export default function TipsPage() {
  const [tab, setTab] = useState<Tab>('configuration');
  const [config, setConfig] = useState<TipConfig | null>(null);
  const [dailyInputs, setDailyInputs] = useState<TipDailyInput[]>([]);
  const [weeks, setWeeks] = useState<TipWeek[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const [grossRevenue, setGrossRevenue] = useState('0');
  const [discounts, setDiscounts] = useState('0');
  const [comps, setComps] = useState('0');
  const [wastageSales, setWastageSales] = useState('0');
  const [cashTips, setCashTips] = useState('0');
  const [visaTipsGross, setVisaTipsGross] = useState('0');
  const [expenseAdjustments, setExpenseAdjustments] = useState('0');

  const [weekStart, setWeekStart] = useState(new Date().toISOString().slice(0, 10));
  const [weekEnd, setWeekEnd] = useState(new Date().toISOString().slice(0, 10));
  const [weekServiceRate, setWeekServiceRate] = useState('');
  const [weekWastePoints, setWeekWastePoints] = useState('');
  const [payableDate, setPayableDate] = useState('');

  const [advanceWeekId, setAdvanceWeekId] = useState('');
  const [advanceEmployeeId, setAdvanceEmployeeId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [overrideDepartment, setOverrideDepartment] = useState<'service' | 'bar' | 'kitchen' | 'support' | 'other'>('kitchen');
  const [overrideWeight, setOverrideWeight] = useState('');

  const [serviceRate, setServiceRate] = useState('0.1');
  const [serviceTaxRate, setServiceTaxRate] = useState('0.4');
  const [visaTaxRate, setVisaTaxRate] = useState('0.4');
  const [defaultWastePoints, setDefaultWastePoints] = useState('0');
  const [allowDepartmentSubPool, setAllowDepartmentSubPool] = useState(false);

  async function loadAll() {
    const [cfg, dailyRows, weekRows, employeeRows] = await Promise.all([
      apiFetch('/app-api/tips/config') as Promise<TipConfig>,
      apiFetch('/app-api/tips/daily-inputs') as Promise<TipDailyInput[]>,
      apiFetch('/app-api/tips/weeks') as Promise<TipWeek[]>,
      apiFetch('/app-api/tips/employees') as Promise<Employee[]>
    ]);
    setConfig(cfg);
    setDailyInputs(dailyRows);
    setWeeks(weekRows);
    setEmployees(employeeRows.filter((row) => Boolean(row.id)));
    setServiceRate(String(cfg.serviceRate));
    setServiceTaxRate(String(cfg.serviceTaxDeductionRate));
    setVisaTaxRate(String(cfg.visaTaxDeductionRate));
    setDefaultWastePoints(String(cfg.defaultWastePoints));
    setAllowDepartmentSubPool(Boolean(cfg.allowDepartmentSubPool));
    if (!advanceWeekId && weekRows[0]?.id) setAdvanceWeekId(weekRows[0].id);
    if (!advanceEmployeeId && employeeRows[0]?.id) setAdvanceEmployeeId(employeeRows[0].id);
  }

  useEffect(() => {
    loadAll().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekOptions = useMemo(() => weeks.map((row) => ({ id: row.id, label: `${row.periodStart.slice(0, 10)} - ${row.periodEnd.slice(0, 10)}` })), [weeks]);

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/tips/config', {
      method: 'POST',
      body: JSON.stringify({
        serviceRate: Number(serviceRate),
        serviceTaxDeductionRate: Number(serviceTaxRate),
        visaTaxDeductionRate: Number(visaTaxRate),
        defaultWastePoints: Number(defaultWastePoints),
        allowDepartmentSubPool
      })
    });
    await loadAll();
  }

  async function saveDailyInput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/tips/daily-inputs', {
      method: 'POST',
      body: JSON.stringify({
        date: dailyDate,
        grossRevenue: Number(grossRevenue),
        discounts: Number(discounts),
        comps: Number(comps),
        wastageSales: Number(wastageSales),
        cashTips: Number(cashTips),
        visaTipsGross: Number(visaTipsGross),
        expenseAdjustments: Number(expenseAdjustments)
      })
    });
    await loadAll();
  }

  async function createWeek(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/tips/weeks', {
      method: 'POST',
      body: JSON.stringify({
        periodStart: weekStart,
        periodEnd: weekEnd,
        serviceRateUsed: weekServiceRate === '' ? undefined : Number(weekServiceRate),
        wastePointsUsed: weekWastePoints === '' ? undefined : Number(weekWastePoints),
        payableDate: payableDate || null
      })
    });
    await loadAll();
  }

  async function createAdvance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/tips/advance', {
      method: 'POST',
      body: JSON.stringify({
        tipWeekId: advanceWeekId,
        employeeId: advanceEmployeeId,
        amount: Number(advanceAmount)
      })
    });
    setAdvanceAmount('');
    await loadAll();
  }

  async function calculateWeek(id: string) {
    await apiFetch(`/app-api/tips/weeks/${id}/calculate`, { method: 'POST', body: JSON.stringify({}) });
    await loadAll();
  }

  async function lockWeek(id: string) {
    await apiFetch(`/app-api/tips/weeks/${id}/lock`, { method: 'POST', body: JSON.stringify({}) });
    await loadAll();
  }

  async function markPaid(id: string) {
    await apiFetch(`/app-api/tips/weeks/${id}/mark-paid`, { method: 'POST', body: JSON.stringify({}) });
    await loadAll();
  }

  async function setDepartmentOverride(weekId: string) {
    if (overrideWeight === '') return;
    await apiFetch(`/app-api/tips/weeks/${weekId}/department-override`, {
      method: 'POST',
      body: JSON.stringify({
        department: overrideDepartment,
        overrideWeight: Number(overrideWeight)
      })
    });
    setOverrideWeight('');
    await loadAll();
  }

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold">Tip Core - Advanced Tip Engine v2</h1>
        <p className="text-sm text-slate-600">Configurable weekly tip pool, weighted distribution and advance tracking.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['configuration', 'daily', 'weekly', 'advance', 'report'] as Tab[]).map((item) => (
          <button
            key={item}
            className={`rounded px-3 py-2 text-sm ${tab === item ? 'bg-slate-900 text-white' : 'bg-white'}`}
            onClick={() => setTab(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'configuration' ? (
        <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-3" onSubmit={(event) => saveConfig(event).catch(handleApiError)}>
          <input className="rounded border px-3 py-2" type="number" step="0.0001" value={serviceRate} onChange={(event) => setServiceRate(event.target.value)} placeholder="Service rate" />
          <input className="rounded border px-3 py-2" type="number" step="0.0001" value={serviceTaxRate} onChange={(event) => setServiceTaxRate(event.target.value)} placeholder="Service tax deduction rate" />
          <input className="rounded border px-3 py-2" type="number" step="0.0001" value={visaTaxRate} onChange={(event) => setVisaTaxRate(event.target.value)} placeholder="Visa tax deduction rate" />
          <input className="rounded border px-3 py-2" type="number" step="0.01" value={defaultWastePoints} onChange={(event) => setDefaultWastePoints(event.target.value)} placeholder="Default waste points" />
          <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
            <input type="checkbox" checked={allowDepartmentSubPool} onChange={(event) => setAllowDepartmentSubPool(event.target.checked)} />
            Allow department sub pool
          </label>
          <button className="rounded bg-mono-500 px-3 py-2 text-white">Save Configuration</button>
          {config ? <p className="text-xs text-slate-500 md:col-span-3">Config id: {config.id}</p> : null}
        </form>
      ) : null}

      {tab === 'daily' ? (
        <div className="space-y-3">
          <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={(event) => saveDailyInput(event).catch(handleApiError)}>
            <input className="rounded border px-3 py-2" type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} required />
            <input className="rounded border px-3 py-2" type="number" step="0.01" value={grossRevenue} onChange={(event) => setGrossRevenue(event.target.value)} placeholder="Gross revenue" />
            <input className="rounded border px-3 py-2" type="number" step="0.01" value={discounts} onChange={(event) => setDiscounts(event.target.value)} placeholder="Discounts" />
            <input className="rounded border px-3 py-2" type="number" step="0.01" value={comps} onChange={(event) => setComps(event.target.value)} placeholder="Comps" />
            <input className="rounded border px-3 py-2" type="number" step="0.01" value={wastageSales} onChange={(event) => setWastageSales(event.target.value)} placeholder="Wastage sales" />
            <input className="rounded border px-3 py-2" type="number" step="0.01" value={cashTips} onChange={(event) => setCashTips(event.target.value)} placeholder="Cash tips" />
            <input className="rounded border px-3 py-2" type="number" step="0.01" value={visaTipsGross} onChange={(event) => setVisaTipsGross(event.target.value)} placeholder="Visa tips gross" />
            <input className="rounded border px-3 py-2" type="number" step="0.01" value={expenseAdjustments} onChange={(event) => setExpenseAdjustments(event.target.value)} placeholder="Expense adjustments" />
            <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-4">Save Daily Input</button>
          </form>

          <div className="overflow-hidden rounded bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Gross</th>
                  <th className="px-3 py-2 text-left">Net Service Fee</th>
                  <th className="px-3 py-2 text-left">Cash</th>
                  <th className="px-3 py-2 text-left">Visa Net</th>
                </tr>
              </thead>
              <tbody>
                {dailyInputs.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row.date.slice(0, 10)}</td>
                    <td className="px-3 py-2">{row.grossRevenue}</td>
                    <td className="px-3 py-2">{row.netServiceFee}</td>
                    <td className="px-3 py-2">{row.cashTips}</td>
                    <td className="px-3 py-2">{row.visaTipsNet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'weekly' ? (
        <div className="space-y-3">
          <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-5" onSubmit={(event) => createWeek(event).catch(handleApiError)}>
            <input className="rounded border px-3 py-2" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} required />
            <input className="rounded border px-3 py-2" type="date" value={weekEnd} onChange={(event) => setWeekEnd(event.target.value)} required />
            <input className="rounded border px-3 py-2" type="number" step="0.0001" value={weekServiceRate} onChange={(event) => setWeekServiceRate(event.target.value)} placeholder="Service rate override" />
            <input className="rounded border px-3 py-2" type="number" step="0.01" value={weekWastePoints} onChange={(event) => setWeekWastePoints(event.target.value)} placeholder="Waste points override" />
            <input className="rounded border px-3 py-2" type="date" value={payableDate} onChange={(event) => setPayableDate(event.target.value)} />
            <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-5">Create Tip Week</button>
          </form>

          <div className="space-y-3">
            {weeks.map((row) => (
              <article key={row.id} className="rounded bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{row.periodStart.slice(0, 10)} - {row.periodEnd.slice(0, 10)}</p>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs">{row.status}</span>
                  {row.status !== 'LOCKED' && row.status !== 'PAID' ? (
                    <button className="rounded bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => calculateWeek(row.id).catch(handleApiError)}>Calculate</button>
                  ) : null}
                  {row.status === 'CALCULATED' ? (
                    <button className="rounded bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => lockWeek(row.id).catch(handleApiError)}>Lock</button>
                  ) : null}
                  {row.status === 'LOCKED' ? (
                    <button className="rounded bg-emerald-700 px-2 py-1 text-xs text-white" onClick={() => markPaid(row.id).catch(handleApiError)}>Mark Paid</button>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Gross: {row.totalPoolGross} | Net: {row.totalPoolNet} | Distributed: {row.totalDistributed}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className="rounded border px-2 py-1 text-xs"
                    value={overrideDepartment}
                    onChange={(event) => setOverrideDepartment(event.target.value as 'service' | 'bar' | 'kitchen' | 'support' | 'other')}
                  >
                    <option value="service">service</option>
                    <option value="bar">bar</option>
                    <option value="kitchen">kitchen</option>
                    <option value="support">support</option>
                    <option value="other">other</option>
                  </select>
                  <input
                    className="rounded border px-2 py-1 text-xs"
                    type="number"
                    step="0.01"
                    value={overrideWeight}
                    onChange={(event) => setOverrideWeight(event.target.value)}
                    placeholder="Department override weight"
                  />
                  <button
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    onClick={() => setDepartmentOverride(row.id).catch(handleApiError)}
                  >
                    Save Override
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'advance' ? (
        <div className="space-y-3">
          <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={(event) => createAdvance(event).catch(handleApiError)}>
            <select className="rounded border px-3 py-2" value={advanceWeekId} onChange={(event) => setAdvanceWeekId(event.target.value)} required>
              <option value="">Select week</option>
              {weekOptions.map((row) => (
                <option key={row.id} value={row.id}>{row.label}</option>
              ))}
            </select>
            <select className="rounded border px-3 py-2" value={advanceEmployeeId} onChange={(event) => setAdvanceEmployeeId(event.target.value)} required>
              <option value="">Select employee</option>
              {employees.map((row) => (
                <option key={row.id} value={row.id}>{row.firstName} {row.lastName}</option>
              ))}
            </select>
            <input className="rounded border px-3 py-2" type="number" step="0.01" value={advanceAmount} onChange={(event) => setAdvanceAmount(event.target.value)} placeholder="Advance amount" required />
            <button className="rounded bg-mono-500 px-3 py-2 text-white">Add Advance</button>
          </form>

          <div className="space-y-2">
            {weeks.map((week) => (
              <article key={week.id} className="rounded bg-white p-4 shadow-sm">
                <p className="font-medium">{week.periodStart.slice(0, 10)} - {week.periodEnd.slice(0, 10)}</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {week.advances.map((advance) => (
                    <li key={advance.id}>{advance.employee.firstName} {advance.employee.lastName}: {advance.amount}</li>
                  ))}
                  {week.advances.length === 0 ? <li className="text-slate-500">No advances</li> : null}
                </ul>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'report' ? (
        <div className="space-y-3">
          {weeks.map((week) => (
            <article key={week.id} className="rounded bg-white p-4 shadow-sm">
              <h2 className="font-semibold">
                Distribution {week.periodStart.slice(0, 10)} - {week.periodEnd.slice(0, 10)}
              </h2>
              <div className="mt-2 overflow-hidden rounded border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Employee</th>
                      <th className="px-3 py-2 text-left">Weight</th>
                      <th className="px-3 py-2 text-left">Gross Share</th>
                      <th className="px-3 py-2 text-left">Advance</th>
                      <th className="px-3 py-2 text-left">Net Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.distributions.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2">{row.employee.firstName} {row.employee.lastName}</td>
                        <td className="px-3 py-2">{row.tipWeightUsed}</td>
                        <td className="px-3 py-2">{row.grossShare}</td>
                        <td className="px-3 py-2">{row.advanceDeducted}</td>
                        <td className="px-3 py-2">{row.netShare}</td>
                      </tr>
                    ))}
                    {week.distributions.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-slate-500" colSpan={5}>No distribution calculated yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
