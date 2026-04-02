'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';

type PayrollPeriodStatus = 'DRAFT' | 'CALCULATED' | 'LOCKED' | 'POSTED';

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
  handCashFinal: string;
  notes: string;
};

function formatCurrency(value: string | number) {
  const amount = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(
    Number.isFinite(amount) ? amount : 0
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
    if (!selectedPeriodId && periodRows.length > 0) {
      setSelectedPeriodId(periodRows[0].id);
    }
  }, [selectedPeriodId]);

  const loadLines = useCallback(async (periodId: string) => {
    const lineRows = (await apiFetch(`/app-api/payroll/periods/${periodId}/lines`)) as PayrollLine[];
    setLines(lineRows);
    setDrafts(
      Object.fromEntries(
        lineRows.map((row) => [
          row.id,
          {
            reportDays: row.reportDays,
            handCashFinal: row.handCashFinal,
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

  async function runPeriodAction(periodId: string, action: 'calculate' | 'lock' | 'post') {
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

  async function saveLine(lineId: string) {
    if (!selectedPeriod) return;
    const draft = drafts[lineId];
    setSavingLineId(lineId);
    try {
      await apiFetch(`/app-api/payroll/periods/${selectedPeriod.id}/lines/${lineId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          reportDays: draft.reportDays,
          handCashFinal: Number(draft.handCashFinal),
          notes: draft.notes || null
        })
      });
      await refreshSelectedPeriod(selectedPeriod.id);
    } finally {
      setSavingLineId(null);
    }
  }

  const canCalculate = selectedPeriod && !['LOCKED', 'POSTED'].includes(selectedPeriod.status);
  const canLock = selectedPeriod?.status === 'CALCULATED';
  const canPost = selectedPeriod && ['CALCULATED', 'LOCKED'].includes(selectedPeriod.status);
  const canEditLines = selectedPeriod && ['DRAFT', 'CALCULATED'].includes(selectedPeriod.status);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Payroll Periods</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Dönem seçin, aktif ve ay içinde çıkmış çalışanları hesaplamaya dahil edin, ardından bordro
          snapshot satırlarını kontrollü şekilde kilitleyip muhasebeleştirin.
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
              disabled={!canLock || submitting}
              onClick={() => runPeriodAction(selectedPeriod.id, 'lock').catch(handleApiError)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Kilitle
            </button>
            <button
              disabled={!canPost || submitting}
              onClick={() => runPeriodAction(selectedPeriod.id, 'post').catch(handleApiError)}
              className="h-11 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              Muhasebeleştir
            </button>
          </div>
        ) : null}
      </div>

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
                      <div className="font-medium text-slate-900">{formatDate(row.startDate)} - {formatDate(row.endDate)}</div>
                      <div className="text-xs text-slate-500">
                        Hakediş {formatCurrency(row.totalGross)} • Ödeme {formatCurrency(row.totalNet)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium tracking-wide text-slate-500">{row.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          {selectedPeriod ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-slate-900">
                    {formatDate(selectedPeriod.startDate)} - {formatDate(selectedPeriod.endDate)}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Durum: {selectedPeriod.status} • Hakediş toplamı {formatCurrency(selectedPeriod.totalGross)} • Ödeme toplamı{' '}
                    {formatCurrency(selectedPeriod.totalNet)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
            <table className="min-w-[1400px] text-sm">
              <thead className="bg-slate-50 text-slate-500">
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
                    <th key={label} className="px-4 py-3 text-left font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((row) => {
                  const draft = drafts[row.id] ?? {
                    reportDays: row.reportDays,
                    handCashFinal: row.handCashFinal,
                    notes: row.notes ?? ''
                  };
                  return (
                    <tr key={row.id} className={`border-t border-slate-100 ${row.controlOk ? '' : 'bg-amber-50/50'}`}>
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
                      <td className="px-4 py-3">{formatCurrency(row.accrualPay)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.officialPay)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.calculatedBonus)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.calculatedOvertime)}</td>
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
                      <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(row.totalPayable)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.difference)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.bonusAdjustment)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            row.controlOk ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {row.controlOk ? 'Tamam' : 'Kontrol Et'}
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
