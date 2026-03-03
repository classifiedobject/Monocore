'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  salaryType: 'FIXED' | 'HOURLY';
  baseSalary: string | null;
  hourlyRate: string | null;
  isActive: boolean;
};

type WorkLog = {
  id: string;
  date: string;
  hoursWorked: string;
  employee: Employee;
};

type PayrollLine = {
  id: string;
  grossAmount: string;
  notes: string | null;
  employee: Employee;
};

type PayrollPeriod = {
  id: string;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'CALCULATED' | 'POSTED';
  totalGross: string;
  totalNet: string;
  lines: PayrollLine[];
};

type TipDistribution = {
  id: string;
  amount: string;
  employee: Employee;
};

type TipPool = {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalTips: string;
  distributionMethod: 'EQUAL' | 'HOURS_WEIGHTED';
  distributions: TipDistribution[];
};

type Tab = 'employees' | 'worklogs' | 'periods' | 'tips';

export default function PayrollPage() {
  const [tab, setTab] = useState<Tab>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [worklogs, setWorklogs] = useState<WorkLog[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [tips, setTips] = useState<TipPool[]>([]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [salaryType, setSalaryType] = useState<'fixed' | 'hourly'>('fixed');
  const [baseSalary, setBaseSalary] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10));

  const [workEmployeeId, setWorkEmployeeId] = useState('');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [hoursWorked, setHoursWorked] = useState('8');

  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));

  const [tipStart, setTipStart] = useState(new Date().toISOString().slice(0, 10));
  const [tipEnd, setTipEnd] = useState(new Date().toISOString().slice(0, 10));
  const [totalTips, setTotalTips] = useState('');
  const [tipMethod, setTipMethod] = useState<'equal' | 'hours_weighted'>('equal');

  const employeeOptions = useMemo(() => employees.filter((row) => row.isActive), [employees]);

  async function loadAll() {
    const [employeeRows, worklogRows, periodRows, tipRows] = await Promise.all([
      apiFetch('/app-api/payroll/employees') as Promise<Employee[]>,
      apiFetch('/app-api/payroll/worklogs') as Promise<WorkLog[]>,
      apiFetch('/app-api/payroll/periods') as Promise<PayrollPeriod[]>,
      apiFetch('/app-api/payroll/tips') as Promise<TipPool[]>
    ]);
    setEmployees(employeeRows);
    setWorklogs(worklogRows);
    setPeriods(periodRows);
    setTips(tipRows);

    if (!workEmployeeId && employeeRows.length > 0) {
      setWorkEmployeeId(employeeRows[0].id);
    }
  }

  useEffect(() => {
    loadAll().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/payroll/employees', {
      method: 'POST',
      body: JSON.stringify({
        firstName,
        lastName,
        salaryType,
        hireDate,
        baseSalary: salaryType === 'fixed' ? Number(baseSalary) : null,
        hourlyRate: salaryType === 'hourly' ? Number(hourlyRate) : null,
        isActive: true
      })
    });
    setFirstName('');
    setLastName('');
    setBaseSalary('');
    setHourlyRate('');
    await loadAll();
  }

  async function createWorklog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/payroll/worklogs', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: workEmployeeId,
        date: workDate,
        hoursWorked: Number(hoursWorked)
      })
    });
    await loadAll();
  }

  async function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/payroll/periods', {
      method: 'POST',
      body: JSON.stringify({ startDate: periodStart, endDate: periodEnd })
    });
    await loadAll();
  }

  async function calculatePeriod(id: string) {
    await apiFetch(`/app-api/payroll/periods/${id}/calculate`, { method: 'POST', body: JSON.stringify({}) });
    await loadAll();
  }

  async function postPeriod(id: string) {
    await apiFetch(`/app-api/payroll/periods/${id}/post`, { method: 'POST', body: JSON.stringify({}) });
    await loadAll();
  }

  async function createTipPool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/payroll/tips', {
      method: 'POST',
      body: JSON.stringify({
        periodStart: tipStart,
        periodEnd: tipEnd,
        totalTips: Number(totalTips),
        distributionMethod: tipMethod
      })
    });
    setTotalTips('');
    await loadAll();
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Payroll Core</h1>
        <p className="text-sm text-slate-600">Employees, worklogs, payroll periods and tip distribution.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['employees', 'worklogs', 'periods', 'tips'] as Tab[]).map((item) => (
          <button
            key={item}
            className={`rounded px-3 py-2 text-sm ${tab === item ? 'bg-slate-900 text-white' : 'bg-white'}`}
            onClick={() => setTab(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'employees' ? (
        <div className="space-y-4">
          <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-3" onSubmit={(event) => createEmployee(event).catch(handleApiError)}>
            <input className="rounded border px-3 py-2" placeholder="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
            <input className="rounded border px-3 py-2" placeholder="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
            <input className="rounded border px-3 py-2" type="date" value={hireDate} onChange={(event) => setHireDate(event.target.value)} required />
            <select className="rounded border px-3 py-2" value={salaryType} onChange={(event) => setSalaryType(event.target.value as 'fixed' | 'hourly')}>
              <option value="fixed">Fixed</option>
              <option value="hourly">Hourly</option>
            </select>
            {salaryType === 'fixed' ? (
              <input className="rounded border px-3 py-2" placeholder="Base salary" type="number" step="0.01" value={baseSalary} onChange={(event) => setBaseSalary(event.target.value)} required />
            ) : (
              <input className="rounded border px-3 py-2" placeholder="Hourly rate" type="number" step="0.01" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} required />
            )}
            <button className="rounded bg-mono-500 px-3 py-2 text-white">Add Employee</button>
          </form>

          <pre className="rounded bg-white p-4 text-xs shadow-sm">{JSON.stringify(employees, null, 2)}</pre>
        </div>
      ) : null}

      {tab === 'worklogs' ? (
        <div className="space-y-4">
          <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={(event) => createWorklog(event).catch(handleApiError)}>
            <select className="rounded border px-3 py-2" value={workEmployeeId} onChange={(event) => setWorkEmployeeId(event.target.value)} required>
              {employeeOptions.map((row) => (
                <option key={row.id} value={row.id}>{row.firstName} {row.lastName}</option>
              ))}
            </select>
            <input className="rounded border px-3 py-2" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} required />
            <input className="rounded border px-3 py-2" type="number" step="0.25" value={hoursWorked} onChange={(event) => setHoursWorked(event.target.value)} required />
            <button className="rounded bg-mono-500 px-3 py-2 text-white">Add Worklog</button>
          </form>

          <pre className="rounded bg-white p-4 text-xs shadow-sm">{JSON.stringify(worklogs, null, 2)}</pre>
        </div>
      ) : null}

      {tab === 'periods' ? (
        <div className="space-y-4">
          <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-3" onSubmit={(event) => createPeriod(event).catch(handleApiError)}>
            <input className="rounded border px-3 py-2" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required />
            <input className="rounded border px-3 py-2" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required />
            <button className="rounded bg-mono-500 px-3 py-2 text-white">Create Period</button>
          </form>

          <div className="space-y-3">
            {periods.map((row) => (
              <div key={row.id} className="rounded bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{row.startDate.slice(0, 10)} - {row.endDate.slice(0, 10)}</p>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs">{row.status}</span>
                  {row.status !== 'POSTED' ? (
                    <button className="rounded bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => calculatePeriod(row.id).catch(handleApiError)}>
                      Calculate
                    </button>
                  ) : null}
                  {row.status === 'CALCULATED' ? (
                    <button className="rounded bg-emerald-700 px-2 py-1 text-xs text-white" onClick={() => postPeriod(row.id).catch(handleApiError)}>
                      Post
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">Gross: {row.totalGross} | Net: {row.totalNet}</p>
                <pre className="mt-2 rounded bg-slate-50 p-2 text-xs">{JSON.stringify(row.lines, null, 2)}</pre>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'tips' ? (
        <div className="space-y-4">
          <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-5" onSubmit={(event) => createTipPool(event).catch(handleApiError)}>
            <input className="rounded border px-3 py-2" type="date" value={tipStart} onChange={(event) => setTipStart(event.target.value)} required />
            <input className="rounded border px-3 py-2" type="date" value={tipEnd} onChange={(event) => setTipEnd(event.target.value)} required />
            <input className="rounded border px-3 py-2" type="number" step="0.01" placeholder="Total tips" value={totalTips} onChange={(event) => setTotalTips(event.target.value)} required />
            <select className="rounded border px-3 py-2" value={tipMethod} onChange={(event) => setTipMethod(event.target.value as 'equal' | 'hours_weighted')}>
              <option value="equal">Equal</option>
              <option value="hours_weighted">Hours weighted</option>
            </select>
            <button className="rounded bg-mono-500 px-3 py-2 text-white">Create Tip Pool</button>
          </form>

          <pre className="rounded bg-white p-4 text-xs shadow-sm">{JSON.stringify(tips, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}
