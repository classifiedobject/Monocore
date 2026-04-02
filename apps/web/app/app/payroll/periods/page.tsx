'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';
import { PayrollDrawer, PayrollEmptyState, PayrollPageIntro, formatDate, formatMoney } from '../_components';
import type { PayrollPeriod } from '../_types';

type PeriodFormState = {
  startDate: string;
  endDate: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const defaultForm: PeriodFormState = {
  startDate: today(),
  endDate: today()
};

export default function PayrollPeriodsPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<PeriodFormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadPeriods() {
    const rows = (await apiFetch('/app-api/payroll/periods')) as PayrollPeriod[];
    setPeriods(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    loadPeriods().catch(handleApiError);
  }, []);

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/app-api/payroll/periods', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setDrawerOpen(false);
      setForm(defaultForm);
      await loadPeriods();
    } catch (error) {
      handleApiError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function calculatePeriod(id: string) {
    try {
      await apiFetch(`/app-api/payroll/periods/${id}/calculate`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      await loadPeriods();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function postPeriod(id: string) {
    try {
      await apiFetch(`/app-api/payroll/periods/${id}/post`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      await loadPeriods();
    } catch (error) {
      handleApiError(error);
    }
  }

  return (
    <section className="space-y-6">
      <PayrollPageIntro
        title="Payroll Periods"
        description="Dönemleri oluşturun, mevcut hesaplama akışını koruyarak brüt/net toplamları gözden geçirin ve uygun olduğunda post edin."
        action={
          <button
            type="button"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={() => setDrawerOpen(true)}
          >
            Yeni Dönem
          </button>
        }
      />

      {periods.length === 0 ? (
        <PayrollEmptyState
          title="Henüz payroll dönemi yok"
          description="İlk dönemi oluşturduğunuzda mevcut hesaplama ve post akışıyla devam edebilirsiniz."
          action={
            <button
              type="button"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={() => setDrawerOpen(true)}
            >
              Yeni Dönem
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {periods.map((period) => (
            <article key={period.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    {formatDate(period.startDate)} - {formatDate(period.endDate)}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Brüt: {formatMoney(period.totalGross)} · Net: {formatMoney(period.totalNet)}
                  </p>
                </div>
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {period.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {period.status !== 'POSTED' ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    onClick={() => calculatePeriod(period.id)}
                  >
                    Hesapla
                  </button>
                ) : null}
                {period.status === 'CALCULATED' ? (
                  <button
                    type="button"
                    className="rounded-lg bg-slate-950 px-3 py-1.5 text-sm text-white transition hover:bg-slate-800"
                    onClick={() => postPeriod(period.id)}
                  >
                    Post Et
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <PayrollDrawer
        open={drawerOpen}
        title="Yeni dönem"
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              onClick={() => setDrawerOpen(false)}
            >
              İptal
            </button>
            <button
              type="submit"
              form="payroll-period-form"
              disabled={submitting}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="payroll-period-form" className="space-y-6" onSubmit={submitForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Başlangıç Tarihi</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Bitiş Tarihi</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                required
              />
            </label>
          </div>
        </form>
      </PayrollDrawer>
    </section>
  );
}
