'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApiError, apiFetch, handleApiError } from '../../../../lib/api';

type InventoryCapabilities = {
  manageItem?: boolean;
  readItems?: boolean;
};

type Brand = {
  id: string;
  name: string;
  isActive: boolean;
};

type Item = {
  id: string;
  code: string | null;
  name: string;
  sku: string | null;
  brandId: string | null;
  mainStockArea: 'BAR' | 'KITCHEN' | 'OTHER';
  attributeCategory: 'ALCOHOL' | 'SOFT' | 'KITCHEN' | 'OTHER';
  subCategory: string | null;
  baseUom: 'CL' | 'ML' | 'GRAM' | 'KG' | 'PIECE';
  packageUom: 'BOTTLE' | 'PACK' | 'PIECE' | null;
  packageSizeBase: string | null;
  purchaseVatRate: string;
  listPriceExVat: string | null;
  discountRate: string;
  priceDate: string;
  computedPriceIncVat: string | null;
  lastPurchaseUnitCost: string | null;
  isActive: boolean;
  brand: Brand | null;
};

type CreateFormState = {
  brandId: string;
  name: string;
  packageSizeBase: string;
  baseUom: 'CL' | 'ML' | 'GRAM' | 'KG' | 'PIECE';
  listPriceExVat: string;
  discountRatePercent: string;
  priceDate: string;
  purchaseVatRatePercent: string;
  mainStockArea: 'BAR' | 'KITCHEN' | 'OTHER';
  attributeCategory: 'ALCOHOL' | 'SOFT' | 'KITCHEN' | 'OTHER';
  subCategory: string;
};

type EditFormState = {
  brandId: string;
  name: string;
  packageSizeBase: string;
  baseUom: 'CL' | 'ML' | 'GRAM' | 'KG' | 'PIECE';
  listPriceExVat: string;
  discountRatePercent: string;
  priceDate: string;
  purchaseVatRatePercent: string;
  mainStockArea: 'BAR' | 'KITCHEN' | 'OTHER';
  attributeCategory: 'ALCOHOL' | 'SOFT' | 'KITCHEN' | 'OTHER';
  subCategory: string;
  packageUom: '' | 'BOTTLE' | 'PACK' | 'PIECE';
};

type SortKey = 'code' | 'brand' | 'name' | 'packageSizeBase' | 'subCategory' | 'priceDate' | 'listPriceExVat' | 'discountRate' | 'grossPrice' | 'status' | null;

const defaultCreateForm: CreateFormState = {
  brandId: '',
  name: '',
  packageSizeBase: '',
  baseUom: 'PIECE',
  listPriceExVat: '',
  discountRatePercent: '0',
  priceDate: '',
  purchaseVatRatePercent: '20',
  mainStockArea: 'OTHER',
  attributeCategory: 'OTHER',
  subCategory: ''
};

const defaultEditForm: EditFormState = {
  ...defaultCreateForm,
  packageUom: ''
};

