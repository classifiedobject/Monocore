'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';
import { PayrollDrawer, PayrollEmptyState, PayrollPageIntro, formatDate, formatMoney } from '../_components';
import type { PayrollCompensationMatrixRow, PayrollCompensationProfile, PayrollEmploymentRecord } from '../_types';

type CompensationFormState = {
  employmentRecordId: string;
  matrixRowId: string;
  overtimeEligible: boolean;
  bonusEligible: boolean;
  handCashAllowed: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};

const defaultForm: CompensationFormState = {
  employmentRecordId: '',
  matrixRowId: '',
  overtimeEligible: true,
  bonusEligible: true,
  handCashAllowed: true,
  effectiveFrom: '',
  effectiveTo: '',
  isActive: true
};

function mapProfileToForm(profile: PayrollCompensationProfile): CompensationFormState {
  return {
    employmentRecordId: profile.employmentRecordId,
    matrixRowId: profile.matrixRowId ?? '',
    overtimeEligible: profile.overtimeEligible,
    bonusEligible: profile.bonusEligible,
    handCashAllowed: profile.handCashAllowed,
    effectiveFrom: profile.effectiveFrom.slice(0, 10),
    effectiveTo: profile.effectiveTo ? profile.effectiveTo.slice(0, 10) : '',
    isActive: profile.isActive
  };
}

function recordLabel(record: PayrollEmploymentRecord) {
  return `${record.employee.firstName} ${record.employee.lastName} · ${record.titleName || 'İstihdam kaydı'}`;
}

