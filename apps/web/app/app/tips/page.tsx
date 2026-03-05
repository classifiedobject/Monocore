'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';
import { getWebEnv } from '../../../lib/env';

type Tab = 'configuration' | 'daily' | 'weekly' | 'advance' | 'report';

type DirectoryEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  title: {
    name: string;
    tipWeight: string;
    isTipEligible: boolean;
    department: {
      name: string;
      tipDepartment: 'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER';
    };
  };
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
  employee?: {
    firstName: string;
    lastName: string;
  } | null;
  directoryEmployee?: DirectoryEmployee | null;
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
  advances: Array<{
    id: string;
    amount: string;
    employee?: { firstName: string; lastName: string } | null;
    directoryEmployee?: DirectoryEmployee | null;
  }>;
};

type TipWeekReport = {
  week: {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: 'DRAFT' | 'CALCULATED' | 'LOCKED' | 'PAID';
    serviceRateUsed: number;
    wastePointsUsed: number;
    totalPoolNet: number;
    totalDistributed: number;
  };
  metrics: {
    totalPoints: number;
    pointValue: number;
  };
  rows: Array<{
    name: string;
    title: string;
    department: string;
    tipWeight: number;
    grossShare: number;
    advanceDeducted: number;
    netPayable: number;
  }>;
  totals: {
    totalGrossShare: number;
    totalAdvance: number;
    totalNetPayable: number;
  };
  reconcile: {
    totalDistributed: number;
    sumNetPayable: number;
    diff: number;
    ok: boolean;
  };
};

