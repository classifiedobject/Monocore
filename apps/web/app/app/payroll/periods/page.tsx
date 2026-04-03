'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';

type PayrollPeriodStatus = 'DRAFT' | 'CALCULATED' | 'POSTED';

type PayrollPeriod = {
  id: string;
  startDate: string;
  endDate: string;
  status: PayrollPeriodStatus;
  totalGross: string;
  totalNet: string;
};

type PayrollLine = {
  id: string;
  departmentName: string | null;
  titleName: string | null;
  accrualDays: number;
  officialDays: number;
  reportDays: number;
  targetAccrualSalary: string;
  officialNetSalary: string;
  accrualPay: string;
  officialPay: string;
  calculatedBonus: string;
  calculatedOvertime: string;
  handCashFinal: string;
  handCashRecommended?: string;
  totalPayable: string;
  difference: string;
  bonusAdjustment: string;
  controlOk: boolean;
  notes: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
  employmentRecord: {
    insuranceStatus: 'PENDING' | 'INSURED' | 'EXITED';
    exitDate: string | null;
  };
};

type LineDraft = {
  reportDays: number;
  calculatedOvertime: string;
  handCashFinal: string;
  notes: string;
};

type LinePreview = {
  reportDays: number;
  accrualPay: number;
  officialPay: number;
  calculatedBonus: number;
  calculatedOvertime: number;
  handCashFinal: number;
  totalPayable: number;
  difference: number;
  bonusAdjustment: number;
  controlOk: boolean;
};

function asNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function roundDownToTwoHundreds(value: number) {
  if (value <= 0) return 0;
  return Math.floor(value / 200) * 200;
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(
    asNumber(value)
  );
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return value.slice(0, 10);
}

