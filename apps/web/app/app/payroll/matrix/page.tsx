'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';
import { PayrollDrawer, PayrollEmptyState, PayrollPageIntro, formatDate, formatMoney } from '../_components';
import type { PayrollCompensationMatrixRow } from '../_types';

type MatrixFormState = {
  targetAccrualSalary: string;
  officialNetSalary: string;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
  isActive: boolean;
};

const defaultForm: MatrixFormState = {
  targetAccrualSalary: '',
  officialNetSalary: '',
  effectiveFrom: '',
  effectiveTo: '',
  notes: '',
  isActive: true
};

function mapRowToForm(row: PayrollCompensationMatrixRow): MatrixFormState {
  return {
    targetAccrualSalary: row.targetAccrualSalary,
    officialNetSalary: row.officialNetSalary,
    effectiveFrom: row.effectiveFrom ? row.effectiveFrom.slice(0, 10) : '',
    effectiveTo: row.effectiveTo ? row.effectiveTo.slice(0, 10) : '',
    notes: row.notes ?? '',
    isActive: row.isActive
  };
}

export default function PayrollMatrixPage() {
  const [rows, setRows] = useState<PayrollCompensationMatrixRow[]>([]);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'active'>('active');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollCompensationMatrixRow | null>(null);
  const [form, setForm] = useState<MatrixFormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadRows(nextSearch = search, nextState = stateFilter) {
    const params = new URLSearchParams();
    if (nextSearch.trim()) params.set('search', nextSearch.trim());
    if (nextState !== 'all') params.set('state', nextState);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const result = (await apiFetch(`/app-api/payroll/compensation-matrix${suffix}`)) as PayrollCompensationMatrixRow[];
    setRows(Array.isArray(result) ? result : []);
  }

  useEffect(() => {
    loadRows().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetAndClose() {
    setDrawerOpen(false);
    setEditing(null);
    setForm(defaultForm);
  }

  function openCreateDrawer() {
    setEditing(null);
    setForm(defaultForm);
    setDrawerOpen(true);
  }

  function openEditDrawer(row: PayrollCompensationMatrixRow) {
    setEditing(row);
    setForm(mapRowToForm(row));
    setDrawerOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        targetAccrualSalary: Number(form.targetAccrualSalary),
        officialNetSalary: Number(form.officialNetSalary),
        effectiveFrom: form.effectiveFrom || null,
        effectiveTo: form.effectiveTo || null,
        notes: form.notes || null,
        isActive: form.isActive
      };

      if (editing) {
        await apiFetch(`/app-api/payroll/compensation-matrix/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/app-api/payroll/compensation-matrix', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      resetAndClose();
      await loadRows();
    } catch (error) {
      handleApiError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(row: PayrollCompensationMatrixRow, nextActive: boolean) {
    try {
      await apiFetch(`/app-api/payroll/compensation-matrix/${row.id}/${nextActive ? 'activate' : 'deactivate'}`, {
        method: 'POST'
      });
      await loadRows();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function deleteRow(row: PayrollCompensationMatrixRow) {
    if (!window.confirm('Bu eşleştirme kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/app-api/payroll/compensation-matrix/${row.id}`, { method: 'DELETE' });
      await loadRows();
    } catch (error) {
      handleApiError(error);
    }
  }

  return (
    <section className="space-y-6">
      <PayrollPageIntro
        title="Compensation Matrix"
        description="Hakediş maaşı ile resmi net maaş arasındaki şirket politika eşleştirmelerini burada yönetin. Bu tablo çalışan bazlı sonuç değil, bordro kural tablosudur."
        action={
          <button
            type="button"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={openCreateDrawer}
          >
            Yeni Eşleştirme
          </button>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <input
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
            placeholder="Hakediş veya resmi net maaş ile ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') loadRows(event.currentTarget.value, stateFilter).catch(handleApiError);
            }}
          />
          <select
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
            value={stateFilter}
            onChange={(event) => {
              const nextState = event.target.value as typeof stateFilter;
              setStateFilter(nextState);
              loadRows(search, nextState).catch(handleApiError);
            }}
          >
            <option value="active">Aktif</option>
            <option value="all">Tümü</option>
          </select>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => loadRows().catch(handleApiError)}
          >
            Ara
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <PayrollEmptyState
          title="Henüz ücret eşleştirmesi yok"
          description="Örneğin 150.000 → 50.000 gibi şirket politika satırlarını burada tutabilirsiniz."
          action={
            <button
              type="button"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={openCreateDrawer}
            >
              Yeni Eşleştirme
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {['Hakediş Maaşı', 'Resmi Net Maaş', 'Effective From', 'Effective To', 'Durum', 'İşlemler'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={`border-t border-slate-100 ${row.isActive ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(row.targetAccrualSalary)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatMoney(row.officialNetSalary)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.effectiveFrom)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.effectiveTo)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {row.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
                          onClick={() => openEditDrawer(row)}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
                          onClick={() => toggleActive(row, !row.isActive)}
                        >
                          {row.isActive ? 'Pasife Al' : 'Aktife Al'}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-rose-700 transition hover:bg-rose-50"
                          onClick={() => deleteRow(row)}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PayrollDrawer
        open={drawerOpen}
        title={editing ? 'Eşleştirmeyi düzenle' : 'Yeni ücret eşleştirmesi'}
        onClose={resetAndClose}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              onClick={resetAndClose}
            >
              İptal
            </button>
            <button
              type="submit"
              form="payroll-matrix-form"
              disabled={submitting}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="payroll-matrix-form" className="space-y-6" onSubmit={submitForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Hakediş Maaşı</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="number"
                min="0"
                step="0.01"
                value={form.targetAccrualSalary}
                onChange={(event) => setForm((current) => ({ ...current, targetAccrualSalary: event.target.value }))}
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Resmi Net Maaş</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="number"
                min="0"
                step="0.01"
                value={form.officialNetSalary}
                onChange={(event) => setForm((current) => ({ ...current, officialNetSalary: event.target.value }))}
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Effective From</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="date"
                value={form.effectiveFrom}
                onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Effective To</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="date"
                value={form.effectiveTo}
                onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="font-medium">Notlar</span>
              <textarea
                className="min-h-[120px] w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-slate-300"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-300"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              <span className="font-medium">Aktif eşleştirme</span>
            </label>
          </div>
        </form>
      </PayrollDrawer>
    </section>
  );
}