export default function PayrollCompensationPage() {
  const [profiles, setProfiles] = useState<PayrollCompensationProfile[]>([]);
  const [employmentRecords, setEmploymentRecords] = useState<PayrollEmploymentRecord[]>([]);
  const [matrixRows, setMatrixRows] = useState<PayrollCompensationMatrixRow[]>([]);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'history'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollCompensationProfile | null>(null);
  const [form, setForm] = useState<CompensationFormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadEmploymentRecords() {
    const rows = (await apiFetch('/app-api/payroll/employment-records?status=active')) as PayrollEmploymentRecord[];
    setEmploymentRecords(Array.isArray(rows) ? rows : []);
  }

  async function loadMatrixRows() {
    const rows = (await apiFetch('/app-api/payroll/compensation-matrix?state=active')) as PayrollCompensationMatrixRow[];
    setMatrixRows(Array.isArray(rows) ? rows : []);
  }

  async function loadProfiles(nextSearch = search, nextState = stateFilter) {
    const params = new URLSearchParams();
    if (nextSearch.trim()) params.set('search', nextSearch.trim());
    if (nextState !== 'all') params.set('state', nextState);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const rows = (await apiFetch(`/app-api/payroll/compensation-profiles${suffix}`)) as PayrollCompensationProfile[];
    setProfiles(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    Promise.all([loadEmploymentRecords(), loadProfiles(), loadMatrixRows()]).catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employmentOptions = useMemo(
    () =>
      [...employmentRecords]
        .sort((a, b) => `${a.employee.lastName} ${a.employee.firstName}`.localeCompare(`${b.employee.lastName} ${b.employee.firstName}`, 'tr'))
        .map((record) => ({ id: record.id, label: recordLabel(record) })),
    [employmentRecords]
  );

  const matrixOptions = useMemo(
    () =>
      [...matrixRows]
        .sort((a, b) => Number(b.targetAccrualSalary) - Number(a.targetAccrualSalary))
        .map((row) => ({
          id: row.id,
          label: `${formatMoney(row.targetAccrualSalary)} → ${formatMoney(row.officialNetSalary)}`,
          officialNetSalary: row.officialNetSalary
        })),
    [matrixRows]
  );

  const selectedMatrixRow = useMemo(() => matrixRows.find((row) => row.id === form.matrixRowId) ?? null, [matrixRows, form.matrixRowId]);

  function resetAndClose() {
    setDrawerOpen(false);
    setEditing(null);
    setForm(defaultForm);
  }

  function openCreateDrawer() {
    setEditing(null);
    setForm({
      ...defaultForm,
      employmentRecordId: employmentOptions[0]?.id ?? '',
      matrixRowId: matrixOptions[0]?.id ?? ''
    });
    setDrawerOpen(true);
  }

  function openEditDrawer(profile: PayrollCompensationProfile) {
    setEditing(profile);
    setForm(mapProfileToForm(profile));
    setDrawerOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        employmentRecordId: form.employmentRecordId,
        matrixRowId: form.matrixRowId,
        overtimeEligible: form.overtimeEligible,
        bonusEligible: form.bonusEligible,
        handCashAllowed: form.handCashAllowed,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive
      };

      if (editing) {
        await apiFetch(`/app-api/payroll/compensation-profiles/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/app-api/payroll/compensation-profiles', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      resetAndClose();
      await loadProfiles();
    } catch (error) {
      handleApiError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <PayrollPageIntro
        title="Compensation Profiles"
        description="Ücret profilleri artık ücret matrisi üzerinden seçilir. Hakediş maaşı ile resmi net maaş manuel değil, policy eşleştirmesi üzerinden gelir."
        action={
          <button
            type="button"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={openCreateDrawer}
          >
            Yeni Ücret Profili
          </button>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]">
          <input
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
            placeholder="Çalışan, departman veya ünvan ile ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') loadProfiles(event.currentTarget.value, stateFilter).catch(handleApiError);
            }}
          />
          <select
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
            value={stateFilter}
            onChange={(event) => {
              const nextState = event.target.value as typeof stateFilter;
              setStateFilter(nextState);
              loadProfiles(search, nextState).catch(handleApiError);
            }}
          >
            <option value="all">Tüm profiller</option>
            <option value="active">Aktif</option>
            <option value="history">Geçmiş</option>
          </select>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => loadProfiles().catch(handleApiError)}
          >
            Ara
          </button>
        </div>
      </div>

      {profiles.length === 0 ? (
        <PayrollEmptyState
          title="Henüz ücret profili yok"
          description="Önce istihdam kaydı, sonra ücret matrisi seçimi ile yeni ücret profili oluşturabilirsiniz."
          action={
            <button
              type="button"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={openCreateDrawer}
            >
              Yeni Ücret Profili
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {[
                    'Çalışan',
                    'İstihdam Kaydı',
                    'Hakediş Baz Maaşı',
                    'Resmi Net Maaş',
                    'Prim Uygun',
                    'Fazla Mesai Uygun',
                    'Elden Ödeme Uygun',
                    'Effective From',
                    'Effective To',
                    'Durum',
                    'İşlemler'
                  ].map((label) => (
                    <th key={label} className="px-4 py-3 text-left font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id} className={`border-t border-slate-100 ${profile.isActive ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {profile.employmentRecord.employee.firstName} {profile.employmentRecord.employee.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {(profile.employmentRecord.departmentName || '-') + ' / ' + (profile.employmentRecord.titleName || '-')}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatMoney(profile.targetAccrualSalary)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatMoney(profile.officialNetSalary)}</td>
                    <td className="px-4 py-3 text-slate-600">{profile.bonusEligible ? 'Evet' : 'Hayır'}</td>
                    <td className="px-4 py-3 text-slate-600">{profile.overtimeEligible ? 'Evet' : 'Hayır'}</td>
                    <td className="px-4 py-3 text-slate-600">{profile.handCashAllowed ? 'Evet' : 'Hayır'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(profile.effectiveFrom)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(profile.effectiveTo)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${profile.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {profile.isActive ? 'Aktif' : 'Geçmiş'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
                        onClick={() => openEditDrawer(profile)}
                      >
                        Düzenle
                      </button>
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
        title={editing ? 'Ücret profilini düzenle' : 'Yeni ücret profili'}
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
              form="payroll-compensation-form"
              disabled={submitting}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="payroll-compensation-form" className="space-y-5" onSubmit={submitForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">İstihdam Kaydı</span>
              <select
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.employmentRecordId}
                onChange={(event) => setForm((current) => ({ ...current, employmentRecordId: event.target.value }))}
              >
                <option value="">İstihdam kaydı seç</option>
                {employmentOptions.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Hakediş Maaşı</span>
              <select
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.matrixRowId}
                onChange={(event) => setForm((current) => ({ ...current, matrixRowId: event.target.value }))}
              >
                <option value="">Matriks satırı seç</option>
                {matrixOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Resmi Maaş</span>
              <input
                disabled
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none"
                value={selectedMatrixRow ? formatMoney(selectedMatrixRow.officialNetSalary) : 'Matriks satırı seçin'}
                readOnly
              />
            </label>

            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Effective From</span>
              <input
                required
                type="date"
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.effectiveFrom}
                onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))}
              />
            </label>

            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Effective To</span>
              <input
                type="date"
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.effectiveTo}
                onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                checked={form.bonusEligible}
                onChange={(event) => setForm((current) => ({ ...current, bonusEligible: event.target.checked }))}
              />
              <span>Prim uygun</span>
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                checked={form.overtimeEligible}
                onChange={(event) => setForm((current) => ({ ...current, overtimeEligible: event.target.checked }))}
              />
              <span>Fazla mesai uygun</span>
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                checked={form.handCashAllowed}
                onChange={(event) => setForm((current) => ({ ...current, handCashAllowed: event.target.checked }))}
              />
              <span>Elden ödeme uygun</span>
            </label>
          </div>

          <label className="inline-flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span>Aktif profil</span>
          </label>
        </form>
      </PayrollDrawer>
    </section>
  );
}