function monthRange(value: string) {
  const [year, month] = value.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function inclusiveDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate.slice(0, 10)}T00:00:00.000Z`);
  const end = Date.parse(`${endDate.slice(0, 10)}T00:00:00.000Z`);
  return Math.max(1, Math.floor((end - start) / 86400000) + 1);
}

function computeBonusCap(accrualPay: number, targetAccrualSalary: number) {
  if (targetAccrualSalary < 40000) return 0;
  if (targetAccrualSalary < 60000) return round2(accrualPay * 0.04);
  if (targetAccrualSalary < 100000) return round2(accrualPay * 0.06);
  return round2(accrualPay * 0.08);
}

function computeOvertimeCap(accrualPay: number, departmentName: string | null, targetAccrualSalary: number) {
  if (targetAccrualSalary < 45000) return 0;
  const normalized = (departmentName ?? '').trim().toLowerCase();
  const ratio = normalized.includes('kitchen') || normalized.includes('mutfak')
    ? 0.05
    : normalized.includes('bar')
      ? 0.04
      : normalized.includes('support')
        ? 0.02
        : 0.03;
  return round2(accrualPay * ratio);
}

function buildLinePreview(row: PayrollLine, draft: LineDraft, monthDays: number): LinePreview {
  const accrualDays = row.accrualDays;
  const officialDays = row.officialDays;
  const reportDays = Math.max(0, Math.min(draft.reportDays, Math.max(accrualDays, officialDays)));
  const targetAccrualSalary = asNumber(row.targetAccrualSalary);
  const officialNetSalary = asNumber(row.officialNetSalary);
  const effectiveAccrualDays = Math.max(0, accrualDays - reportDays);
  const effectiveOfficialDays = Math.max(0, officialDays - reportDays);
  const accrualPay = round2((targetAccrualSalary * effectiveAccrualDays) / Math.max(monthDays, 1));
  const officialPay = round2((officialNetSalary * effectiveOfficialDays) / Math.max(monthDays, 1));
  const preliminaryGap = Math.max(0, round2(accrualPay - officialPay));
  const overtimeRequested = Math.max(0, asNumber(draft.calculatedOvertime));
  const calculatedOvertime = Math.min(preliminaryGap, Math.max(0, overtimeRequested || computeOvertimeCap(accrualPay, row.departmentName, targetAccrualSalary)));
  const calculatedBonus = Math.min(round2(preliminaryGap - calculatedOvertime), computeBonusCap(accrualPay, targetAccrualSalary));
  const residualBeforeCash = round2(accrualPay - (officialPay + calculatedBonus + calculatedOvertime));
  const recommendedHandCash = Math.max(0, residualBeforeCash);
  const requestedHandCash = Math.max(0, asNumber(draft.handCashFinal));
  const handCashFinal = Math.min(Math.max(0, requestedHandCash || roundDownToTwoHundreds(recommendedHandCash)), Math.max(0, residualBeforeCash));
  const bonusAdjustment = round2(accrualPay - (officialPay + calculatedBonus + calculatedOvertime + handCashFinal));
  const totalPayable = round2(officialPay + calculatedBonus + calculatedOvertime + handCashFinal + bonusAdjustment);
  const difference = round2(accrualPay - totalPayable);

  return {
    reportDays,
    accrualPay,
    officialPay,
    calculatedBonus,
    calculatedOvertime,
    handCashFinal: round2(handCashFinal),
    totalPayable,
    difference,
    bonusAdjustment,
    controlOk: Math.abs(difference) <= 0.01
  };
}

export default function PayrollPeriodsPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [monthValue, setMonthValue] = useState(new Date().toISOString().slice(0, 7));
  const [submitting, setSubmitting] = useState(false);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});

  const selectedPeriod = useMemo(
    () => periods.find((row) => row.id === selectedPeriodId) ?? periods[0] ?? null,
    [periods, selectedPeriodId]
  );

  const loadPeriods = useCallback(async () => {
    const periodRows = (await apiFetch('/app-api/payroll/periods')) as PayrollPeriod[];
    setPeriods(periodRows);
    if (periodRows.length === 0) {
      setSelectedPeriodId('');
      return;
    }
    setSelectedPeriodId((current) => (current && periodRows.some((row) => row.id === current) ? current : periodRows[0].id));
  }, []);

  const loadLines = useCallback(async (periodId: string) => {
    const lineRows = (await apiFetch(`/app-api/payroll/periods/${periodId}/lines`)) as PayrollLine[];
    setLines(lineRows);
    setDrafts(
      Object.fromEntries(
        lineRows.map((row) => [
          row.id,
          {
            reportDays: row.reportDays,
            calculatedOvertime: String(asNumber(row.calculatedOvertime)),
            handCashFinal: String(asNumber(row.handCashFinal)),
            notes: row.notes ?? ''
          }
        ])
      )
    );
  }, []);

  useEffect(() => {
    loadPeriods().catch(handleApiError);
  }, [loadPeriods]);

  useEffect(() => {
    if (selectedPeriod?.id) {
      loadLines(selectedPeriod.id).catch(handleApiError);
    } else {
      setLines([]);
      setDrafts({});
    }
  }, [loadLines, selectedPeriod?.id]);

  async function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const range = monthRange(monthValue);
      await apiFetch('/app-api/payroll/periods', {
        method: 'POST',
        body: JSON.stringify(range)
      });
      await loadPeriods();
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshSelectedPeriod(periodId: string) {
    await Promise.all([loadPeriods(), loadLines(periodId)]);
  }

  async function runPeriodAction(periodId: string, action: 'calculate' | 'reset' | 'post' | 'distribute-remaining-to-prim') {
    setSubmitting(true);
    try {
      await apiFetch(`/app-api/payroll/periods/${periodId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      await refreshSelectedPeriod(periodId);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteSelectedPeriod(periodId: string) {
    setSubmitting(true);
    try {
      await apiFetch(`/app-api/payroll/periods/${periodId}`, { method: 'DELETE' });
      await loadPeriods();
      setLines([]);
      setDrafts({});
    } finally {
      setSubmitting(false);
    }
  }

  async function saveLine(lineId: string) {
    if (!selectedPeriod) return;
    const draft = drafts[lineId];
    setSavingLineId(lineId);
    try {
      await apiFetch(`/app-api/payroll/periods/${selectedPeriod.id}/lines/${lineId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          reportDays: draft.reportDays,
          calculatedOvertime: Number(draft.calculatedOvertime),
          handCashFinal: Number(draft.handCashFinal),
          notes: draft.notes || null
        })
      });
      await refreshSelectedPeriod(selectedPeriod.id);
    } finally {
      setSavingLineId(null);
    }
  }

  const canCalculate = selectedPeriod?.status === 'DRAFT';
  const canReset = selectedPeriod?.status === 'CALCULATED';
  const canPost = selectedPeriod?.status === 'CALCULATED';
  const canDelete = selectedPeriod?.status === 'DRAFT';
  const canEditLines = selectedPeriod?.status === 'CALCULATED';
  const monthDays = selectedPeriod ? inclusiveDays(selectedPeriod.startDate, selectedPeriod.endDate) : 30;

  const previewMap = useMemo(
    () =>
      Object.fromEntries(
        lines.map((row) => [
          row.id,
          buildLinePreview(
            row,
            drafts[row.id] ?? {
              reportDays: row.reportDays,
              calculatedOvertime: String(asNumber(row.calculatedOvertime)),
              handCashFinal: String(asNumber(row.handCashFinal)),
              notes: row.notes ?? ''
            },
            monthDays
          )
        ])
      ),
    [drafts, lines, monthDays]
  );

  const summary = useMemo(
    () =>
      lines.reduce(
        (totals, row) => {
          const preview = previewMap[row.id];
          totals.accrual += preview.accrualPay;
          totals.official += preview.officialPay;
          totals.bonus += preview.calculatedBonus + preview.bonusAdjustment;
          totals.overtime += preview.calculatedOvertime;
          totals.handCash += preview.handCashFinal;
          return totals;
        },
        { accrual: 0, official: 0, bonus: 0, overtime: 0, handCash: 0 }
      ),
    [lines, previewMap]
  );

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Payroll Periods</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Dönemleri oluşturun, çalışan snapshot satırlarını hesaplayın, kalan tutarı prime dağıtın ve bordroyu
          finans kayıtlarına güvenli şekilde yansıtın.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-5">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => createPeriod(event).catch(handleApiError)}>
          <label className="space-y-2 text-sm text-slate-600">
            <span>Dönem Ayı</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              type="month"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
              required
            />
          </label>
          <button
            disabled={submitting}
            className="h-11 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            Dönem Oluştur
          </button>
        </form>

        {selectedPeriod ? (
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              disabled={!canCalculate || submitting}
              onClick={() => runPeriodAction(selectedPeriod.id, 'calculate').catch(handleApiError)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Hesapla
            </button>
            <button
              disabled={!canReset || submitting}
              onClick={() => {
                if (window.confirm('Bu işlem hesaplanan satırları silip dönemi taslağa döndürecek. Devam edilsin mi?')) {
                  runPeriodAction(selectedPeriod.id, 'reset').catch(handleApiError);
                }
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Dönemi Sıfırla
            </button>
            <button
              disabled={!canReset || submitting || lines.length === 0}
              onClick={() => runPeriodAction(selectedPeriod.id, 'distribute-remaining-to-prim').catch(handleApiError)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Kalanı Prime Dağıt
            </button>
            <button
              disabled={!canPost || submitting}
              onClick={() => runPeriodAction(selectedPeriod.id, 'post').catch(handleApiError)}
              className="h-11 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              Muhasebeleştir
            </button>
            <button
              disabled={!canDelete || submitting}
              onClick={() => {
                if (window.confirm('Bu taslak dönem silinecek. Devam edilsin mi?')) {
                  deleteSelectedPeriod(selectedPeriod.id).catch(handleApiError);
                }
              }}
              className="h-11 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 disabled:opacity-50"
            >
              Dönemi Sil
            </button>
          </div>
        ) : null}
      </div>

      {selectedPeriod ? (
        <div className="grid gap-3 md:grid-cols-5">
          {[
            ['Total Hakediş', summary.accrual],
            ['Total Resmi Maaş', summary.official],
            ['Total Prim', summary.bonus],
            ['Total Fazla Mesai', summary.overtime],
            ['Total Elden', summary.handCash]
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(value as number)}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Dönem</th>
                <th className="px-4 py-3 text-left font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((row) => {
                const active = row.id === selectedPeriod?.id;
                return (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-t border-slate-100 ${active ? 'bg-slate-50' : 'hover:bg-slate-50/70'}`}
                    onClick={() => setSelectedPeriodId(row.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {formatDate(row.startDate)} - {formatDate(row.endDate)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Hakediş {formatCurrency(row.totalGross)} • Ödeme {formatCurrency(row.totalNet)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium tracking-wide text-slate-500">{row.status}</td>
                  </tr>
                );
              })}
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-sm text-slate-500">
                    Henüz payroll dönemi yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          {selectedPeriod ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-medium text-slate-900">
                {formatDate(selectedPeriod.startDate)} - {formatDate(selectedPeriod.endDate)}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Durum: {selectedPeriod.status} • Hakediş toplamı {formatCurrency(selectedPeriod.totalGross)} • Ödeme toplamı{' '}
                {formatCurrency(selectedPeriod.totalNet)}
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
            <table className="min-w-[1600px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 shadow-[0_1px_0_rgba(226,232,240,1)]">
                <tr>
                  {[
                    'Departman',
                    'Çalışan',
                    'SGK Durumu',
                    'Çıkış Tarihi',
                    'Hakediş Gün',
                    'Resmi Gün',
                    'Raporlu Gün',
                    'Hakediş Maaşı',
                    'Resmi Maaş',
                    'Prim',
                    'Fazla Mesai',
                    'Elden',
                    'Toplam',
                    'Fark',
                    'Prime Eklenecek',
                    'Kontrol',
                    'Not'
                  ].map((label) => (
                    <th key={label} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((row) => {
                  const draft = drafts[row.id] ?? {
                    reportDays: row.reportDays,
                    calculatedOvertime: String(asNumber(row.calculatedOvertime)),
                    handCashFinal: String(asNumber(row.handCashFinal)),
                    notes: row.notes ?? ''
                  };
                  const preview = previewMap[row.id];

                  return (
                    <tr key={row.id} className={`border-t border-slate-100 ${preview.controlOk ? '' : 'bg-amber-50/50'}`}>
                      <td className="px-4 py-3 text-slate-600">{row.departmentName ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.employee.firstName} {row.employee.lastName}
                      </td>
                      <td className="px-4 py-3">{row.employmentRecord.insuranceStatus}</td>
                      <td className="px-4 py-3">{formatDate(row.employmentRecord.exitDate)}</td>
                      <td className="px-4 py-3">{row.accrualDays}</td>
                      <td className="px-4 py-3">{row.officialDays}</td>
                      <td className="px-4 py-3">
                        <input
                          disabled={!canEditLines}
                          className="h-10 w-20 rounded-xl border border-slate-200 px-2 text-sm disabled:bg-slate-50"
                          type="number"
                          min="0"
                          value={draft.reportDays}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.id]: { ...draft, reportDays: Number(event.target.value) }
                            }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3">{formatCurrency(preview.accrualPay)}</td>
                      <td className="px-4 py-3">{formatCurrency(preview.officialPay)}</td>
                      <td className="px-4 py-3">{formatCurrency(preview.calculatedBonus)}</td>
                      <td className="px-4 py-3">
                        <input
                          disabled={!canEditLines}
                          className="h-10 w-28 rounded-xl border border-slate-200 px-2 text-sm disabled:bg-slate-50"
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.calculatedOvertime}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.id]: { ...draft, calculatedOvertime: event.target.value }
                            }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          disabled={!canEditLines}
                          className="h-10 w-28 rounded-xl border border-slate-200 px-2 text-sm disabled:bg-slate-50"
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.handCashFinal}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.id]: { ...draft, handCashFinal: event.target.value }
                            }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(preview.totalPayable)}</td>
                      <td className="px-4 py-3">{formatCurrency(preview.difference)}</td>
                      <td className="px-4 py-3">{formatCurrency(preview.bonusAdjustment)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            preview.controlOk ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {preview.controlOk ? 'Tamam' : 'Kontrol Et'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            disabled={!canEditLines}
                            className="h-10 min-w-[180px] rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50"
                            placeholder="Not"
                            value={draft.notes}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [row.id]: { ...draft, notes: event.target.value }
                              }))
                            }
                          />
                          {canEditLines ? (
                            <button
                              className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700"
                              onClick={() => saveLine(row.id).catch(handleApiError)}
                              disabled={savingLineId === row.id}
                            >
                              {savingLineId === row.id ? 'Kaydediliyor' : 'Kaydet'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {selectedPeriod && lines.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-10 text-center text-sm text-slate-500">
                      Bu dönem için henüz snapshot satırı yok. Önce hesaplama çalıştırın.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
