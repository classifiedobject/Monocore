'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError, ApiError } from '../../../../lib/api';

type Department = {
  id: string;
  name: string;
  sortOrder: number;
  parentId: string | null;
  tipDepartment: 'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER';
  isActive: boolean;
  canDelete?: boolean;
  deleteBlockReason?: string | null;
};

type Title = {
  id: string;
  name: string;
  sortOrder: number;
  departmentId: string;
  tipWeight: string;
  isTipEligible: boolean;
  departmentAggregate: boolean;
  isActive: boolean;
  department: { id: string; name: string; sortOrder: number };
  canDelete?: boolean;
  deleteBlockReason?: string | null;
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
  const [departmentSortOrder, setDepartmentSortOrder] = useState('1000');
  const [departmentParentId, setDepartmentParentId] = useState('');
  const [departmentTipDepartment, setDepartmentTipDepartment] =
    useState<'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER'>('OTHER');

  const [titleName, setTitleName] = useState('');
  const [titleSortOrder, setTitleSortOrder] = useState('1000');
  const [titleDepartmentId, setTitleDepartmentId] = useState('');
  const [titleTipWeight, setTitleTipWeight] = useState('1');
  const [titleIsTipEligible, setTitleIsTipEligible] = useState(true);
  const [titleDepartmentAggregate, setTitleDepartmentAggregate] = useState(false);

  const [employeeFirstName, setEmployeeFirstName] = useState('');
  const [employeeLastName, setEmployeeLastName] = useState('');
  const [employeeTitleId, setEmployeeTitleId] = useState('');
  const [employeeEditId, setEmployeeEditId] = useState('');

  const [departmentEditId, setDepartmentEditId] = useState('');
  const [departmentEditName, setDepartmentEditName] = useState('');
  const [departmentEditSortOrder, setDepartmentEditSortOrder] = useState('1000');
  const [departmentEditParentId, setDepartmentEditParentId] = useState('');
  const [departmentEditTipDepartment, setDepartmentEditTipDepartment] =
    useState<'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER'>('OTHER');

  const [titleEditId, setTitleEditId] = useState('');
  const [titleEditName, setTitleEditName] = useState('');
  const [titleEditSortOrder, setTitleEditSortOrder] = useState('1000');
  const [titleEditDepartmentId, setTitleEditDepartmentId] = useState('');
  const [titleEditTipWeight, setTitleEditTipWeight] = useState('1');
  const [titleEditIsTipEligible, setTitleEditIsTipEligible] = useState(true);
  const [titleEditDepartmentAggregate, setTitleEditDepartmentAggregate] = useState(false);

  const departmentsById = useMemo(() => new Map(departments.map((row) => [row.id, row])), [departments]);
  const sortedTitles = useMemo(
    () =>
      [...titles].sort((a, b) => {
        const deptOrderDiff = (a.department?.sortOrder ?? 1000) - (b.department?.sortOrder ?? 1000);
        if (deptOrderDiff !== 0) return deptOrderDiff;
        const titleOrderDiff = a.sortOrder - b.sortOrder;
        if (titleOrderDiff !== 0) return titleOrderDiff;
        return a.name.localeCompare(b.name, 'tr');
      }),
    [titles]
  );

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
        sortOrder: Number(departmentSortOrder),
        parentId: departmentParentId || null,
        tipDepartment: departmentTipDepartment
      })
    });
    setDepartmentName('');
    setDepartmentSortOrder('1000');
    setDepartmentParentId('');
    setDepartmentTipDepartment('OTHER');
    await load();
    window.alert('Department created');
  }

  function beginDepartmentEdit(row: Department) {
    setDepartmentEditId(row.id);
    setDepartmentEditName(row.name);
    setDepartmentEditSortOrder(String(row.sortOrder));
    setDepartmentEditParentId(row.parentId ?? '');
    setDepartmentEditTipDepartment(row.tipDepartment);
  }

  function cancelDepartmentEdit() {
    setDepartmentEditId('');
    setDepartmentEditName('');
    setDepartmentEditSortOrder('1000');
    setDepartmentEditParentId('');
    setDepartmentEditTipDepartment('OTHER');
  }

  async function saveDepartmentEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!departmentEditId) return;
    await apiFetch(`/app-api/company/org/departments/${departmentEditId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: departmentEditName,
        sortOrder: Number(departmentEditSortOrder),
        parentId: departmentEditParentId || null,
        tipDepartment: departmentEditTipDepartment
      })
    });
    cancelDepartmentEdit();
    await load();
    window.alert('Department updated');
  }

  async function toggleDepartment(row: Department) {
    await apiFetch(`/app-api/company/org/departments/${row.id}/${row.isActive ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await load();
    window.alert(`Department ${row.isActive ? 'deactivated' : 'activated'}`);
  }

  async function deleteDepartment(row: Department) {
    if (!(row.canDelete ?? false)) {
      window.alert(row.deleteBlockReason ?? 'Department cannot be deleted');
      return;
    }
    if (!window.confirm(`Delete department "${row.name}"?`)) return;

    try {
      await apiFetch(`/app-api/company/org/departments/${row.id}`, { method: 'DELETE' });
      await load();
      window.alert('Department deleted');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        window.alert(error.message);
        return;
      }
      throw error;
    }
  }

  async function createTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/company/org/titles', {
      method: 'POST',
      body: JSON.stringify({
        departmentId: titleDepartmentId,
        name: titleName,
        sortOrder: Number(titleSortOrder),
        tipWeight: Number(titleTipWeight),
        isTipEligible: titleIsTipEligible,
        departmentAggregate: titleDepartmentAggregate
      })
    });
    setTitleName('');
    setTitleSortOrder('1000');
    setTitleTipWeight('1');
    setTitleIsTipEligible(true);
    setTitleDepartmentAggregate(false);
    await load();
    window.alert('Title created');
  }

  function beginTitleEdit(row: Title) {
    setTitleEditId(row.id);
    setTitleEditName(row.name);
    setTitleEditSortOrder(String(row.sortOrder));
    setTitleEditDepartmentId(row.departmentId);
    setTitleEditTipWeight(String(row.tipWeight));
    setTitleEditIsTipEligible(row.isTipEligible);
    setTitleEditDepartmentAggregate(row.departmentAggregate);
  }

  function cancelTitleEdit() {
    setTitleEditId('');
    setTitleEditName('');
    setTitleEditSortOrder('1000');
    setTitleEditDepartmentId('');
    setTitleEditTipWeight('1');
    setTitleEditIsTipEligible(true);
    setTitleEditDepartmentAggregate(false);
  }

  async function saveTitleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!titleEditId) return;
    await apiFetch(`/app-api/company/org/titles/${titleEditId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: titleEditName,
        sortOrder: Number(titleEditSortOrder),
        departmentId: titleEditDepartmentId,
        tipWeight: Number(titleEditTipWeight),
        isTipEligible: titleEditIsTipEligible,
        departmentAggregate: titleEditDepartmentAggregate
      })
    });
    cancelTitleEdit();
    await load();
    window.alert('Title updated');
  }

  async function toggleTitle(row: Title) {
    await apiFetch(`/app-api/company/org/titles/${row.id}/${row.isActive ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await load();
    window.alert(`Title ${row.isActive ? 'deactivated' : 'activated'}`);
  }

  async function deleteTitle(row: Title) {
    if (!(row.canDelete ?? false)) {
      window.alert(row.deleteBlockReason ?? 'Title cannot be deleted');
      return;
    }
    if (!window.confirm(`Delete title "${row.name}"?`)) return;

    try {
      await apiFetch(`/app-api/company/org/titles/${row.id}`, { method: 'DELETE' });
      await load();
      window.alert('Title deleted');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        window.alert(error.message);
        return;
      }
      throw error;
    }
  }

  async function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      firstName: employeeFirstName,
      lastName: employeeLastName,
      titleId: employeeTitleId
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
  }

  function resetEmployeeForm() {
    setEmployeeEditId('');
    setEmployeeFirstName('');
    setEmployeeLastName('');
    setEmployeeTitleId(titles[0]?.id ?? '');
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
            <input className="rounded border px-3 py-2" placeholder="Department name" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} required />
            <input
              className="rounded border px-3 py-2"
              type="number"
              min={0}
              step={1}
              placeholder="Sıra No"
              value={departmentSortOrder}
              onChange={(event) => setDepartmentSortOrder(event.target.value)}
              required
            />
            <select className="rounded border px-3 py-2" value={departmentParentId} onChange={(event) => setDepartmentParentId(event.target.value)}>
              <option value="">No parent</option>
              {departments.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
            <select className="rounded border px-3 py-2" value={departmentTipDepartment} onChange={(event) => setDepartmentTipDepartment(event.target.value as 'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER')}>
              <option value="SERVICE">Service</option>
              <option value="BAR">Bar</option>
              <option value="KITCHEN">Kitchen</option>
              <option value="SUPPORT">Support</option>
              <option value="OTHER">Other</option>
            </select>
            <button className="rounded bg-mono-500 px-3 py-2 text-white">Add Department</button>
          </form>

          {departmentEditId ? (
            <form className="grid gap-2 rounded border border-slate-200 p-3 md:grid-cols-2" onSubmit={(event) => saveDepartmentEdit(event).catch(handleApiError)}>
              <input className="rounded border px-3 py-2" value={departmentEditName} onChange={(event) => setDepartmentEditName(event.target.value)} required />
              <input
                className="rounded border px-3 py-2"
                type="number"
                min={0}
                step={1}
                value={departmentEditSortOrder}
                onChange={(event) => setDepartmentEditSortOrder(event.target.value)}
                required
              />
              <select className="rounded border px-3 py-2" value={departmentEditParentId} onChange={(event) => setDepartmentEditParentId(event.target.value)}>
                <option value="">No parent</option>
                {departments.filter((row) => row.id !== departmentEditId).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
              <select className="rounded border px-3 py-2" value={departmentEditTipDepartment} onChange={(event) => setDepartmentEditTipDepartment(event.target.value as 'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER')}>
                <option value="SERVICE">Service</option>
                <option value="BAR">Bar</option>
                <option value="KITCHEN">Kitchen</option>
                <option value="SUPPORT">Support</option>
                <option value="OTHER">Other</option>
              </select>
              <div className="flex gap-2">
                <button className="rounded bg-mono-500 px-3 py-2 text-white">Save</button>
                <button type="button" className="rounded border border-slate-300 px-3 py-2" onClick={cancelDepartmentEdit}>Cancel</button>
              </div>
            </form>
          ) : null}

          <div className="overflow-hidden rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Sıra No</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Parent</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row.sortOrder}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.parentId ? departmentsById.get(row.parentId)?.name ?? row.parentId : 'None'}</td>
                    <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => beginDepartmentEdit(row)}>Edit</button>
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => toggleDepartment(row).catch(handleApiError)}>{row.isActive ? 'Deactivate' : 'Activate'}</button>
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!(row.canDelete ?? false)}
                          title={row.deleteBlockReason ?? ''}
                          onClick={() => deleteDepartment(row).catch(handleApiError)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="space-y-3 rounded bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Titles</h2>
          <form className="grid gap-2 md:grid-cols-2" onSubmit={(event) => createTitle(event).catch(handleApiError)}>
            <input className="rounded border px-3 py-2" placeholder="Title name" value={titleName} onChange={(event) => setTitleName(event.target.value)} required />
            <input
              className="rounded border px-3 py-2"
              type="number"
              min={0}
              step={1}
              placeholder="Sıra No"
              value={titleSortOrder}
              onChange={(event) => setTitleSortOrder(event.target.value)}
              required
            />
            <select className="rounded border px-3 py-2" value={titleDepartmentId} onChange={(event) => setTitleDepartmentId(event.target.value)} required>
              <option value="">Select department</option>
              {departments.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
            <input className="rounded border px-3 py-2" placeholder="Tip weight" type="number" step="0.01" min={0} value={titleTipWeight} onChange={(event) => setTitleTipWeight(event.target.value)} required />
            <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
              <input type="checkbox" checked={titleIsTipEligible} onChange={(event) => setTitleIsTipEligible(event.target.checked)} />
              Tip eligible
            </label>
            <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm md:col-span-2">
              <input type="checkbox" checked={titleDepartmentAggregate} onChange={(event) => setTitleDepartmentAggregate(event.target.checked)} />
              Department aggregate title (e.g. Kitchen Aggregate)
            </label>
            <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-2">Add Title</button>
          </form>

          {titleEditId ? (
            <form className="grid gap-2 rounded border border-slate-200 p-3 md:grid-cols-2" onSubmit={(event) => saveTitleEdit(event).catch(handleApiError)}>
              <input className="rounded border px-3 py-2" value={titleEditName} onChange={(event) => setTitleEditName(event.target.value)} required />
              <input
                className="rounded border px-3 py-2"
                type="number"
                min={0}
                step={1}
                value={titleEditSortOrder}
                onChange={(event) => setTitleEditSortOrder(event.target.value)}
                required
              />
              <select className="rounded border px-3 py-2" value={titleEditDepartmentId} onChange={(event) => setTitleEditDepartmentId(event.target.value)} required>
                <option value="">Select department</option>
                {departments.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
              <input className="rounded border px-3 py-2" type="number" step="0.01" min={0} value={titleEditTipWeight} onChange={(event) => setTitleEditTipWeight(event.target.value)} required />
              <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <input type="checkbox" checked={titleEditIsTipEligible} onChange={(event) => setTitleEditIsTipEligible(event.target.checked)} />
                Tip eligible
              </label>
              <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm md:col-span-2">
                <input type="checkbox" checked={titleEditDepartmentAggregate} onChange={(event) => setTitleEditDepartmentAggregate(event.target.checked)} />
                Department aggregate title
              </label>
              <div className="flex gap-2 md:col-span-2">
                <button className="rounded bg-mono-500 px-3 py-2 text-white">Save</button>
                <button type="button" className="rounded border border-slate-300 px-3 py-2" onClick={cancelTitleEdit}>Cancel</button>
              </div>
            </form>
          ) : null}

          <div className="overflow-hidden rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Sıra No</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Department</th>
                  <th className="px-3 py-2 text-left">Tip Weight</th>
                  <th className="px-3 py-2 text-left">Tip Eligible</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTitles.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row.sortOrder}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.department.name}</td>
                    <td className="px-3 py-2">{row.tipWeight}</td>
                    <td className="px-3 py-2">{row.isTipEligible ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => beginTitleEdit(row)}>Edit</button>
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => toggleTitle(row).catch(handleApiError)}>{row.isActive ? 'Deactivate' : 'Activate'}</button>
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!(row.canDelete ?? false)}
                          title={row.deleteBlockReason ?? ''}
                          onClick={() => deleteTitle(row).catch(handleApiError)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="space-y-3 rounded bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Employee Directory</h2>
        <form className="grid gap-2 md:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => saveEmployee(event).catch(handleApiError)}>
          <input className="rounded border px-3 py-2" placeholder="First name" value={employeeFirstName} onChange={(event) => setEmployeeFirstName(event.target.value)} required />
          <input className="rounded border px-3 py-2" placeholder="Last name" value={employeeLastName} onChange={(event) => setEmployeeLastName(event.target.value)} required />
          <select className="rounded border px-3 py-2" value={employeeTitleId} onChange={(event) => setEmployeeTitleId(event.target.value)} required>
            <option value="">Select title</option>
            {sortedTitles.map((row) => (
              <option key={row.id} value={row.id}>
                {(row.department?.name ?? '—')} - {row.name}
              </option>
            ))}
          </select>
          <button className="rounded bg-mono-500 px-3 py-2 text-white lg:col-span-2">{employeeEditId ? 'Update Employee' : 'Add Employee'}</button>
          {employeeEditId ? (
            <button type="button" className="rounded border border-slate-300 px-3 py-2 lg:col-span-2" onClick={resetEmployeeForm}>
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
                      <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => startEditEmployee(row)}>Edit</button>
                      <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => deactivateEmployee(row).catch(handleApiError)}>
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
