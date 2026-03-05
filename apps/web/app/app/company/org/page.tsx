'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';

type Department = {
  id: string;
  name: string;
  parentId: string | null;
  tipDepartment: 'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER';
  isActive: boolean;
};

type Title = {
  id: string;
  name: string;
  departmentId: string;
  tipWeight: string;
  isTipEligible: boolean;
  departmentAggregate: boolean;
  isActive: boolean;
  department: { id: string; name: string };
};

type DirectoryEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  userId: string | null;
  titleId: string;
  isActive: boolean;
  title: Title;
};

export default function CompanyOrgPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);

  const [departmentName, setDepartmentName] = useState('');
  const [departmentParentId, setDepartmentParentId] = useState('');
  const [departmentTipDepartment, setDepartmentTipDepartment] =
    useState<'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER'>('OTHER');

  const [titleName, setTitleName] = useState('');
  const [titleDepartmentId, setTitleDepartmentId] = useState('');
  const [titleTipWeight, setTitleTipWeight] = useState('1');
  const [titleIsTipEligible, setTitleIsTipEligible] = useState(true);
  const [titleDepartmentAggregate, setTitleDepartmentAggregate] = useState(false);

  const [employeeFirstName, setEmployeeFirstName] = useState('');
  const [employeeLastName, setEmployeeLastName] = useState('');
  const [employeeTitleId, setEmployeeTitleId] = useState('');
  const [employeeUserId, setEmployeeUserId] = useState('');
  const [employeeEditId, setEmployeeEditId] = useState('');

  const departmentsById = useMemo(() => new Map(departments.map((row) => [row.id, row])), [departments]);

  async function load() {
    const [departmentRows, titleRows, employeeRows] = await Promise.all([
      apiFetch('/app-api/company/org/departments') as Promise<Department[]>,
      apiFetch('/app-api/company/org/titles') as Promise<Title[]>,
      apiFetch('/app-api/company/org/employees') as Promise<DirectoryEmployee[]>
    ]);
    setDepartments(departmentRows);
    setTitles(titleRows);
    setEmployees(employeeRows);
    if (!titleDepartmentId && departmentRows[0]?.id) setTitleDepartmentId(departmentRows[0].id);
    if (!employeeTitleId && titleRows[0]?.id) setEmployeeTitleId(titleRows[0].id);
  }

  useEffect(() => {
    load().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/company/org/departments', {
      method: 'POST',
      body: JSON.stringify({
        name: departmentName,
        parentId: departmentParentId || null,
        tipDepartment: departmentTipDepartment
      })
    });
    setDepartmentName('');
    await load();
  }

  async function createTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/company/org/titles', {
      method: 'POST',
      body: JSON.stringify({
        departmentId: titleDepartmentId,
        name: titleName,
        tipWeight: Number(titleTipWeight),
        isTipEligible: titleIsTipEligible,
        departmentAggregate: titleDepartmentAggregate
      })
    });
    setTitleName('');
    setTitleTipWeight('1');
    setTitleIsTipEligible(true);
    setTitleDepartmentAggregate(false);
    await load();
  }

  async function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      firstName: employeeFirstName,
      lastName: employeeLastName,
      titleId: employeeTitleId,
      userId: employeeUserId || null
    };

    if (employeeEditId) {
      await apiFetch(`/app-api/company/org/employees/${employeeEditId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
    } else {
      await apiFetch('/app-api/company/org/employees', {
        method: 'POST',
        body: JSON.stringify(body)
      });
    }

    resetEmployeeForm();
    await load();
  }

  function startEditEmployee(row: DirectoryEmployee) {
    setEmployeeEditId(row.id);
    setEmployeeFirstName(row.firstName);
    setEmployeeLastName(row.lastName);
    setEmployeeTitleId(row.titleId);
    setEmployeeUserId(row.userId ?? '');
  }

  function resetEmployeeForm() {
    setEmployeeEditId('');
    setEmployeeFirstName('');
    setEmployeeLastName('');
    setEmployeeTitleId(titles[0]?.id ?? '');
    setEmployeeUserId('');
  }

  async function deactivateEmployee(row: DirectoryEmployee) {
    await apiFetch(`/app-api/company/org/employees/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !row.isActive })
    });
    await load();
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Company Org Directory</h1>
        <p className="text-sm text-slate-600">
          Departman, unvan ve çalışan dizinini yönetin. Tip dağıtımı puanları unvan üzerinden otomatik hesaplanır.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-3 rounded bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Departments</h2>
          <form className="grid gap-2 md:grid-cols-2" onSubmit={(event) => createDepartment(event).catch(handleApiError)}>
            <input
              className="rounded border px-3 py-2"
              placeholder="Department name"
              value={departmentName}
              onChange={(event) => setDepartmentName(event.target.value)}
              required
            />
            <select
              className="rounded border px-3 py-2"
              value={departmentParentId}
              onChange={(event) => setDepartmentParentId(event.target.value)}
            >
              <option value="">No parent</option>
              {departments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              className="rounded border px-3 py-2"
              value={departmentTipDepartment}
              onChange={(event) =>
                setDepartmentTipDepartment(
                  event.target.value as 'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER'
                )
              }
            >
              <option value="SERVICE">Service</option>
              <option value="BAR">Bar</option>
              <option value="KITCHEN">Kitchen</option>
              <option value="SUPPORT">Support</option>
              <option value="OTHER">Other</option>
            </select>
            <button className="rounded bg-mono-500 px-3 py-2 text-white">Add Department</button>
          </form>

          <ul className="space-y-2 text-sm">
            {departments.map((row) => (
              <li key={row.id} className="rounded border border-slate-200 p-2">
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-slate-500">
                  Parent: {row.parentId ? departmentsById.get(row.parentId)?.name ?? row.parentId : 'None'} | Tip Group:{' '}
                  {row.tipDepartment}
                </p>
              </li>
            ))}
          </ul>
        </article>

        <article className="space-y-3 rounded bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Titles</h2>
          <form className="grid gap-2 md:grid-cols-2" onSubmit={(event) => createTitle(event).catch(handleApiError)}>
            <input
              className="rounded border px-3 py-2"
              placeholder="Title name"
              value={titleName}
              onChange={(event) => setTitleName(event.target.value)}
              required
            />
            <select
              className="rounded border px-3 py-2"
              value={titleDepartmentId}
              onChange={(event) => setTitleDepartmentId(event.target.value)}
              required
            >
              <option value="">Select department</option>
              {departments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <input
              className="rounded border px-3 py-2"
              placeholder="Tip weight"
              type="number"
              step="0.01"
              min={0.01}
              value={titleTipWeight}
              onChange={(event) => setTitleTipWeight(event.target.value)}
              required
            />
            <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={titleIsTipEligible}
                onChange={(event) => setTitleIsTipEligible(event.target.checked)}
              />
              Tip eligible
            </label>
            <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={titleDepartmentAggregate}
                onChange={(event) => setTitleDepartmentAggregate(event.target.checked)}
              />
              Department aggregate title (e.g. Kitchen Aggregate)
            </label>
            <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-2">Add Title</button>
          </form>

          <ul className="space-y-2 text-sm">
            {titles.map((row) => (
              <li key={row.id} className="rounded border border-slate-200 p-2">
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-slate-500">
                  Department: {row.department.name} | Tip Weight: {row.tipWeight} | Eligible:{' '}
                  {row.isTipEligible ? 'Yes' : 'No'} | Aggregate: {row.departmentAggregate ? 'Yes' : 'No'}
                </p>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="space-y-3 rounded bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Employee Directory</h2>
        <form className="grid gap-2 md:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => saveEmployee(event).catch(handleApiError)}>
          <input
            className="rounded border px-3 py-2"
            placeholder="First name"
            value={employeeFirstName}
            onChange={(event) => setEmployeeFirstName(event.target.value)}
            required
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="Last name"
            value={employeeLastName}
            onChange={(event) => setEmployeeLastName(event.target.value)}
            required
          />
          <select
            className="rounded border px-3 py-2"
            value={employeeTitleId}
            onChange={(event) => setEmployeeTitleId(event.target.value)}
            required
          >
            <option value="">Select title</option>
            {titles.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.tipWeight})
              </option>
            ))}
          </select>
          <input
            className="rounded border px-3 py-2"
            placeholder="User ID (optional)"
            value={employeeUserId}
            onChange={(event) => setEmployeeUserId(event.target.value)}
          />
          <button className="rounded bg-mono-500 px-3 py-2 text-white lg:col-span-2">
            {employeeEditId ? 'Update Employee' : 'Add Employee'}
          </button>
          {employeeEditId ? (
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-2 lg:col-span-2"
              onClick={resetEmployeeForm}
            >
              Cancel Edit
            </button>
          ) : null}
        </form>

        <div className="overflow-hidden rounded border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Department</th>
                <th className="px-3 py-2 text-left">Tip Weight</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{row.firstName} {row.lastName}</td>
                  <td className="px-3 py-2">{row.title.name}</td>
                  <td className="px-3 py-2">{row.title.department.name}</td>
                  <td className="px-3 py-2">{row.title.tipWeight}</td>
                  <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => startEditEmployee(row)}>
                        Edit
                      </button>
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        onClick={() => deactivateEmployee(row).catch(handleApiError)}
                      >
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={6}>
                    No directory employees yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
