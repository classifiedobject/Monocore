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
  serviceRevenueCalculated: string;
  netServiceRevenue: string;
  netServiceFee: string;
  cariAdisyonTotal: string;
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

const moneyFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const todayIso = () => new Date().toISOString().slice(0, 10);

function parseTrNumber(value: string) {
  if (!value) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTrNumber(value: number) {
  return moneyFormatter.format(value);
}

function normalizeTrInput(raw: string) {
  const only = raw.replace(/[^\d,.]/g, '').replace(/\./g, ',');
  const commaIndex = only.indexOf(',');
  if (commaIndex === -1) return only;
  const intPart = only.slice(0, commaIndex).replace(/,/g, '');
  const fracPart = only.slice(commaIndex + 1).replace(/,/g, '');
  return `${intPart},${fracPart}`;
}

function useTrNumberState(initial = '0,00') {
  const [value, setValue] = useState(initial);
  const onChange = (next: string) => setValue(normalizeTrInput(next));
  const onBlur = () => setValue(formatTrNumber(parseTrNumber(value)));
  return { value, setValue, onChange, onBlur };
}

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
  const [dailyInputs, setDailyInputs] = useState<TipDailyInput[]>([]);
  const [weeks, setWeeks] = useState<TipWeek[]>([]);
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [reportWeekId, setReportWeekId] = useState('');
  const [report, setReport] = useState<TipWeekReport | null>(null);

  const [dailyDate, setDailyDate] = useState(todayIso());
  const grossRevenue = useTrNumberState();
  const discounts = useTrNumberState();
  const comps = useTrNumberState();
  const wastageSales = useTrNumberState();
  const cariAdisyonTotal = useTrNumberState();
  const cashTips = useTrNumberState();
  const visaTipsGross = useTrNumberState();
  const expenseAdjustments = useTrNumberState();

  const [weekStart, setWeekStart] = useState(todayIso());
  const [weekEnd, setWeekEnd] = useState(todayIso());
  const weekServiceRate = useTrNumberState('');
  const weekWastePoints = useTrNumberState('');
  const [payableDate, setPayableDate] = useState('');

  const [advanceWeekId, setAdvanceWeekId] = useState('');
  const [advanceDirectoryEmployeeId, setAdvanceDirectoryEmployeeId] = useState('');
  const advanceAmount = useTrNumberState('');
  const [overrideDepartment, setOverrideDepartment] = useState<'service' | 'bar' | 'kitchen' | 'support' | 'other'>('kitchen');
  const overrideWeight = useTrNumberState('');

  const serviceRatePercent = useTrNumberState('10,00');
  const serviceTaxRatePercent = useTrNumberState('40,00');
  const visaTaxRatePercent = useTrNumberState('40,00');
  const defaultWastePoints = useTrNumberState('0,00');
  const [allowDepartmentSubPool, setAllowDepartmentSubPool] = useState(false);

  async function loadAll() {
    const [cfg, dailyRows, weekRows, employeeRows] = await Promise.all([
      apiFetch('/app-api/tips/config') as Promise<TipConfig>,
      apiFetch('/app-api/tips/daily-inputs') as Promise<TipDailyInput[]>,
      apiFetch('/app-api/tips/weeks') as Promise<TipWeek[]>,
      apiFetch('/app-api/tips/employees') as Promise<DirectoryEmployee[]>
    ]);
    setDailyInputs(dailyRows);
    setWeeks(weekRows);
    setEmployees(employeeRows.filter((row) => Boolean(row.id) && row.isActive && row.title?.isTipEligible));
    serviceRatePercent.setValue(formatTrNumber(Number(cfg.serviceRate) * 100));
    serviceTaxRatePercent.setValue(formatTrNumber(Number(cfg.serviceTaxDeductionRate) * 100));
    visaTaxRatePercent.setValue(formatTrNumber(Number(cfg.visaTaxDeductionRate) * 100));
    defaultWastePoints.setValue(formatTrNumber(Number(cfg.defaultWastePoints)));
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

  const weekOptions = useMemo(
    () => weeks.map((row) => ({ id: row.id, label: `${row.periodStart.slice(0, 10)} - ${row.periodEnd.slice(0, 10)}` })),
    [weeks]
  );

  const dailyPreview = useMemo(() => {
    const gross = parseTrNumber(grossRevenue.value);
    const disc = parseTrNumber(discounts.value);
    const comp = parseTrNumber(comps.value);
    const waste = parseTrNumber(wastageSales.value);
    const cari = parseTrNumber(cariAdisyonTotal.value);
    const cash = parseTrNumber(cashTips.value);
    const visaGross = parseTrNumber(visaTipsGross.value);
    const expense = parseTrNumber(expenseAdjustments.value);
    const serviceRate = parseTrNumber(serviceRatePercent.value) / 100;
    const serviceTaxRate = parseTrNumber(serviceTaxRatePercent.value) / 100;
    const visaTaxRate = parseTrNumber(visaTaxRatePercent.value) / 100;

    const serviceAndCariRevenue = gross - (disc + comp + waste);
    const grossServiceFee = serviceAndCariRevenue - serviceAndCariRevenue / (1 + serviceRate);
    const netServiceFee = grossServiceFee - grossServiceFee * serviceTaxRate;
    const cariDahilCiro = serviceAndCariRevenue - grossServiceFee;
    const netCiro = cariDahilCiro - cari;
    const visaNet = visaGross - visaGross * visaTaxRate;
    const distributablePool = netServiceFee + visaNet + cash - expense;

    return {
      serviceAndCariRevenue,
      grossServiceFee,
      netServiceFee,
      cariDahilCiro,
      netCiro,
      visaNet,
      distributablePool
    };
  }, [
    grossRevenue.value,
    discounts.value,
    comps.value,
    wastageSales.value,
    cariAdisyonTotal.value,
    cashTips.value,
    visaTipsGross.value,
    expenseAdjustments.value,
    serviceRatePercent.value,
    serviceTaxRatePercent.value,
    visaTaxRatePercent.value
  ]);

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/tips/config', {
      method: 'POST',
      body: JSON.stringify({
        serviceRate: parseTrNumber(serviceRatePercent.value) / 100,
        serviceTaxDeductionRate: parseTrNumber(serviceTaxRatePercent.value) / 100,
        visaTaxDeductionRate: parseTrNumber(visaTaxRatePercent.value) / 100,
        defaultWastePoints: parseTrNumber(defaultWastePoints.value),
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
        grossRevenue: parseTrNumber(grossRevenue.value),
        discounts: parseTrNumber(discounts.value),
        comps: parseTrNumber(comps.value),
        wastageSales: parseTrNumber(wastageSales.value),
        cariAdisyonTotal: parseTrNumber(cariAdisyonTotal.value),
        cashTips: parseTrNumber(cashTips.value),
        visaTipsGross: parseTrNumber(visaTipsGross.value),
        expenseAdjustments: parseTrNumber(expenseAdjustments.value)
      })
    });

    setDailyDate(todayIso());
    grossRevenue.setValue('0,00');
    discounts.setValue('0,00');
    comps.setValue('0,00');
    wastageSales.setValue('0,00');
    cariAdisyonTotal.setValue('0,00');
    cashTips.setValue('0,00');
    visaTipsGross.setValue('0,00');
    expenseAdjustments.setValue('0,00');

    await loadAll();
  }

  async function createWeek(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/tips/weeks', {
      method: 'POST',
      body: JSON.stringify({
        periodStart: weekStart,
        periodEnd: weekEnd,
        serviceRateUsed: weekServiceRate.value === '' ? undefined : parseTrNumber(weekServiceRate.value) / 100,
        wastePointsUsed: weekWastePoints.value === '' ? undefined : parseTrNumber(weekWastePoints.value),
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
        amount: parseTrNumber(advanceAmount.value)
      })
    });
    advanceAmount.setValue('');
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
    if (overrideWeight.value === '') return;
    await apiFetch(`/app-api/tips/weeks/${weekId}/department-override`, {
      method: 'POST',
      body: JSON.stringify({
        department: overrideDepartment,
        overrideWeight: parseTrNumber(overrideWeight.value)
      })
    });
    overrideWeight.setValue('');
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
            <span className="text-sm font-medium">Servis Oranı (%)</span>
            <input
              className="w-full rounded border px-3 py-2"
              inputMode="decimal"
              value={serviceRatePercent.value}
              onChange={(event) => serviceRatePercent.onChange(event.target.value)}
              onBlur={serviceRatePercent.onBlur}
            />
            <p className="text-xs text-slate-500">Ornek: 10,00 - sistemde 0.10 olarak saklanir.</p>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Servis Kesinti Oranı (%)</span>
            <input
              className="w-full rounded border px-3 py-2"
              inputMode="decimal"
              value={serviceTaxRatePercent.value}
              onChange={(event) => serviceTaxRatePercent.onChange(event.target.value)}
              onBlur={serviceTaxRatePercent.onBlur}
            />
            <p className="text-xs text-slate-500">Ornek: 40,00 - sistemde 0.40 olarak saklanir.</p>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Visa Tip Kesinti Oranı (%)</span>
            <input
              className="w-full rounded border px-3 py-2"
              inputMode="decimal"
              value={visaTaxRatePercent.value}
              onChange={(event) => visaTaxRatePercent.onChange(event.target.value)}
              onBlur={visaTaxRatePercent.onBlur}
            />
            <p className="text-xs text-slate-500">Ornek: 40,00 - sistemde 0.40 olarak saklanir.</p>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Varsayılan Zayi Puanı</span>
            <input
              className="w-full rounded border px-3 py-2"
              inputMode="decimal"
              value={defaultWastePoints.value}
              onChange={(event) => defaultWastePoints.onChange(event.target.value)}
              onBlur={defaultWastePoints.onBlur}
            />
            <p className="text-xs text-slate-500">Sarf zayisi puanı. Ornek: 2,50</p>
          </label>
          <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm md:col-span-2">
            <input type="checkbox" checked={allowDepartmentSubPool} onChange={(event) => setAllowDepartmentSubPool(event.target.checked)} />
            Departman alt havuzu aktif olsun
          </label>
          <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-2">{tr['tip.common.save']}</button>
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
              <input className="w-full rounded border px-3 py-2" inputMode="decimal" value={grossRevenue.value} onChange={(event) => grossRevenue.onChange(event.target.value)} onBlur={grossRevenue.onBlur} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">İndirimler</span>
              <input className="w-full rounded border px-3 py-2" inputMode="decimal" value={discounts.value} onChange={(event) => discounts.onChange(event.target.value)} onBlur={discounts.onBlur} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">İkram/Ödenmez</span>
              <input className="w-full rounded border px-3 py-2" inputMode="decimal" value={comps.value} onChange={(event) => comps.onChange(event.target.value)} onBlur={comps.onBlur} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Satış Zayi</span>
              <input className="w-full rounded border px-3 py-2" inputMode="decimal" value={wastageSales.value} onChange={(event) => wastageSales.onChange(event.target.value)} onBlur={wastageSales.onBlur} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Cari Adisyonlar Toplamı</span>
              <input className="w-full rounded border px-3 py-2" inputMode="decimal" value={cariAdisyonTotal.value} onChange={(event) => cariAdisyonTotal.onChange(event.target.value)} onBlur={cariAdisyonTotal.onBlur} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Nakit Servis Bahşişi</span>
              <input className="w-full rounded border px-3 py-2" inputMode="decimal" value={cashTips.value} onChange={(event) => cashTips.onChange(event.target.value)} onBlur={cashTips.onBlur} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Visa Tip (Brüt)</span>
              <input className="w-full rounded border px-3 py-2" inputMode="decimal" value={visaTipsGross.value} onChange={(event) => visaTipsGross.onChange(event.target.value)} onBlur={visaTipsGross.onBlur} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Masraflar (Tipten düşülecek)</span>
              <input className="w-full rounded border px-3 py-2" inputMode="decimal" value={expenseAdjustments.value} onChange={(event) => expenseAdjustments.onChange(event.target.value)} onBlur={expenseAdjustments.onBlur} />
            </label>
            <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-2">Günlük Veriyi Kaydet</button>
          </form>

          <article className="rounded bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">Hesap Önizleme (Salt Okunur)</h3>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>Servis ve Cari Dahil Ciro: <strong>{formatTrNumber(dailyPreview.serviceAndCariRevenue)}</strong></p>
              <p>Brüt Servis Ücreti: <strong>{formatTrNumber(dailyPreview.grossServiceFee)}</strong></p>
              <p>Net Servis Ücreti: <strong>{formatTrNumber(dailyPreview.netServiceFee)}</strong></p>
              <p>Cari Dahil Ciro: <strong>{formatTrNumber(dailyPreview.cariDahilCiro)}</strong></p>
              <p>Net Ciro: <strong>{formatTrNumber(dailyPreview.netCiro)}</strong></p>
              <p>Net Visa Tip: <strong>{formatTrNumber(dailyPreview.visaNet)}</strong></p>
              <p className="md:col-span-2">Personele dağıtılacak toplam havuz: <strong>{formatTrNumber(dailyPreview.distributablePool)}</strong></p>
            </div>
          </article>

          <div className="overflow-auto rounded bg-white shadow-sm">
            <table className="w-full min-w-[1800px] text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Tarih</th>
                  <th className="px-3 py-2 text-left">Brüt Ciro</th>
                  <th className="px-3 py-2 text-left">İndirim</th>
                  <th className="px-3 py-2 text-left">İkram/Ödenmez</th>
                  <th className="px-3 py-2 text-left">Satış Zayi</th>
                  <th className="px-3 py-2 text-left">Servis ve Cari Dahil Ciro</th>
                  <th className="px-3 py-2 text-left">Brüt Servis Ücreti</th>
                  <th className="px-3 py-2 text-left">Net Servis Ücreti</th>
                  <th className="px-3 py-2 text-left">Cari Dahil Ciro</th>
                  <th className="px-3 py-2 text-left">Cari Adisyonlar Toplamı</th>
                  <th className="px-3 py-2 text-left">Net Ciro</th>
                  <th className="px-3 py-2 text-left">Visa Brüt</th>
                  <th className="px-3 py-2 text-left">Visa Net</th>
                  <th className="px-3 py-2 text-left">Nakit Bahşiş Toplamı</th>
                </tr>
              </thead>
              <tbody>
                {dailyInputs.map((row) => {
                  const serviceAndCariRevenue = Number(row.serviceRevenueCalculated);
                  const cariDahilCiro = Number(row.netServiceRevenue);
                  const grossServiceFee = serviceAndCariRevenue - cariDahilCiro;
                  const netCiro = cariDahilCiro - Number(row.cariAdisyonTotal);
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2">{row.date.slice(0, 10)}</td>
                      <td className="px-3 py-2">{formatTrNumber(Number(row.grossRevenue))}</td>
                      <td className="px-3 py-2">{formatTrNumber(Number(row.discounts))}</td>
                      <td className="px-3 py-2">{formatTrNumber(Number(row.comps))}</td>
                      <td className="px-3 py-2">{formatTrNumber(Number(row.wastageSales))}</td>
                      <td className="px-3 py-2">{formatTrNumber(serviceAndCariRevenue)}</td>
                      <td className="px-3 py-2">{formatTrNumber(grossServiceFee)}</td>
                      <td className="px-3 py-2">{formatTrNumber(Number(row.netServiceFee))}</td>
                      <td className="px-3 py-2">{formatTrNumber(cariDahilCiro)}</td>
                      <td className="px-3 py-2">{formatTrNumber(Number(row.cariAdisyonTotal))}</td>
                      <td className="px-3 py-2">{formatTrNumber(netCiro)}</td>
                      <td className="px-3 py-2">{formatTrNumber(Number(row.visaTipsGross))}</td>
                      <td className="px-3 py-2">{formatTrNumber(Number(row.visaTipsNet))}</td>
                      <td className="px-3 py-2">{formatTrNumber(Number(row.cashTips))}</td>
                    </tr>
                  );
                })}
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
                Bu Hafta Servis Oranı (%)
                <span className="ml-1 cursor-help text-slate-400" title="Boş bırakılırsa yapılandırmadaki servis oranı kullanılır.">ⓘ</span>
              </span>
              <input className="w-full rounded border px-3 py-2" inputMode="decimal" value={weekServiceRate.value} onChange={(event) => weekServiceRate.onChange(event.target.value)} onBlur={weekServiceRate.onBlur} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">
                Bu Hafta Ek Zayi Puanı (Sarf Zayisi)
                <span className="ml-1 cursor-help text-slate-400" title="Toplam puana eklenir, puan değerini etkiler.">ⓘ</span>
              </span>
              <input className="w-full rounded border px-3 py-2" inputMode="decimal" value={weekWastePoints.value} onChange={(event) => weekWastePoints.onChange(event.target.value)} onBlur={weekWastePoints.onBlur} />
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
                  Servis Oranı: {formatTrNumber(Number(row.serviceRateUsed) * 100)}% | Net Havuz: {formatTrNumber(Number(row.totalPoolNet))} | Dagitilan: {formatTrNumber(Number(row.totalDistributed))}
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
                    inputMode="decimal"
                    value={overrideWeight.value}
                    onChange={(event) => overrideWeight.onChange(event.target.value)}
                    onBlur={overrideWeight.onBlur}
                    placeholder="Departman ağırlığı"
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
                  {row.firstName} {row.lastName} - {row.title.department.name} / {row.title.name} ({formatTrNumber(Number(row.title.tipWeight))} puan)
                </option>
              ))}
            </select>
            <input className="rounded border px-3 py-2" inputMode="decimal" value={advanceAmount.value} onChange={(event) => advanceAmount.onChange(event.target.value)} onBlur={advanceAmount.onBlur} placeholder="Avans Tutarı" required />
            <button className="rounded bg-mono-500 px-3 py-2 text-white">Avans Ekle</button>
          </form>

          <div className="space-y-2">
            {weeks.map((week) => (
              <article key={week.id} className="rounded bg-white p-4 shadow-sm">
                <p className="font-medium">{week.periodStart.slice(0, 10)} - {week.periodEnd.slice(0, 10)}</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {week.advances.map((advance) => (
                    <li key={advance.id}>{displayEmployeeName(advance.directoryEmployee ?? advance.employee)}: {formatTrNumber(Number(advance.amount))}</li>
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
                <p>Servis Oranı: <strong>{formatTrNumber(report.week.serviceRateUsed * 100)}%</strong></p>
                <p>Zayi Puanı: <strong>{formatTrNumber(report.week.wastePointsUsed)}</strong></p>
                <p>Toplam Havuz (Net): <strong>{formatTrNumber(report.week.totalPoolNet)}</strong></p>
                <p>Toplam Puan: <strong>{formatTrNumber(report.metrics.totalPoints)}</strong></p>
                <p>Puan Değeri: <strong>{formatTrNumber(report.metrics.pointValue)}</strong></p>
                <p>Toplam Dağıtılan: <strong>{formatTrNumber(report.week.totalDistributed)}</strong></p>
              </div>

              <div className="overflow-hidden rounded border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Ad Soyad</th>
                      <th className="px-3 py-2 text-left">Unvan</th>
                      <th className="px-3 py-2 text-left">Departman</th>
                      <th className="px-3 py-2 text-left">Puan</th>
                      <th className="px-3 py-2 text-left">Brüt Pay</th>
                      <th className="px-3 py-2 text-left">Avans</th>
                      <th className="px-3 py-2 text-left">Net Ödenecek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, index) => (
                      <tr key={`${row.name}-${index}`} className="border-t">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.title}</td>
                        <td className="px-3 py-2">{row.department}</td>
                        <td className="px-3 py-2">{formatTrNumber(row.tipWeight)}</td>
                        <td className="px-3 py-2">{formatTrNumber(row.grossShare)}</td>
                        <td className="px-3 py-2">{formatTrNumber(row.advanceDeducted)}</td>
                        <td className="px-3 py-2">{formatTrNumber(row.netPayable)}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-slate-50 font-semibold">
                      <td className="px-3 py-2" colSpan={4}>Toplam</td>
                      <td className="px-3 py-2">{formatTrNumber(report.totals.totalGrossShare)}</td>
                      <td className="px-3 py-2">{formatTrNumber(report.totals.totalAdvance)}</td>
                      <td className="px-3 py-2">{formatTrNumber(report.totals.totalNetPayable)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded border border-slate-200 p-3 text-sm">
                <p>
                  Uzlaştırma: Net Ödenecek Toplamı <strong>{formatTrNumber(report.reconcile.sumNetPayable)}</strong> / Dağıtılan <strong>{formatTrNumber(report.reconcile.totalDistributed)}</strong>
                </p>
                <p className={report.reconcile.ok ? 'text-emerald-700' : 'text-amber-700'}>
                  Fark: {formatTrNumber(report.reconcile.diff)} {report.reconcile.ok ? '(OK)' : '(Rounding reconciliation needed)'}
                </p>
              </div>
            </article>
          )}
        </div>
      ) : null}
    </section>
  );
}
