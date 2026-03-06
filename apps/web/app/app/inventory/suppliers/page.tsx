'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch, handleApiError } from '../../../../lib/api';
import { TR_CITIES, TR_CITY_DISTRICTS } from '../../../../lib/tr-cities';

type Tab = 'suppliers' | 'brands';
type SupplierSortBy = 'shortName' | 'legalName' | 'taxOffice' | 'taxNumber' | 'status' | null;
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
  addressLine: string | null;
  city: string | null;
  district: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
  brandLinks?: Array<{ id: string }>;
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

const emptySupplierForm = {
  shortName: '',
  legalName: '',
  taxOffice: '',
  taxNumber: '',
  addressLine: '',
  city: '',
  district: '',
  isActive: true
};

function supplierNames(row: Brand) {
  return row.supplierLinks
    .map((item) => item.supplier.shortName || item.supplier.legalName)
    .filter(Boolean)
    .join(', ');
}

function sortIndicator(activeSort: string | null, activeDirection: 'asc' | 'desc', column: string) {
  if (activeSort !== column) return '↕';
  return activeDirection === 'asc' ? '↑' : '↓';
}

export default function InventorySuppliersPage() {
  const [tab, setTab] = useState<Tab>('suppliers');
  const [caps, setCaps] = useState<Caps>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editSupplierForm, setEditSupplierForm] = useState(emptySupplierForm);

  const [supplierSearch, setSupplierSearch] = useState('');
  const [filterMissingBrandLink, setFilterMissingBrandLink] = useState(false);
  const [supplierSortBy, setSupplierSortBy] = useState<SupplierSortBy>(null);
  const [supplierSortDirection, setSupplierSortDirection] = useState<'asc' | 'desc'>('asc');

  const [brandName, setBrandName] = useState('');
  const [brandShortName, setBrandShortName] = useState('');
  const [brandSupplierId, setBrandSupplierId] = useState('');
  const [brandActive, setBrandActive] = useState(true);

  const [brandSearch, setBrandSearch] = useState('');
  const [filterMissingSupplier, setFilterMissingSupplier] = useState(false);
  const [brandSortBy, setBrandSortBy] = useState<BrandSortBy>(null);
  const [brandSortDirection, setBrandSortDirection] = useState<'asc' | 'desc'>('asc');

  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editBrandName, setEditBrandName] = useState('');
  const [editBrandShortName, setEditBrandShortName] = useState('');
  const [editBrandSupplierId, setEditBrandSupplierId] = useState('');
  const [editBrandActive, setEditBrandActive] = useState(true);

  const districts = useMemo(() => {
    if (!supplierForm.city) return [];
    return TR_CITY_DISTRICTS[supplierForm.city] ?? [];
  }, [supplierForm.city]);

  const editDistricts = useMemo(() => {
    if (!editSupplierForm.city) return [];
    return TR_CITY_DISTRICTS[editSupplierForm.city] ?? [];
  }, [editSupplierForm.city]);

  const suppliersById = useMemo(() => new Map(suppliers.map((row) => [row.id, row])), [suppliers]);

  function buildSupplierPath() {
    const params = new URLSearchParams();
    if (supplierSearch.trim()) params.set('search', supplierSearch.trim());
    if (filterMissingBrandLink) params.set('filterMissingBrandLink', 'true');
    if (supplierSortBy) {
      params.set('sortBy', supplierSortBy);
      params.set('sortDirection', supplierSortDirection);
    }
    const query = params.toString();
    return query ? `/app-api/inventory/suppliers?${query}` : '/app-api/inventory/suppliers';
  }

  function buildBrandPath() {
    const params = new URLSearchParams();
    if (brandSearch.trim()) params.set('search', brandSearch.trim());
    if (filterMissingSupplier) params.set('filterMissingSupplier', 'true');
    if (brandSortBy) {
      params.set('sortBy', brandSortBy);
      params.set('sortDirection', brandSortDirection);
    }
    const query = params.toString();
    return query ? `/app-api/inventory/brands?${query}` : '/app-api/inventory/brands';
  }

  async function loadSuppliersAndCaps() {
    const [capsRow, supplierRows] = await Promise.all([
      apiFetch('/app-api/inventory/capabilities') as Promise<Caps>,
      apiFetch(buildSupplierPath()) as Promise<Supplier[]>
    ]);
    setCaps(capsRow);
    setSuppliers(supplierRows);
    if (!brandSupplierId && supplierRows[0]?.id) {
      setBrandSupplierId(supplierRows[0].id);
    }
  }

  async function loadBrands() {
    const rows = (await apiFetch(buildBrandPath())) as Brand[];
    setBrands(rows);
  }

  useEffect(() => {
    Promise.all([loadSuppliersAndCaps(), loadBrands()]).catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSuppliersAndCaps().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierSearch, filterMissingBrandLink, supplierSortBy, supplierSortDirection]);

  useEffect(() => {
    loadBrands().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSearch, filterMissingSupplier, brandSortBy, brandSortDirection]);

  function sanitizeTaxNumber(value: string) {
    return value.replace(/\D/g, '');
  }

  function onSupplierSort(column: Exclude<SupplierSortBy, null>) {
    if (supplierSortBy !== column) {
      setSupplierSortBy(column);
      setSupplierSortDirection('asc');
      return;
    }
    if (supplierSortDirection === 'asc') {
      setSupplierSortDirection('desc');
      return;
    }
    setSupplierSortBy(null);
    setSupplierSortDirection('asc');
  }

  function onBrandSort(column: Exclude<BrandSortBy, null>) {
    if (brandSortBy !== column) {
      setBrandSortBy(column);
      setBrandSortDirection('asc');
      return;
    }
    if (brandSortDirection === 'asc') {
      setBrandSortDirection('desc');
      return;
    }
    setBrandSortBy(null);
    setBrandSortDirection('asc');
  }

  async function createSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/inventory/suppliers', {
      method: 'POST',
      body: JSON.stringify({
        shortName: supplierForm.shortName,
        legalName: supplierForm.legalName,
        taxOffice: supplierForm.taxOffice || null,
        taxNumber: supplierForm.taxNumber || null,
        addressLine: supplierForm.addressLine || null,
        city: supplierForm.city || null,
        district: supplierForm.district || null,
        isActive: supplierForm.isActive,
        sortOrder: Number(DEFAULT_SUPPLIER_SORT)
      })
    });
    setSupplierForm(emptySupplierForm);
    await loadSuppliersAndCaps();
  }

  function openEditSupplier(row: Supplier) {
    setEditingSupplier(row);
    setEditSupplierForm({
      shortName: row.shortName,
      legalName: row.legalName,
      taxOffice: row.taxOffice ?? '',
      taxNumber: row.taxNumber ?? '',
      addressLine: row.addressLine ?? row.address ?? '',
      city: row.city ?? '',
      district: row.district ?? '',
      isActive: row.isActive
    });
  }

  async function saveEditSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSupplier) return;
    await apiFetch(`/app-api/inventory/suppliers/${editingSupplier.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        shortName: editSupplierForm.shortName,
        legalName: editSupplierForm.legalName,
        taxOffice: editSupplierForm.taxOffice || null,
        taxNumber: editSupplierForm.taxNumber || null,
        addressLine: editSupplierForm.addressLine || null,
        city: editSupplierForm.city || null,
        district: editSupplierForm.district || null,
        isActive: editSupplierForm.isActive
      })
    });
    setEditingSupplier(null);
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

  async function linkSupplier(brandId: string) {
    if (!brandSupplierId) return;
    await apiFetch(`/app-api/inventory/brands/${brandId}/link-supplier`, {
      method: 'POST',
      body: JSON.stringify({ supplierId: brandSupplierId })
    });
    await loadBrands();
  }

  async function unlinkSupplier(brandId: string, supplierId: string) {
    await apiFetch(`/app-api/inventory/brands/${brandId}/unlink-supplier`, {
      method: 'POST',
      body: JSON.stringify({ supplierId })
    });
    await loadBrands();
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
            <form className="rounded bg-white p-4 shadow-sm" onSubmit={(event) => createSupplier(event).catch(handleApiError)}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Dağıtıcı Adı</span>
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="Örn. Gürpa"
                    value={supplierForm.shortName}
                    onChange={(event) => setSupplierForm((prev) => ({ ...prev, shortName: event.target.value }))}
                    required
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Legal Name</span>
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="Örn. Gürpa Gürtekin Pazarlama ve Ticaret A.Ş."
                    value={supplierForm.legalName}
                    onChange={(event) => setSupplierForm((prev) => ({ ...prev, legalName: event.target.value }))}
                    required
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Vergi Dairesi</span>
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="Örn. Marmara Kurumlar"
                    value={supplierForm.taxOffice}
                    onChange={(event) => setSupplierForm((prev) => ({ ...prev, taxOffice: event.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Vergi Numarası</span>
                  <input
                    className="w-full rounded border px-3 py-2"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Örn. 4460266395"
                    value={supplierForm.taxNumber}
                    onChange={(event) => setSupplierForm((prev) => ({ ...prev, taxNumber: sanitizeTaxNumber(event.target.value) }))}
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium">Açık Adres</span>
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="Mahalle, sokak, bina no..."
                    value={supplierForm.addressLine}
                    onChange={(event) => setSupplierForm((prev) => ({ ...prev, addressLine: event.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">İl</span>
                  <select
                    className="w-full rounded border px-3 py-2"
                    value={supplierForm.city}
                    onChange={(event) => setSupplierForm((prev) => ({ ...prev, city: event.target.value, district: '' }))}
                  >
                    <option value="">Seçiniz</option>
                    {TR_CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">İlçe</span>
                  <select
                    className="w-full rounded border px-3 py-2"
                    value={supplierForm.district}
                    onChange={(event) => setSupplierForm((prev) => ({ ...prev, district: event.target.value }))}
                    disabled={!supplierForm.city}
                  >
                    <option value="">Seçiniz</option>
                    {districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={supplierForm.isActive}
                    onChange={(event) => setSupplierForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  <span>Durum: {supplierForm.isActive ? 'Aktif' : 'Pasif'}</span>
                </label>
              </div>
              <div className="mt-4">
                <button className="rounded bg-mono-500 px-3 py-2 text-white">Dağıtıcı Ekle</button>
              </div>
            </form>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 rounded bg-white p-3 shadow-sm">
            <input
              className="min-w-[240px] flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Dağıtıcı, legal name, vergi dairesi veya vergi no ara"
              value={supplierSearch}
              onChange={(event) => setSupplierSearch(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={filterMissingBrandLink} onChange={(event) => setFilterMissingBrandLink(event.target.checked)} />
              Sadece markaya linklenmemiş olanları göster
            </label>
          </div>

          <table className="w-full rounded bg-white text-sm shadow-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => onSupplierSort('shortName')}>
                    Dağıtıcı Adı <span className="text-xs text-slate-500">{sortIndicator(supplierSortBy, supplierSortDirection, 'shortName')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => onSupplierSort('legalName')}>
                    Legal Name <span className="text-xs text-slate-500">{sortIndicator(supplierSortBy, supplierSortDirection, 'legalName')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => onSupplierSort('taxOffice')}>
                    Vergi Dairesi <span className="text-xs text-slate-500">{sortIndicator(supplierSortBy, supplierSortDirection, 'taxOffice')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => onSupplierSort('taxNumber')}>
                    Vergi Numarası <span className="text-xs text-slate-500">{sortIndicator(supplierSortBy, supplierSortDirection, 'taxNumber')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => onSupplierSort('status')}>
                    Status <span className="text-xs text-slate-500">{sortIndicator(supplierSortBy, supplierSortDirection, 'status')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((row) => {
                const missingBrandLink = (row.brandLinks?.length ?? 0) === 0;
                return (
                  <tr key={row.id} className={`border-t ${missingBrandLink ? 'bg-amber-50' : ''}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.shortName}</div>
                      {missingBrandLink ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Marka Linki Eksik</span> : null}
                    </td>
                    <td className="px-3 py-2">{row.legalName}</td>
                    <td className="px-3 py-2">{row.taxOffice ?? '-'}</td>
                    <td className="px-3 py-2">{row.taxNumber ?? '-'}</td>
                    <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => openEditSupplier(row)} disabled={!caps.manageSuppliers}>Edit</button>
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleSupplier(row).catch(handleApiError)} disabled={!caps.manageSuppliers}>
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => deleteSupplier(row)} disabled={!caps.manageSuppliers}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
                  <button className="inline-flex items-center gap-1" onClick={() => onBrandSort('name')}>
                    Marka Adı <span className="text-xs text-slate-500">{sortIndicator(brandSortBy, brandSortDirection, 'name')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => onBrandSort('status')}>
                    Status <span className="text-xs text-slate-500">{sortIndicator(brandSortBy, brandSortDirection, 'status')}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => onBrandSort('supplier')}>
                    Linked Supplier <span className="text-xs text-slate-500">{sortIndicator(brandSortBy, brandSortDirection, 'supplier')}</span>
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

      {editingSupplier ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Dağıtıcı Düzenle</h2>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => saveEditSupplier(event).catch(handleApiError)}>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Dağıtıcı Adı</span>
                <input className="w-full rounded border px-3 py-2" value={editSupplierForm.shortName} onChange={(event) => setEditSupplierForm((prev) => ({ ...prev, shortName: event.target.value }))} required />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Legal Name</span>
                <input className="w-full rounded border px-3 py-2" value={editSupplierForm.legalName} onChange={(event) => setEditSupplierForm((prev) => ({ ...prev, legalName: event.target.value }))} required />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Vergi Dairesi</span>
                <input className="w-full rounded border px-3 py-2" value={editSupplierForm.taxOffice} onChange={(event) => setEditSupplierForm((prev) => ({ ...prev, taxOffice: event.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Vergi Numarası</span>
                <input className="w-full rounded border px-3 py-2" inputMode="numeric" pattern="[0-9]*" value={editSupplierForm.taxNumber} onChange={(event) => setEditSupplierForm((prev) => ({ ...prev, taxNumber: sanitizeTaxNumber(event.target.value) }))} />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="font-medium">Açık Adres</span>
                <input className="w-full rounded border px-3 py-2" value={editSupplierForm.addressLine} onChange={(event) => setEditSupplierForm((prev) => ({ ...prev, addressLine: event.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">İl</span>
                <select className="w-full rounded border px-3 py-2" value={editSupplierForm.city} onChange={(event) => setEditSupplierForm((prev) => ({ ...prev, city: event.target.value, district: '' }))}>
                  <option value="">Seçiniz</option>
                  {TR_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">İlçe</span>
                <select className="w-full rounded border px-3 py-2" value={editSupplierForm.district} onChange={(event) => setEditSupplierForm((prev) => ({ ...prev, district: event.target.value }))} disabled={!editSupplierForm.city}>
                  <option value="">Seçiniz</option>
                  {editDistricts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" checked={editSupplierForm.isActive} onChange={(event) => setEditSupplierForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
                <span>Durum: {editSupplierForm.isActive ? 'Aktif' : 'Pasif'}</span>
              </label>
              <div className="flex justify-end gap-2 md:col-span-2">
                <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setEditingSupplier(null)}>
                  Vazgeç
                </button>
                <button className="rounded bg-mono-500 px-3 py-2 text-sm text-white">Kaydet</button>
              </div>
            </form>
          </div>
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
