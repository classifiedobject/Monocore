'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch, handleApiError } from '../../../../lib/api';

type Tab = 'suppliers' | 'brands';
type BrandSortBy = 'name' | 'status' | 'supplier' | null;

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

const DEFAULT_SUPPLIER_SORT = '1000';

function supplierNames(row: Brand) {
  return row.supplierLinks
    .map((item) => item.supplier.shortName || item.supplier.legalName)
    .filter(Boolean)
    .join(', ');
}

function sortIndicator(activeSort: BrandSortBy, activeDirection: 'asc' | 'desc', column: Exclude<BrandSortBy, null>) {
  if (activeSort !== column) return '↕';
  return activeDirection === 'asc' ? '↑' : '↓';
}

export default function InventorySuppliersPage() {
  const [tab, setTab] = useState<Tab>('suppliers');
  const [caps, setCaps] = useState<Caps>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [shortName, setShortName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [supplierSortOrder, setSupplierSortOrder] = useState(DEFAULT_SUPPLIER_SORT);

  const [brandName, setBrandName] = useState('');
  const [brandShortName, setBrandShortName] = useState('');
  const [brandSupplierId, setBrandSupplierId] = useState('');
  const [brandActive, setBrandActive] = useState(true);

  const [brandSearch, setBrandSearch] = useState('');
  const [filterMissingSupplier, setFilterMissingSupplier] = useState(false);
  const [sortBy, setSortBy] = useState<BrandSortBy>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editBrandName, setEditBrandName] = useState('');
  const [editBrandShortName, setEditBrandShortName] = useState('');
  const [editBrandSupplierId, setEditBrandSupplierId] = useState('');
  const [editBrandActive, setEditBrandActive] = useState(true);

  async function loadSuppliersAndCaps() {
    const [capsRow, supplierRows] = await Promise.all([
      apiFetch('/app-api/inventory/capabilities') as Promise<Caps>,
      apiFetch('/app-api/inventory/suppliers') as Promise<Supplier[]>
    ]);
    setCaps(capsRow);
    setSuppliers(supplierRows);
    if (!brandSupplierId && supplierRows[0]?.id) {
      setBrandSupplierId(supplierRows[0].id);
    }
  }

  async function loadBrands() {
    const params = new URLSearchParams();
    if (brandSearch.trim()) params.set('search', brandSearch.trim());
    if (filterMissingSupplier) params.set('filterMissingSupplier', 'true');
    if (sortBy) {
      params.set('sortBy', sortBy);
      params.set('sortDirection', sortDirection);
    }
    const query = params.toString();
    const path = query ? `/app-api/inventory/brands?${query}` : '/app-api/inventory/brands';
    const rows = (await apiFetch(path)) as Brand[];
    setBrands(rows);
  }

  useEffect(() => {
    Promise.all([loadSuppliersAndCaps(), loadBrands()]).catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBrands().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSearch, filterMissingSupplier, sortBy, sortDirection]);

  const suppliersById = useMemo(() => new Map(suppliers.map((row) => [row.id, row])), [suppliers]);

  function onSort(column: Exclude<BrandSortBy, null>) {
    if (sortBy !== column) {
      setSortBy(column);
      setSortDirection('asc');
      return;
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }
    setSortBy(null);
    setSortDirection('asc');
  }

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
    setSupplierSortOrder(DEFAULT_SUPPLIER_SORT);
    await loadSuppliersAndCaps();
  }

  async function createBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = (await apiFetch('/app-api/inventory/brands', {
      method: 'POST',
      body: JSON.stringify({
        name: brandName,
        shortName: brandShortName || null,
        isActive: brandActive
      })
    })) as Brand;

    if (brandSupplierId) {
      await apiFetch(`/app-api/inventory/brands/${created.id}/link-supplier`, {
        method: 'POST',
        body: JSON.stringify({ supplierId: brandSupplierId })
      });
    }

    setBrandName('');
    setBrandShortName('');
    setBrandActive(true);
    await loadBrands();
  }

  function openEditBrand(row: Brand) {
    setEditingBrand(row);
    setEditBrandName(row.name);
    setEditBrandShortName(row.shortName ?? '');
    setEditBrandSupplierId(row.supplierLinks[0]?.supplierId ?? '');
    setEditBrandActive(row.isActive);
  }

  async function saveEditBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBrand) return;

    await apiFetch(`/app-api/inventory/brands/${editingBrand.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editBrandName,
        shortName: editBrandShortName || null,
        isActive: editBrandActive
      })
    });

    const currentSupplierIds = new Set(editingBrand.supplierLinks.map((item) => item.supplierId));
    for (const supplierId of currentSupplierIds) {
      if (supplierId !== editBrandSupplierId) {
        await apiFetch(`/app-api/inventory/brands/${editingBrand.id}/unlink-supplier`, {
          method: 'POST',
          body: JSON.stringify({ supplierId })
        });
      }
    }

    if (editBrandSupplierId && !currentSupplierIds.has(editBrandSupplierId)) {
      await apiFetch(`/app-api/inventory/brands/${editingBrand.id}/link-supplier`, {
        method: 'POST',
        body: JSON.stringify({ supplierId: editBrandSupplierId })
      });
    }

    setEditingBrand(null);
    await loadBrands();
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
    await loadSuppliersAndCaps();
  }

  async function toggleSupplier(row: Supplier) {
    await apiFetch(`/app-api/inventory/suppliers/${row.id}/${row.isActive ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await loadSuppliersAndCaps();
  }

  async function toggleBrand(row: Brand) {
    await apiFetch(`/app-api/inventory/brands/${row.id}/${row.isActive ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await loadBrands();
  }

  async function deleteSupplier(row: Supplier) {
    if (!window.confirm(`${row.shortName} silinsin mi?`)) return;
    try {
      await apiFetch(`/app-api/inventory/suppliers/${row.id}`, { method: 'DELETE' });
      await loadSuppliersAndCaps();
    } catch (error) {
      handleApiError(error);
    }
  }

  async function deleteBrand(row: Brand) {
    if (!window.confirm(`${row.name} silinsin mi?`)) return;
    try {
      await apiFetch(`/app-api/inventory/brands/${row.id}`, { method: 'DELETE' });
      await loadBrands();
    } catch (error) {
      handleApiError(error);
    }
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
            <form className="rounded bg-white p-4 shadow-sm" onSubmit={(event) => createBrand(event).catch(handleApiError)}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Marka Adı</span>
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="Örn. Diageo"
                    value={brandName}
                    onChange={(event) => setBrandName(event.target.value)}
                    required
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Kısa Ad (opsiyonel)</span>
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="Örn. DGEO"
                    value={brandShortName}
                    onChange={(event) => setBrandShortName(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Distribütör / Fatura Keseni</span>
                  <select className="w-full rounded border px-3 py-2" value={brandSupplierId} onChange={(event) => setBrandSupplierId(event.target.value)}>
                    <option value="">Seçilmedi</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id} disabled={!supplier.isActive}>
                        {supplier.shortName} {supplier.isActive ? '' : '(inactive)'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Bu markanın ürünleri için kullanılan distribütör veya fatura kesen firma</p>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={brandActive} onChange={(event) => setBrandActive(event.target.checked)} />
                  <span>Durum: {brandActive ? 'Aktif' : 'Pasif'}</span>
                </label>
              </div>
              <div className="mt-4">
                <button className="rounded bg-mono-500 px-3 py-2 text-white">Marka Ekle</button>
              </div>
            </form>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 rounded bg-white p-3 shadow-sm">
            <input
              className="min-w-[240px] flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Marka, kısa ad veya distribütör ara"
              value={brandSearch}
              onChange={(event) => setBrandSearch(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={filterMissingSupplier} onChange={(event) => setFilterMissingSupplier(event.target.checked)} />
              Sadece distribütörü eksik olanları göster
            </label>
          </div>

          <table className="w-full rounded bg-white text-sm shadow-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => onSort('name')}>
                    Marka Adı <span className="text-xs text-slate-500">{sortIndicator(sortBy, sortDirection, 'name')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => onSort('status')}>
                    Status <span className="text-xs text-slate-500">{sortIndicator(sortBy, sortDirection, 'status')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => onSort('supplier')}>
                    Linked Supplier <span className="text-xs text-slate-500">{sortIndicator(sortBy, sortDirection, 'supplier')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((row) => {
                const missingSupplier = row.supplierLinks.length === 0;
                return (
                  <tr key={row.id} className={`border-t ${missingSupplier ? 'bg-amber-50' : ''}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.name}</div>
                      {row.shortName ? <div className="text-xs text-slate-500">{row.shortName}</div> : null}
                    </td>
                    <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-3 py-2">
                      {missingSupplier ? <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">Distribütör Eksik</span> : supplierNames(row)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => openEditBrand(row)} disabled={!caps.manageBrands}>
                          Edit
                        </button>
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleBrand(row).catch(handleApiError)} disabled={!caps.manageBrands}>
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => deleteBrand(row)} disabled={!caps.manageBrands}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {editingBrand ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Marka Düzenle</h2>
            <form className="mt-4 space-y-3" onSubmit={(event) => saveEditBrand(event).catch(handleApiError)}>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Marka Adı</span>
                <input className="w-full rounded border px-3 py-2" placeholder="Örn. Diageo" value={editBrandName} onChange={(event) => setEditBrandName(event.target.value)} required />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Kısa Ad (opsiyonel)</span>
                <input className="w-full rounded border px-3 py-2" placeholder="Örn. DGEO" value={editBrandShortName} onChange={(event) => setEditBrandShortName(event.target.value)} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Distribütör / Fatura Keseni</span>
                <select className="w-full rounded border px-3 py-2" value={editBrandSupplierId} onChange={(event) => setEditBrandSupplierId(event.target.value)}>
                  <option value="">Seçilmedi</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id} disabled={!supplier.isActive}>
                      {supplier.shortName} {supplier.isActive ? '' : '(inactive)'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">Bu markanın ürünleri için kullanılan distribütör veya fatura kesen firma</p>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editBrandActive} onChange={(event) => setEditBrandActive(event.target.checked)} />
                <span>Durum: {editBrandActive ? 'Aktif' : 'Pasif'}</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setEditingBrand(null)}>
                  Vazgeç
                </button>
                <button className="rounded bg-mono-500 px-3 py-2 text-sm text-white">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