export default function TipsPage() {
  const tr = {
    'tip.tabs.configuration': 'Yapılandırma',
    'tip.tabs.daily': 'Günlük Giriş',
    'tip.tabs.weekly': 'Haftalık',
    'tip.tabs.advance': 'Avans',
    'tip.tabs.report': 'Rapor',
    'tip.common.save': 'Kaydet',
    'tip.common.date': 'Tarih'
  } as const;

  const [tab, setTab] = useState<Tab>('configuration');
  const [config, setConfig] = useState<TipConfig | null>(null);
  const [dailyInputs, setDailyInputs] = useState<TipDailyInput[]>([]);
  const [weeks, setWeeks] = useState<TipWeek[]>([]);
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [reportWeekId, setReportWeekId] = useState('');
  const [report, setReport] = useState<TipWeekReport | null>(null);

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
  const [advanceDirectoryEmployeeId, setAdvanceDirectoryEmployeeId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [overrideDepartment, setOverrideDepartment] = useState<'service' | 'bar' | 'kitchen' | 'support' | 'other'>('kitchen');
  const [overrideWeight, setOverrideWeight] = useState('');

  const [serviceRate, setServiceRate] = useState('0.1');
  const [serviceTaxRate, setServiceTaxRate] = useState('0.4');
  const [visaTaxRate, setVisaTaxRate] = useState('0.4');
  const [defaultWastePoints, setDefaultWastePoints] = useState('0');
  const [allowDepartmentSubPool, setAllowDepartmentSubPool] = useState(false);

  const parseNumber = (value: string) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  async function loadAll() {
    const [cfg, dailyRows, weekRows, employeeRows] = await Promise.all([
      apiFetch('/app-api/tips/config') as Promise<TipConfig>,
      apiFetch('/app-api/tips/daily-inputs') as Promise<TipDailyInput[]>,
      apiFetch('/app-api/tips/weeks') as Promise<TipWeek[]>,
      apiFetch('/app-api/tips/employees') as Promise<DirectoryEmployee[]>
    ]);
    setConfig(cfg);
    setDailyInputs(dailyRows);
    setWeeks(weekRows);
    setEmployees(employeeRows.filter((row) => Boolean(row.id) && row.isActive && row.title?.isTipEligible));
    setServiceRate(String(cfg.serviceRate));
    setServiceTaxRate(String(cfg.serviceTaxDeductionRate));
    setVisaTaxRate(String(cfg.visaTaxDeductionRate));
    setDefaultWastePoints(String(cfg.defaultWastePoints));
    setAllowDepartmentSubPool(Boolean(cfg.allowDepartmentSubPool));
    if (!advanceWeekId && weekRows[0]?.id) setAdvanceWeekId(weekRows[0].id);
    if (!advanceDirectoryEmployeeId && employeeRows[0]?.id) setAdvanceDirectoryEmployeeId(employeeRows[0].id);
    if (!reportWeekId && weekRows[0]?.id) setReportWeekId(weekRows[0].id);
  }

  useEffect(() => {
    loadAll().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!reportWeekId) return;
    apiFetch(`/app-api/tips/weeks/${reportWeekId}/report`)
      .then((data) => setReport(data as TipWeekReport))
      .catch(handleApiError);
  }, [reportWeekId]);

  const weekOptions = useMemo(() => weeks.map((row) => ({ id: row.id, label: `${row.periodStart.slice(0, 10)} - ${row.periodEnd.slice(0, 10)}` })), [weeks]);
  const dailyPreview = useMemo(() => {
    const gross = parseNumber(grossRevenue);
    const disc = parseNumber(discounts);
    const comp = parseNumber(comps);
    const waste = parseNumber(wastageSales);
    const cash = parseNumber(cashTips);
    const visaGross = parseNumber(visaTipsGross);
    const expense = parseNumber(expenseAdjustments);
    const srvRate = parseNumber(serviceRate);
    const srvTax = parseNumber(serviceTaxRate);
    const visaTax = parseNumber(visaTaxRate);

    const serviceRevenue = gross - disc - comp - waste;
    const serviceFee = serviceRevenue > 0 ? serviceRevenue / (1 + srvRate) : 0;
    const netServiceFee = serviceFee - serviceFee * srvTax;
    const netVisaTip = visaGross - visaGross * visaTax;
    const distributable = netServiceFee + netVisaTip + cash - expense;

    return {
      serviceRevenue,
      serviceFee,
      netServiceFee,
      netVisaTip,
      distributable
    };
  }, [grossRevenue, discounts, comps, wastageSales, cashTips, visaTipsGross, expenseAdjustments, serviceRate, serviceTaxRate, visaTaxRate]);

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
        directoryEmployeeId: advanceDirectoryEmployeeId,
        amount: Number(advanceAmount)
      })
    });
    setAdvanceAmount('');
    await loadAll();
  }

  function displayEmployeeName(row: { firstName: string; lastName: string } | DirectoryEmployee | null | undefined) {
    if (!row) return 'Bilinmiyor';
    return `${row.firstName} ${row.lastName}`;
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

  async function downloadCsv(path: string, fileName: string) {
    const API_URL = getWebEnv().NEXT_PUBLIC_WEB_PUBLIC_API_URL;
    const companyId = window.localStorage.getItem('activeCompanyId') ?? '';
    const res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: {
        'x-company-id': companyId
      }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold">Tip Core - Advanced Tip Engine v2</h1>
        <p className="text-sm text-slate-600">Haftalık tip havuzu, ağırlıklı dağıtım ve avans takibini tek ekrandan yönetin.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['configuration', 'daily', 'weekly', 'advance', 'report'] as Tab[]).map((item) => (
          <button
            key={item}
            className={`rounded px-3 py-2 text-sm ${tab === item ? 'bg-slate-900 text-white' : 'bg-white'}`}
            onClick={() => setTab(item)}
          >
            {item === 'configuration' ? tr['tip.tabs.configuration'] : null}
            {item === 'daily' ? tr['tip.tabs.daily'] : null}
            {item === 'weekly' ? tr['tip.tabs.weekly'] : null}
            {item === 'advance' ? tr['tip.tabs.advance'] : null}
            {item === 'report' ? tr['tip.tabs.report'] : null}
          </button>
        ))}
      </div>

      {tab === 'configuration' ? (
        <form className="grid gap-3 rounded bg-white p-4 shadow-sm md:grid-cols-2" onSubmit={(event) => saveConfig(event).catch(handleApiError)}>
          <label className="space-y-1">
            <span className="text-sm font-medium">Servis Oranı</span>
            <input className="w-full rounded border px-3 py-2" type="number" step="0.0001" min={0} max={1} value={serviceRate} onChange={(event) => setServiceRate(event.target.value)} />
            <p className="text-xs text-slate-500">Örn: %10 = 0.10 | Aralık: 0 - 1</p>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Servis Kesinti Oranı (Vergi)</span>
            <input className="w-full rounded border px-3 py-2" type="number" step="0.0001" min={0} max={1} value={serviceTaxRate} onChange={(event) => setServiceTaxRate(event.target.value)} />
            <p className="text-xs text-slate-500">Örn: %40 = 0.40 | Aralık: 0 - 1</p>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Visa Tip Kesinti Oranı</span>
            <input className="w-full rounded border px-3 py-2" type="number" step="0.0001" min={0} max={1} value={visaTaxRate} onChange={(event) => setVisaTaxRate(event.target.value)} />
            <p className="text-xs text-slate-500">Örn: %40 = 0.40 | Aralık: 0 - 1</p>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Varsayılan Zayi Puanı</span>
            <input className="w-full rounded border px-3 py-2" type="number" step="0.01" min={0} value={defaultWastePoints} onChange={(event) => setDefaultWastePoints(event.target.value)} />
            <p className="text-xs text-slate-500">Sarf zayisi puanı. Örn: 2.5</p>
          </label>
          <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm md:col-span-2">
            <input type="checkbox" checked={allowDepartmentSubPool} onChange={(event) => setAllowDepartmentSubPool(event.target.checked)} />
            Departman alt havuzu aktif olsun
          </label>
          <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-2">{tr['tip.common.save']}</button>
          {config ? <p className="text-xs text-slate-500 md:col-span-2">Config id: {config.id}</p> : null}
        </form>
      ) : null}

      {tab === 'daily' ? (
        <div className="space-y-3">
          <form className="grid gap-3 rounded bg-white p-4 shadow-sm md:grid-cols-2" onSubmit={(event) => saveDailyInput(event).catch(handleApiError)}>
            <label className="space-y-1">
              <span className="text-sm font-medium">{tr['tip.common.date']}</span>
              <input className="w-full rounded border px-3 py-2" type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Brüt Ciro</span>
              <input className="w-full rounded border px-3 py-2" type="number" min={0} step="0.01" value={grossRevenue} onChange={(event) => setGrossRevenue(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">İndirimler</span>
              <input className="w-full rounded border px-3 py-2" type="number" min={0} step="0.01" value={discounts} onChange={(event) => setDiscounts(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">İkram / Ödenmez</span>
              <input className="w-full rounded border px-3 py-2" type="number" min={0} step="0.01" value={comps} onChange={(event) => setComps(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Satış Zayileri (Bilgi Amaçlı)</span>
              <input className="w-full rounded border px-3 py-2" type="number" min={0} step="0.01" value={wastageSales} onChange={(event) => setWastageSales(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Nakit Servis Bahşişi</span>
              <input className="w-full rounded border px-3 py-2" type="number" min={0} step="0.01" value={cashTips} onChange={(event) => setCashTips(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Visa Tip (Brüt)</span>
              <input className="w-full rounded border px-3 py-2" type="number" min={0} step="0.01" value={visaTipsGross} onChange={(event) => setVisaTipsGross(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Masraflar (Tipten Düşülecek)</span>
              <input className="w-full rounded border px-3 py-2" type="number" min={0} step="0.01" value={expenseAdjustments} onChange={(event) => setExpenseAdjustments(event.target.value)} />
            </label>
            <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-2">Günlük Veriyi Kaydet</button>
          </form>

          <article className="rounded bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">Hesap Önizleme (Salt Okunur)</h3>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>Servis ve Cari Dahil Ciro: <strong>{dailyPreview.serviceRevenue.toFixed(2)}</strong></p>
              <p>Servis Ücreti (Hesap): <strong>{dailyPreview.serviceFee.toFixed(2)}</strong></p>
              <p>Net Servis Ücreti: <strong>{dailyPreview.netServiceFee.toFixed(2)}</strong></p>
              <p>Net Visa Tip: <strong>{dailyPreview.netVisaTip.toFixed(2)}</strong></p>
              <p className="md:col-span-2">Dağıtılacak Günlük Tip: <strong>{dailyPreview.distributable.toFixed(2)}</strong></p>
            </div>
          </article>

          <div className="overflow-hidden rounded bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Tarih</th>
                  <th className="px-3 py-2 text-left">Brüt Ciro</th>
                  <th className="px-3 py-2 text-left">Net Servis</th>
                  <th className="px-3 py-2 text-left">Nakit</th>
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
          <form className="grid gap-3 rounded bg-white p-4 shadow-sm md:grid-cols-2" onSubmit={(event) => createWeek(event).catch(handleApiError)}>
            <label className="space-y-1">
              <span className="text-sm font-medium">Hafta Başlangıç</span>
              <input className="w-full rounded border px-3 py-2" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Hafta Bitiş</span>
              <input className="w-full rounded border px-3 py-2" type="date" value={weekEnd} onChange={(event) => setWeekEnd(event.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">
                Bu Hafta Servis Oranı (Varsayılanı Geçersiz Kıl)
                <span className="ml-1 cursor-help text-slate-400" title="Boş bırakılırsa sistem yapılandırmasındaki servis oranı kullanılır.">ⓘ</span>
              </span>
              <input className="w-full rounded border px-3 py-2" type="number" min={0} max={1} step="0.0001" value={weekServiceRate} onChange={(event) => setWeekServiceRate(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">
                Bu Hafta Ek Zayi Puanı (Sarf Zayisi)
                <span className="ml-1 cursor-help text-slate-400" title="Toplam puana eklenir, puan değeri hesaplamasını etkiler.">ⓘ</span>
              </span>
              <input className="w-full rounded border px-3 py-2" type="number" min={0} step="0.01" value={weekWastePoints} onChange={(event) => setWeekWastePoints(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Ödeme Tarihi (Opsiyonel)</span>
              <input className="w-full rounded border px-3 py-2" type="date" value={payableDate} onChange={(event) => setPayableDate(event.target.value)} />
            </label>
            <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-2">Tip Haftası Oluştur</button>
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
                    <option value="service">Servis</option>
                    <option value="bar">Bar</option>
                    <option value="kitchen">Mutfak</option>
                    <option value="support">Destek</option>
                    <option value="other">Diğer</option>
                  </select>
                  <input
                    className="rounded border px-2 py-1 text-xs"
                    type="number"
                    step="0.01"
                    value={overrideWeight}
                    onChange={(event) => setOverrideWeight(event.target.value)}
                    placeholder="Departman için override ağırlık"
                  />
                  <button
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    onClick={() => setDepartmentOverride(row.id).catch(handleApiError)}
                  >
                    Override Kaydet
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
              <option value="">Hafta Seç</option>
              {weekOptions.map((row) => (
                <option key={row.id} value={row.id}>{row.label}</option>
              ))}
            </select>
            <select className="rounded border px-3 py-2" value={advanceDirectoryEmployeeId} onChange={(event) => setAdvanceDirectoryEmployeeId(event.target.value)} required>
              <option value="">Çalışan Seç</option>
              {employees.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.firstName} {row.lastName} - {row.title.name} ({row.title.tipWeight} puan)
                </option>
              ))}
            </select>
            <input className="rounded border px-3 py-2" type="number" step="0.01" value={advanceAmount} onChange={(event) => setAdvanceAmount(event.target.value)} placeholder="Avans Tutarı" required />
            <button className="rounded bg-mono-500 px-3 py-2 text-white">Avans Ekle</button>
          </form>

          <div className="space-y-2">
            {weeks.map((week) => (
              <article key={week.id} className="rounded bg-white p-4 shadow-sm">
                <p className="font-medium">{week.periodStart.slice(0, 10)} - {week.periodEnd.slice(0, 10)}</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {week.advances.map((advance) => (
                    <li key={advance.id}>{displayEmployeeName(advance.directoryEmployee ?? advance.employee)}: {advance.amount}</li>
                  ))}
                  {week.advances.length === 0 ? <li className="text-slate-500">Avans kaydı yok</li> : null}
                </ul>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'report' ? (
        <div className="space-y-3">
          <article className="flex flex-wrap items-center gap-2 rounded bg-white p-4 shadow-sm">
            <select
              className="rounded border px-3 py-2"
              value={reportWeekId}
              onChange={(event) => setReportWeekId(event.target.value)}
            >
              <option value="">Hafta seçin</option>
              {weekOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
            <button
              className="rounded border border-slate-300 px-3 py-2"
              onClick={() => {
                if (!reportWeekId) return;
                apiFetch(`/app-api/tips/weeks/${reportWeekId}/report`)
                  .then((data) => setReport(data as TipWeekReport))
                  .catch(handleApiError);
              }}
            >
              Raporu Yenile
            </button>
            <button
              className="rounded bg-mono-500 px-3 py-2 text-white disabled:opacity-60"
              disabled={!reportWeekId}
              onClick={() => downloadCsv(`/app-api/tips/weeks/${reportWeekId}/export.csv`, `tip-week-${reportWeekId}.csv`).catch(handleApiError)}
            >
              Hafta CSV
            </button>
            <button
              className="rounded bg-slate-900 px-3 py-2 text-white"
              onClick={() => downloadCsv('/app-api/tips/daily-inputs/export.csv', 'tip-daily-inputs.csv').catch(handleApiError)}
            >
              Günlük CSV
            </button>
          </article>

          {!report ? (
            <article className="rounded bg-white p-4 text-sm text-slate-600 shadow-sm">
              <p className="font-medium">Bu hafta hesaplama yapılmadı.</p>
              <p className="mt-1">Hafta seçip “Raporu Yenile” ile sonucu görüntüleyin.</p>
            </article>
          ) : (
            <article className="space-y-4 rounded bg-white p-4 shadow-sm">
              <h2 className="font-semibold">
                Dağıtım {report.week.periodStart.slice(0, 10)} - {report.week.periodEnd.slice(0, 10)}
              </h2>

              <div className="grid gap-2 text-sm md:grid-cols-3">
                <p>Service Rate Used: <strong>{report.week.serviceRateUsed.toFixed(4)}</strong></p>
                <p>Waste Points Used: <strong>{report.week.wastePointsUsed.toFixed(2)}</strong></p>
                <p>Total Pool (Net): <strong>{report.week.totalPoolNet.toFixed(2)}</strong></p>
                <p>Total Points: <strong>{report.metrics.totalPoints.toFixed(2)}</strong></p>
                <p>Point Value: <strong>{report.metrics.pointValue.toFixed(2)}</strong></p>
                <p>Total Distributed: <strong>{report.week.totalDistributed.toFixed(2)}</strong></p>
              </div>

              <div className="overflow-hidden rounded border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Title</th>
                      <th className="px-3 py-2 text-left">Department</th>
                      <th className="px-3 py-2 text-left">Tip Weight</th>
                      <th className="px-3 py-2 text-left">Gross Share</th>
                      <th className="px-3 py-2 text-left">Advance</th>
                      <th className="px-3 py-2 text-left">Net Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, index) => (
                      <tr key={`${row.name}-${index}`} className="border-t">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.title}</td>
                        <td className="px-3 py-2">{row.department}</td>
                        <td className="px-3 py-2">{row.tipWeight.toFixed(2)}</td>
                        <td className="px-3 py-2">{row.grossShare.toFixed(2)}</td>
                        <td className="px-3 py-2">{row.advanceDeducted.toFixed(2)}</td>
                        <td className="px-3 py-2">{row.netPayable.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-slate-50 font-semibold">
                      <td className="px-3 py-2" colSpan={4}>Totals</td>
                      <td className="px-3 py-2">{report.totals.totalGrossShare.toFixed(2)}</td>
                      <td className="px-3 py-2">{report.totals.totalAdvance.toFixed(2)}</td>
                      <td className="px-3 py-2">{report.totals.totalNetPayable.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded border border-slate-200 p-3 text-sm">
                <p>
                  Reconcile: Sum(Net Payable) <strong>{report.reconcile.sumNetPayable.toFixed(2)}</strong> vs
                  Total Distributed <strong>{report.reconcile.totalDistributed.toFixed(2)}</strong>
                </p>
                <p className={report.reconcile.ok ? 'text-emerald-700' : 'text-amber-700'}>
                  Diff: {report.reconcile.diff.toFixed(2)} {report.reconcile.ok ? '(OK)' : '(Rounding reconciliation needed)'}
                </p>
              </div>
            </article>
          )}
        </div>
      ) : null}
    </section>
  );
}