function parseMaybeNumber(value: string) {
  if (!value.trim()) return null;
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPercentString(decimalValue: string | null | undefined, fallback = '0') {
  if (decimalValue === null || decimalValue === undefined || decimalValue === '') return fallback;
  const asNumber = Number(decimalValue);
  if (!Number.isFinite(asNumber)) return fallback;
  return String((asNumber * 100).toFixed(2)).replace(/\.00$/, '');
}

function toMoney(value: string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return '-';
  return asNumber.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toQuantity(value: string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return '-';
  return asNumber.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function toDateInputValue(isoString: string | null | undefined) {
  if (!isoString) return '';
  return new Date(isoString).toISOString().slice(0, 10);
}

function toDateDisplay(isoString: string | null | undefined) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR');
}

function computeIncVat(listPriceExVat: string, discountPercent: string, vatPercent: string) {
  const list = parseMaybeNumber(listPriceExVat);
  if (list === null) return null;
  const discount = parseMaybeNumber(discountPercent) ?? 0;
  const vat = parseMaybeNumber(vatPercent) ?? 0;
  const netExVat = list * (1 - discount / 100);
  const netIncVat = netExVat * (1 + vat / 100);
  return netIncVat;
}

function sortIndicator(activeSort: SortKey, activeDirection: 'asc' | 'desc', column: Exclude<SortKey, null>) {
  if (activeSort !== column) return '↕';
  return activeDirection === 'asc' ? '↑' : '↓';
}

export default function InventoryItemsPage() {
  const [caps, setCaps] = useState<InventoryCapabilities>({});
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateForm);
  const [pageError, setPageError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortKey>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditForm);

  const computedPreview = useMemo(
    () => computeIncVat(createForm.listPriceExVat, createForm.discountRatePercent, createForm.purchaseVatRatePercent),
    [createForm.discountRatePercent, createForm.listPriceExVat, createForm.purchaseVatRatePercent]
  );

  async function loadData() {
    setPageError(null);
    const [capsRes, itemsRes, brandsRes] = await Promise.allSettled([
      apiFetch('/app-api/inventory/capabilities') as Promise<InventoryCapabilities>,
      apiFetch('/app-api/inventory/items') as Promise<Item[]>,
      apiFetch('/app-api/inventory/brands') as Promise<Brand[]>
    ]);

    if (capsRes.status === 'fulfilled') setCaps(capsRes.value);

    if (itemsRes.status === 'fulfilled') {
      setItems(itemsRes.value);
    } else {
      const err = itemsRes.reason;
      if (err instanceof ApiError) {
        setPageError(`Items okunamadı (HTTP ${err.status}). Yetkinizi kontrol edin.`);
      } else {
        setPageError('Items yüklenemedi.');
      }
      handleApiError(err);
    }

    if (brandsRes.status === 'fulfilled') setBrands(brandsRes.value);
    else handleApiError(brandsRes.reason);
  }

  useEffect(() => {
    loadData().catch(handleApiError);
  }, []);

  function onSort(column: Exclude<SortKey, null>) {
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

  const visibleRows = useMemo(() => {
    const rows = [...items];
    const direction = sortDirection === 'asc' ? 1 : -1;

    const defaultSort = (a: Item, b: Item) => a.name.localeCompare(b.name, 'tr');

    rows.sort((a, b) => {
      if (!sortBy) return defaultSort(a, b);
      if (sortBy === 'code') return direction * (a.code ?? '').localeCompare(b.code ?? '', 'tr');
      if (sortBy === 'brand') return direction * (a.brand?.name ?? '').localeCompare(b.brand?.name ?? '', 'tr');
      if (sortBy === 'packageSizeBase') return direction * (Number(a.packageSizeBase ?? 0) - Number(b.packageSizeBase ?? 0));
      if (sortBy === 'subCategory') return direction * (a.subCategory ?? '').localeCompare(b.subCategory ?? '', 'tr');
      if (sortBy === 'priceDate') return direction * (new Date(a.priceDate).getTime() - new Date(b.priceDate).getTime());
      if (sortBy === 'listPriceExVat') return direction * (Number(a.listPriceExVat ?? 0) - Number(b.listPriceExVat ?? 0));
      if (sortBy === 'discountRate') return direction * (Number(a.discountRate) - Number(b.discountRate));
      if (sortBy === 'grossPrice') return direction * (Number(a.lastPurchaseUnitCost ?? a.computedPriceIncVat ?? 0) - Number(b.lastPurchaseUnitCost ?? b.computedPriceIncVat ?? 0));
      if (sortBy === 'status') {
        if (a.isActive === b.isActive) return direction * defaultSort(a, b);
        return direction * ((a.isActive ? 1 : 0) - (b.isActive ? 1 : 0));
      }
      return defaultSort(a, b);
    });

    return rows;
  }, [items, sortBy, sortDirection]);

  async function submitCreateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const vatPercent = parseMaybeNumber(createForm.purchaseVatRatePercent);
    const discountPercent = parseMaybeNumber(createForm.discountRatePercent);
    const packageSize = parseMaybeNumber(createForm.packageSizeBase);
    const listPriceExVat = parseMaybeNumber(createForm.listPriceExVat);

    if (vatPercent === null || vatPercent < 0 || vatPercent > 100) {
      setPageError('Alış KDV oranı 0 ile 100 arasında olmalı.');
      return;
    }
    if (discountPercent === null || discountPercent < 0 || discountPercent > 100) {
      setPageError('İskonto oranı 0 ile 100 arasında olmalı.');
      return;
    }
    if (packageSize === null || packageSize <= 0) {
      setPageError('Miktarı 0’dan büyük olmalı.');
      return;
    }

    await apiFetch('/app-api/inventory/items', {
      method: 'POST',
      body: JSON.stringify({
        brandId: createForm.brandId || null,
        name: createForm.name,
        packageSizeBase: packageSize,
        baseUom: createForm.baseUom,
        listPriceExVat,
        discountRate: discountPercent / 100,
        priceDate: createForm.priceDate || undefined,
        purchaseVatRate: vatPercent / 100,
        mainStockArea: createForm.mainStockArea,
        attributeCategory: createForm.attributeCategory,
        subCategory: createForm.subCategory || null
      })
    });

    setCreateForm(defaultCreateForm);
    await loadData();
  }

  function startEdit(item: Item) {
    setEditingItem(item);
    setEditForm({
      brandId: item.brandId ?? '',
      name: item.name,
      packageSizeBase: item.packageSizeBase ?? '',
      baseUom: item.baseUom,
      listPriceExVat: item.listPriceExVat ?? '',
      discountRatePercent: toPercentString(item.discountRate, '0'),
      priceDate: toDateInputValue(item.priceDate),
      purchaseVatRatePercent: toPercentString(item.purchaseVatRate, '20'),
      mainStockArea: item.mainStockArea,
      attributeCategory: item.attributeCategory,
      subCategory: item.subCategory ?? '',
      packageUom: item.packageUom ?? ''
    });
  }

  async function submitEditForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem) return;

    const vatPercent = parseMaybeNumber(editForm.purchaseVatRatePercent);
    const discountPercent = parseMaybeNumber(editForm.discountRatePercent);
    const packageSize = parseMaybeNumber(editForm.packageSizeBase);
    const listPriceExVat = parseMaybeNumber(editForm.listPriceExVat);

    if (vatPercent === null || vatPercent < 0 || vatPercent > 100) {
      setPageError('Alış KDV oranı 0 ile 100 arasında olmalı.');
      return;
    }
    if (discountPercent === null || discountPercent < 0 || discountPercent > 100) {
      setPageError('İskonto oranı 0 ile 100 arasında olmalı.');
      return;
    }
    if (packageSize === null || packageSize <= 0) {
      setPageError('Miktarı 0’dan büyük olmalı.');
      return;
    }

    await apiFetch(`/app-api/inventory/items/${editingItem.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        brandId: editForm.brandId || null,
        name: editForm.name,
        packageSizeBase: packageSize,
        baseUom: editForm.baseUom,
        listPriceExVat,
        discountRate: discountPercent / 100,
        priceDate: editForm.priceDate || undefined,
        purchaseVatRate: vatPercent / 100,
        mainStockArea: editForm.mainStockArea,
        attributeCategory: editForm.attributeCategory,
        subCategory: editForm.subCategory || null,
        packageUom: editForm.packageUom || null
      })
    });

    setEditingItem(null);
    setEditForm(defaultEditForm);
    await loadData();
  }

  async function toggleItem(item: Item) {
    await apiFetch(`/app-api/inventory/items/${item.id}/${item.isActive ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await loadData();
  }

  function grossPrice(item: Item) {
    return item.lastPurchaseUnitCost ?? item.computedPriceIncVat;
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Ürün Kartları</h1>
          <p className="text-sm text-slate-600">Stok ana verisini sade form ve operasyon odaklı liste ile yönetin.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/inventory/suppliers" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
            Marka & Distribütör
          </Link>
          <Link href="/app/inventory" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
            Stok Operasyonları
          </Link>
        </div>
      </header>

      {pageError ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{pageError}</div> : null}

      {caps.manageItem ? (
        <form className="space-y-4 rounded bg-white p-4 shadow-sm" onSubmit={(event) => submitCreateForm(event).catch(handleApiError)}>
          <div className="rounded border p-3">
            <h2 className="mb-3 font-semibold">Grup 1: Temel Ürün Kimliği</h2>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span>Ana Firma</span>
                <select className="h-10 w-full rounded border px-3 py-2" value={createForm.brandId} onChange={(event) => setCreateForm((prev) => ({ ...prev, brandId: event.target.value }))}>
                  <option value="">Seçiniz</option>
                  {brands.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Ürün Adı</span>
                <input className="h-10 w-full rounded border px-3 py-2" value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} required />
              </label>
              <label className="space-y-1 text-sm">
                <span>Miktarı</span>
                <input className="h-10 w-full rounded border px-3 py-2" type="number" min={0.0001} step="0.0001" value={createForm.packageSizeBase} onChange={(event) => setCreateForm((prev) => ({ ...prev, packageSizeBase: event.target.value }))} required />
              </label>
              <label className="space-y-1 text-sm">
                <span>Stok Takip Birimi</span>
                <select className="h-10 w-full rounded border px-3 py-2" value={createForm.baseUom} onChange={(event) => setCreateForm((prev) => ({ ...prev, baseUom: event.target.value as CreateFormState['baseUom'] }))}>
                  <option value="CL">cl</option>
                  <option value="ML">ml</option>
                  <option value="GRAM">gram</option>
                  <option value="KG">kg</option>
                  <option value="PIECE">adet</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded border p-3">
            <h2 className="mb-3 font-semibold">Grup 2: Satın Alma Fiyatlandırma</h2>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span>Liste Fiyatı (KDV Hariç)</span>
                <input className="h-10 w-full rounded border px-3 py-2" type="number" min={0} step="0.0001" value={createForm.listPriceExVat} onChange={(event) => setCreateForm((prev) => ({ ...prev, listPriceExVat: event.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <span>İskontosu</span>
                <input className="h-10 w-full rounded border px-3 py-2" type="number" min={0} max={100} step="0.01" value={createForm.discountRatePercent} onChange={(event) => setCreateForm((prev) => ({ ...prev, discountRatePercent: event.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Fiyat Tarihi</span>
                <input className="h-10 w-full rounded border px-3 py-2" type="date" value={createForm.priceDate} onChange={(event) => setCreateForm((prev) => ({ ...prev, priceDate: event.target.value }))} />
                <span className="block text-xs text-slate-500">Boş bırakırsanız ürün oluşturma tarihi kullanılır.</span>
              </label>
              <label className="space-y-1 text-sm">
                <span>Alış KDV Oranı</span>
                <input className="h-10 w-full rounded border px-3 py-2" type="number" min={0} max={100} step="0.01" value={createForm.purchaseVatRatePercent} onChange={(event) => setCreateForm((prev) => ({ ...prev, purchaseVatRatePercent: event.target.value }))} />
              </label>
            </div>
            <p className="mt-2 text-sm text-slate-600">Hesaplanan net alış (KDV dahil): <strong>{computedPreview === null ? '-' : toMoney(String(computedPreview))}</strong></p>
          </div>

          <div className="rounded border p-3">
            <h2 className="mb-3 font-semibold">Grup 3: Sınıflandırma</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span>Gelir Merkezi Kategorisi</span>
                <select className="h-10 w-full rounded border px-3 py-2" value={createForm.mainStockArea} onChange={(event) => setCreateForm((prev) => ({ ...prev, mainStockArea: event.target.value as CreateFormState['mainStockArea'] }))}>
                  <option value="BAR">Bar</option>
                  <option value="KITCHEN">Mutfak</option>
                  <option value="OTHER">Diğer</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Stok Kategorisi</span>
                <select className="h-10 w-full rounded border px-3 py-2" value={createForm.attributeCategory} onChange={(event) => setCreateForm((prev) => ({ ...prev, attributeCategory: event.target.value as CreateFormState['attributeCategory'] }))}>
                  <option value="ALCOHOL">Alkol</option>
                  <option value="SOFT">Soft</option>
                  <option value="KITCHEN">Mutfak</option>
                  <option value="OTHER">Diğer</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Ürün Grubu</span>
                <input className="h-10 w-full rounded border px-3 py-2" value={createForm.subCategory} onChange={(event) => setCreateForm((prev) => ({ ...prev, subCategory: event.target.value }))} />
              </label>
            </div>
          </div>

          <button className="rounded bg-mono-500 px-3 py-2 text-white">Ürün Oluştur</button>
        </form>
      ) : null}

      <table className="w-full rounded bg-white text-sm shadow-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('code')}>ID {sortIndicator(sortBy, sortDirection, 'code')}</button></th>
            <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('name')}>Ürün Adı {sortIndicator(sortBy, sortDirection, 'name')}</button></th>
            <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('packageSizeBase')}>Miktarı {sortIndicator(sortBy, sortDirection, 'packageSizeBase')}</button></th>
            <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('subCategory')}>Ürün Grubu {sortIndicator(sortBy, sortDirection, 'subCategory')}</button></th>
            <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('brand')}>Ana Firma {sortIndicator(sortBy, sortDirection, 'brand')}</button></th>
            <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('priceDate')}>Fiyat Tarihi {sortIndicator(sortBy, sortDirection, 'priceDate')}</button></th>
            <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('listPriceExVat')}>Liste Fiyatı {sortIndicator(sortBy, sortDirection, 'listPriceExVat')}</button></th>
            <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('discountRate')}>İskontosu {sortIndicator(sortBy, sortDirection, 'discountRate')}</button></th>
            <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('grossPrice')}>Brüt Fiyatı {sortIndicator(sortBy, sortDirection, 'grossPrice')}</button></th>
            <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('status')}>Durum {sortIndicator(sortBy, sortDirection, 'status')}</button></th>
            <th className="px-3 py-2 text-left">İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((item) => (
            <tr key={item.id} className={`border-t ${item.isActive ? '' : 'bg-rose-50'}`}>
              <td className="px-3 py-2">{item.code ?? '-'}</td>
              <td className="px-3 py-2">{item.name}</td>
              <td className="px-3 py-2">{toQuantity(item.packageSizeBase)}</td>
              <td className="px-3 py-2">{item.subCategory ?? '-'}</td>
              <td className="px-3 py-2">{item.brand?.name ?? '-'}</td>
              <td className="px-3 py-2">{toDateDisplay(item.priceDate)}</td>
              <td className="px-3 py-2">{toMoney(item.listPriceExVat)}</td>
              <td className="px-3 py-2">%{toPercentString(item.discountRate, '0')}</td>
              <td className="px-3 py-2">{toMoney(grossPrice(item))}</td>
              <td className="px-3 py-2">{item.isActive ? 'Aktif' : 'Pasif'}</td>
              <td className="px-3 py-2">
                {caps.manageItem ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => startEdit(item)}>Düzenle</button>
                    <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => toggleItem(item).catch(handleApiError)}>{item.isActive ? 'Pasife Al' : 'Aktifleştir'}</button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">Salt okunur</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Ürün Düzenle</h2>
            <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={(event) => submitEditForm(event).catch(handleApiError)}>
              <label className="space-y-1 text-sm">
                <span>Ana Firma</span>
                <select className="h-10 w-full rounded border px-3 py-2" value={editForm.brandId} onChange={(event) => setEditForm((prev) => ({ ...prev, brandId: event.target.value }))}>
                  <option value="">Seçiniz</option>
                  {brands.map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Ürün Adı</span>
                <input className="h-10 w-full rounded border px-3 py-2" value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} required />
              </label>
              <label className="space-y-1 text-sm">
                <span>Miktarı</span>
                <input className="h-10 w-full rounded border px-3 py-2" type="number" min={0.0001} step="0.0001" value={editForm.packageSizeBase} onChange={(event) => setEditForm((prev) => ({ ...prev, packageSizeBase: event.target.value }))} required />
              </label>
              <label className="space-y-1 text-sm">
                <span>Stok Takip Birimi</span>
                <select className="h-10 w-full rounded border px-3 py-2" value={editForm.baseUom} onChange={(event) => setEditForm((prev) => ({ ...prev, baseUom: event.target.value as EditFormState['baseUom'] }))}>
                  <option value="CL">cl</option>
                  <option value="ML">ml</option>
                  <option value="GRAM">gram</option>
                  <option value="KG">kg</option>
                  <option value="PIECE">adet</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Paket Tipi</span>
                <select className="h-10 w-full rounded border px-3 py-2" value={editForm.packageUom} onChange={(event) => setEditForm((prev) => ({ ...prev, packageUom: event.target.value as EditFormState['packageUom'] }))}>
                  <option value="">Seçiniz</option>
                  <option value="BOTTLE">Şişe</option>
                  <option value="PACK">Paket</option>
                  <option value="PIECE">Adet</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Liste Fiyatı (KDV Hariç)</span>
                <input className="h-10 w-full rounded border px-3 py-2" type="number" min={0} step="0.0001" value={editForm.listPriceExVat} onChange={(event) => setEditForm((prev) => ({ ...prev, listPriceExVat: event.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <span>İskontosu</span>
                <input className="h-10 w-full rounded border px-3 py-2" type="number" min={0} max={100} step="0.01" value={editForm.discountRatePercent} onChange={(event) => setEditForm((prev) => ({ ...prev, discountRatePercent: event.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Fiyat Tarihi</span>
                <input className="h-10 w-full rounded border px-3 py-2" type="date" value={editForm.priceDate} onChange={(event) => setEditForm((prev) => ({ ...prev, priceDate: event.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Alış KDV Oranı</span>
                <input className="h-10 w-full rounded border px-3 py-2" type="number" min={0} max={100} step="0.01" value={editForm.purchaseVatRatePercent} onChange={(event) => setEditForm((prev) => ({ ...prev, purchaseVatRatePercent: event.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Gelir Merkezi Kategorisi</span>
                <select className="h-10 w-full rounded border px-3 py-2" value={editForm.mainStockArea} onChange={(event) => setEditForm((prev) => ({ ...prev, mainStockArea: event.target.value as EditFormState['mainStockArea'] }))}>
                  <option value="BAR">Bar</option>
                  <option value="KITCHEN">Mutfak</option>
                  <option value="OTHER">Diğer</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Stok Kategorisi</span>
                <select className="h-10 w-full rounded border px-3 py-2" value={editForm.attributeCategory} onChange={(event) => setEditForm((prev) => ({ ...prev, attributeCategory: event.target.value as EditFormState['attributeCategory'] }))}>
                  <option value="ALCOHOL">Alkol</option>
                  <option value="SOFT">Soft</option>
                  <option value="KITCHEN">Mutfak</option>
                  <option value="OTHER">Diğer</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Ürün Grubu</span>
                <input className="h-10 w-full rounded border px-3 py-2" value={editForm.subCategory} onChange={(event) => setEditForm((prev) => ({ ...prev, subCategory: event.target.value }))} />
              </label>
              <div className="flex justify-end gap-2 md:col-span-3">
                <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setEditingItem(null)}>Vazgeç</button>
                <button className="rounded bg-mono-500 px-3 py-2 text-sm text-white">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
