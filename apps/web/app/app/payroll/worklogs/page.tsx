'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

type WorkLog = {
  id: string;
  date: string;
  hoursWorked: string;
  employee: Employee;
};

export default function PayrollWorklogsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [worklogs, setWorklogs] = useState<WorkLog[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hoursWorked, setHoursWorked] = useState('8');

  const activeEmployees = useMemo(() => employees.filter((row) => row.isActive), [employees]);

  const loadPage = useCallback(async () => {
    const [employeeRows, worklogRows] = await Promise.all([
      apiFetch('/app-api/payroll/employees') as Promise<Employee[]>,
      apiFetch('/app-api/payroll/worklogs') as Promise<WorkLog[]>
    ]);
    setEmployees(employeeRows);
    setWorklogs(worklogRows);
    if (!employeeId && employeeRows.length > 0) {
      setEmployeeId(employeeRows[0].id);
    }
  }, [employeeId]);

  useEffect(() => {
    loadPage().catch(handleApiError);
  }, [loadPage]);

  async function createWorklog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/payroll/worklogs', {
      method: 'POST',
      body: JSON.stringify({
        employeeId,
        date,
        hoursWorked: Number(hoursWorked)
      })
    });
    setHoursWorked('8');
    await loadPage();
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Worklogs</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Saat bazlı çalışan kayıtlarını temiz bir akışla yönetin. Bu sayfa dönem hesapları için
          destek verisi sağlar.
        </p>
      </header>

      <form
        className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-[1.3fr_1fr_1fr_auto]"
        onSubmit={(event) => createWorklog(event).catch(handleApiError)}
      >
        <select
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
          required
        >
          {activeEmployees.map((row) => (
            <option key={row.id} value={row.id}>
              {row.firstName} {row.lastName}
            </option>
          ))}
        </select>
        <input
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
        <input
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          type="number"
          step="0.25"
          min="0"
          value={hoursWorked}
          onChange={(event) => setHoursWorked(event.target.value)}
          required
        />
        <button className="h-11 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white">
          Kayıt Ekle
        </button>
      </form>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Tarih</th>
              <th className="px-4 py-3 text-left font-medium">Çalışan</th>
              <th className="px-4 py-3 text-left font-medium">Saat</th>
            </tr>
          </thead>
          <tbody>
            {worklogs.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{row.date.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  {row.employee.firstName} {row.employee.lastName}
                </td>
                <td className="px-4 py-3">{row.hoursWorked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
