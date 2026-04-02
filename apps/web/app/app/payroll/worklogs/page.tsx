'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';
import { PayrollDrawer, PayrollEmptyState, PayrollPageIntro, formatDate } from '../_components';
import type { LegacyWorklogEmployee, PayrollWorkLog } from '../_types';

type WorklogFormState = {
  employeeId: string;
  date: string;
  hoursWorked: string;
};

const defaultForm: WorklogFormState = {
  employeeId: '',
  date: new Date().toISOString().slice(0, 10),
  hoursWorked: '8'
};

export default function PayrollWorklogsPage() {
  const [employees, setEmployees] = useState<LegacyWorklogEmployee[]>([]);
  const [worklogs, setWorklogs] = useState<PayrollWorkLog[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<WorklogFormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    const [employeeRows, worklogRows] = await Promise.all([
      apiFetch('/app-api/payroll/worklog-employees') as Promise<LegacyWorklogEmployee[]>,
      apiFetch('/app-api/payroll/worklogs') as Promise<PayrollWorkLog[]>
    ]);
    setEmployees(Array.isArray(employeeRows) ? employeeRows : []);
    setWorklogs(Array.isArray(worklogRows) ? worklogRows : []);
    setForm((current) => ({
      ...current,
      employeeId: current.employeeId || employeeRows[0]?.id || ''
    }));
  }

  useEffect(() => {
    loadAll().catch(handleApiError);
  }, []);

  const employeeOptions = useMemo(
    () => employees.filter((employee) => employee.isActive),
    [employees]
  );

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/app-api/payroll/worklogs', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: form.employeeId,
          date: form.date,
          hoursWorked: Number(form.hoursWorked)
        })
      });
      setDrawerOpen(false);
      setForm({ ...defaultForm, employeeId: employeeOptions[0]?.id ?? '' });
      await loadAll();
    } catch (error) {
      handleApiError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <PayrollPageIntro
        title="Worklogs"
        description="Mevcut saat bazlı iş akışını koruyarak worklog kayıtlarını sade bir listede yönetin."
        action={
          <button
            type="button"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={() => setDrawerOpen(true)}
          >
            Yeni Worklog
          </button>
        }
      />

      {worklogs.length === 0 ? (
        <PayrollEmptyState
          title="Henüz worklog kaydı yok"
          description="Saat bazlı çalışma kayıtlarını ekleyerek dönem hesapları için veri hazırlayabilirsiniz."
          action={
            <button
              type="button"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={() => setDrawerOpen(true)}
            >
              Yeni Worklog
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {['Tarih', 'Çalışan', 'Saat'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {worklogs.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.employee.firstName} {row.employee.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.hoursWorked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PayrollDrawer
        open={drawerOpen}
        title="Yeni worklog"
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
              form="payroll-worklog-form"
              disabled={submitting}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="payroll-worklog-form" className="space-y-6" onSubmit={submitForm}>
          <div className="grid gap-4">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Çalışan</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                value={form.employeeId}
                onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}
                required
              >
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Tarih</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Saat</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="number"
                step="0.25"
                min="0"
                value={form.hoursWorked}
                onChange={(event) => setForm((current) => ({ ...current, hoursWorked: event.target.value }))}
                required
              />
            </label>
          </div>
        </form>
      </PayrollDrawer>
    </section>
  );
}
