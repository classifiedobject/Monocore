'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch, handleApiError } from '../../../../lib/api';

type Tab = 'suppliers' | 'brands';

type Caps = {
  readSuppliers?: boolean;
  manageSuppliers?: boolean;
  readBrands?: boolean;
  manageBrands?: boolean;
};

type Supplier = {
  id: string;
  shortName: string;
  legalName: string;
  address: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
};

type Brand = {
  id: string;
  name: string;
  shortName: string | null;
  isActive: boolean;
  sortOrder: number;
  supplierLinks: Array<{ id: string; supplierId: string; supplier: Supplier }>;
};

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'brands', label: 'Brands' }
];

export default function InventorySuppliersPage() {
  const [tab, setTab] = useState<Tab>('suppliers');
  const [caps, setCaps] = useState<Caps>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [shortName, setShortName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [supplierSortOrder, setSupplierSortOrder] = useState('1000');

  const [brandName, setBrandName] = useState('');
  const [brandShortName, setBrandShortName] = useState('');
  const [brandSortOrder, setBrandSortOrder] = useState('1000');
  const [linkSupplierId, setLinkSupplierId] = useState('');

  async function loadAll() {
    const [capsRow, supplierRows, brandRows] = await Promise.all([
      apiFetch('/app-api/inventory/capabilities') as Promise<Caps>,
      apiFetch('/app-api/inventory/suppliers') as Promise<Supplier[]>,
      apiFetch('/app-api/inventory/brands') as Promise<Brand[]>
    ]);
    setCaps(capsRow);
    setSuppliers(supplierRows);
    setBrands(brandRows);
    if (!linkSupplierId && supplierRows[0]?.id) setLinkSupplierId(supplierRows[0].id);
  }

  useEffect(() => {
    loadAll().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suppliersById = useMemo(() => new Map(suppliers.map((row) => [row.id, row])), [suppliers]);

  async function createSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/inventory/suppliers', {
      method: 'POST',
      body: JSON.stringify({
        shortName,
        legalName,
        sortOrder: Number(supplierSortOrder)
      })
    });
    setShortName('');
    setLegalName('');
    setSupplierSortOrder('1000');
    await loadAll();
  }

  async function createBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/inventory/brands', {
      method: 'POST',
      body: JSON.stringify({
        name: brandName,
        shortName: brandShortName || null,
        sortOrder: Number(brandSortOrder)
      })
    });
    setBrandName('');
    setBrandShortName('');
    setBrandSortOrder('1000');
    await loadAll();
  }

  async function editSupplier(row: Supplier) {
    const nextShortName = window.prompt('Short Name', row.shortName);
    if (nextShortName === null) return;
    const nextLegalName = window.prompt('Legal Name', row.legalName);
    if (nextLegalName === null) return;
    const nextSortOrder = window.prompt('Sort Order', String(row.sortOrder));
    if (nextSortOrder === null) return;

    await apiFetch(`/app-api/inventory/suppliers/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        shortName: nextShortName,
        legalName: nextLegalName,
        sortOrder: Number(nextSortOrder)
      })
    });
    await loadAll();
  }

  async function editBrand(row: Brand) {
    const nextName = window.prompt('Brand Name', row.name);
    if (nextName === null) return;
    const nextShortName = window.prompt('Short Name', row.shortName ?? '');
    if (nextShortName === null) return;
    const nextSortOrder = window.prompt('Sort Order', String(row.sortOrder));
    if (nextSortOrder === null) return;

    await apiFetch(`/app-api/inventory/brands/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: nextName,
        shortName: nextShortName || null,
        sortOrder: Number(nextSortOrder)
      })
    });
    await loadAll();
  }

  async function toggleSupplier(row: Supplier) {
    await apiFetch(`/app-api/inventory/suppliers/${row.id}/${row.isActive ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await loadAll();
  }

  async function toggleBrand(row: Brand) {
    await apiFetch(`/app-api/inventory/brands/${row.id}/${row.isActive ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await loadAll();
  }

  async function deleteSupplier(row: Supplier) {
    if (!window.confirm(`${row.shortName} silinsin mi?`)) return;
    try {
      await apiFetch(`/app-api/inventory/suppliers/${row.id}`, { method: 'DELETE' });
      await loadAll();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function deleteBrand(row: Brand) {
    if (!window.confirm(`${row.name} silinsin mi?`)) return;
    try {
      await apiFetch(`/app-api/inventory/brands/${row.id}`, { method: 'DELETE' });
      await loadAll();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function linkSupplier(brandId: string) {
    if (!linkSupplierId) return;
    await apiFetch(`/app-api/inventory/brands/${brandId}/link-supplier`, {
      method: 'POST',
      body: JSON.stringify({ supplierId: linkSupplierId })
    });
    await loadAll();
  }

  async function unlinkSupplier(brandId: string, supplierId: string) {
    await apiFetch(`/app-api/inventory/brands/${brandId}/unlink-supplier`, {
      method: 'POST',
      body: JSON.stringify({ supplierId })
    });
    await loadAll();
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Inventory Suppliers</h1>
          <p className="text-sm text-slate-600">Manage tenant-specific suppliers and brand principal links.</p>
        </div>
        <Link href="/app/inventory" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
          Back to Inventory
        </Link>
      </header>

      <div className="flex gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded px-3 py-2 text-sm ${tab === item.key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'suppliers' ? (
        <div className="space-y-4">
          {caps.manageSuppliers ? (
            <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={(event) => createSupplier(event).catch(handleApiError)}>
              <input className="rounded border px-3 py-2" placeholder="Short Name" value={shortName} onChange={(event) => setShortName(event.target.value)} required />
              <input className="rounded border px-3 py-2" placeholder="Legal Name" value={legalName} onChange={(event) => setLegalName(event.target.value)} required />
              <input className="rounded border px-3 py-2" type="number" min={0} placeholder="Sort Order" value={supplierSortOrder} onChange={(event) => setSupplierSortOrder(event.target.value)} />
              <button className="rounded bg-mono-500 px-3 py-2 text-white">Create Supplier</button>
            </form>
          ) : null}

          <table className="w-full rounded bg-white text-sm shadow-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Legal Name</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Sort Order</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{row.shortName}</td>
                  <td className="px-3 py-2">{row.legalName}</td>
                  <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2">{row.sortOrder}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => editSupplier(row).catch(handleApiError)} disabled={!caps.manageSuppliers}>Edit</button>
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleSupplier(row).catch(handleApiError)} disabled={!caps.manageSuppliers}>
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => deleteSupplier(row)} disabled={!caps.manageSuppliers}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'brands' ? (
        <div className="space-y-4">
          {caps.manageBrands ? (
            <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={(event) => createBrand(event).catch(handleApiError)}>
              <input className="rounded border px-3 py-2" placeholder="Brand Name" value={brandName} onChange={(event) => setBrandName(event.target.value)} required />
              <input className="rounded border px-3 py-2" placeholder="Short Name (optional)" value={brandShortName} onChange={(event) => setBrandShortName(event.target.value)} />
              <input className="rounded border px-3 py-2" type="number" min={0} placeholder="Sort Order" value={brandSortOrder} onChange={(event) => setBrandSortOrder(event.target.value)} />
              <button className="rounded bg-mono-500 px-3 py-2 text-white">Create Brand</button>
            </form>
          ) : null}

          <table className="w-full rounded bg-white text-sm shadow-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Short Name</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Sort Order</th>
                <th className="px-3 py-2 text-left">Linked Suppliers</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.shortName ?? '-'}</td>
                  <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2">{row.sortOrder}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-2">
                      {row.supplierLinks.map((link) => (
                        <div key={link.id} className="flex items-center gap-2">
                          <span>{link.supplier.shortName}</span>
                          <button
                            className="rounded border px-2 py-0.5 text-xs"
                            onClick={() => unlinkSupplier(row.id, link.supplierId).catch(handleApiError)}
                            disabled={!caps.manageBrands}
                          >
                            Unlink
                          </button>
                        </div>
                      ))}
                      {row.supplierLinks.length === 0 ? <span className="text-xs text-slate-500">No supplier linked</span> : null}
                      <div className="flex gap-2">
                        <select className="rounded border px-2 py-1 text-xs" value={linkSupplierId} onChange={(event) => setLinkSupplierId(event.target.value)}>
                          <option value="">Select supplier</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id} disabled={!supplier.isActive}>
                              {supplier.shortName} {supplier.isActive ? '' : '(inactive)'}
                            </option>
                          ))}
                        </select>
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => linkSupplier(row.id).catch(handleApiError)} disabled={!caps.manageBrands || !suppliersById.get(linkSupplierId)}>
                          Link
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => editBrand(row).catch(handleApiError)} disabled={!caps.manageBrands}>Edit</button>
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleBrand(row).catch(handleApiError)} disabled={!caps.manageBrands}>
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => deleteBrand(row)} disabled={!caps.manageBrands}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
