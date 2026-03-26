'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError, apiFetch, handleApiError } from '../../../../lib/api';

type InventoryCapabilities = {
  manageItem?: boolean;
  readItems?: boolean;
};

type Supplier = {
  id: string;
  shortName: string;
  isActive: boolean;
};

type Brand = {
  id: string;
  name: string;
  isActive: boolean;
};

type Item = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  brandId: string | null;
  supplierId: string | null;
  mainStockArea: 'BAR' | 'KITCHEN' | 'OTHER';
  attributeCategory: 'ALCOHOL' | 'SOFT' | 'KITCHEN' | 'OTHER';
  subCategory: string | null;
  baseUom: 'CL' | 'ML' | 'GRAM' | 'KG' | 'PIECE';
  packageUom: 'BOTTLE' | 'PACK' | 'PIECE' | null;
  packageSizeBase: string | null;
  purchaseVatRate: string;
  listPriceExVat: string | null;
  discountRate: string;
  computedPriceIncVat: string | null;
  lastPurchaseUnitCost: string | null;
  isActive: boolean;
  sortOrder: number;
  brand: Brand | null;
  supplier: Supplier | null;
};

type FormState = {
  name: string;
  sku: string;
  brandId: string;
  supplierId: string;
  mainStockArea: 'BAR' | 'KITCHEN' | 'OTHER';
  attributeCategory: 'ALCOHOL' | 'SOFT' | 'KITCHEN' | 'OTHER';
  subCategory: string;
  baseUom: 'CL' | 'ML' | 'GRAM' | 'KG' | 'PIECE';
  packageUom: '' | 'BOTTLE' | 'PACK' | 'PIECE';
  packageSizeBase: string;
  purchaseVatRatePercent: string;
  listPriceExVat: string;
  discountRatePercent: string;
  lastPurchaseUnitCost: string;
  sortOrder: string;
  isActive: boolean;
};

const defaultForm: FormState = {
  name: '',
  sku: '',
  brandId: '',
  supplierId: '',
  mainStockArea: 'OTHER',
  attributeCategory: 'OTHER',
  subCategory: '',
  baseUom: 'PIECE',
  packageUom: '',
  packageSizeBase: '',
  purchaseVatRatePercent: '20',
  listPriceExVat: '',
  discountRatePercent: '0',
  lastPurchaseUnitCost: '',
  sortOrder: '1000',
  isActive: true
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

function computeIncVat(listPriceExVat: string, discountPercent: string, vatPercent: string) {
  const list = parseMaybeNumber(listPriceExVat);
  if (list === null) return null;
  const discount = parseMaybeNumber(discountPercent) ?? 0;
  const vat = parseMaybeNumber(vatPercent) ?? 0;
  const netExVat = list * (1 - discount / 100);
  const netIncVat = netExVat * (1 + vat / 100);
  return netIncVat;
}

export default function InventoryItemsPage() {
  const [caps, setCaps] = useState<InventoryCapabilities>({});
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [initialForm, setInitialForm] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const computedPreview = useMemo(
    () => computeIncVat(form.listPriceExVat, form.discountRatePercent, form.purchaseVatRatePercent),
    [form.discountRatePercent, form.listPriceExVat, form.purchaseVatRatePercent]
  );
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);

  async function loadData() {
    setPageError(null);
    const [capsRes, itemsRes, brandsRes, suppliersRes] = await Promise.allSettled([
      apiFetch('/app-api/inventory/capabilities') as Promise<InventoryCapabilities>,
      apiFetch('/app-api/inventory/items') as Promise<Item[]>,
      apiFetch('/app-api/inventory/brands') as Promise<Brand[]>,
      apiFetch('/app-api/inventory/suppliers') as Promise<Supplier[]>
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

    if (suppliersRes.status === 'fulfilled') setSuppliers(suppliersRes.value);
    else handleApiError(suppliersRes.reason);
  }

  useEffect(() => {
    loadData().catch(handleApiError);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [drawerOpen]);

  function resetForm() {
    setForm(defaultForm);
    setInitialForm(defaultForm);
    setEditingId(null);
  }

  function openCreateDrawer() {
    resetForm();
    setPageError(null);
    setSuccessMessage(null);
    setDrawerOpen(true);
  }

  const requestCloseDrawer = useCallback(() => {
    if (isSubmitting) return;
    if (isDirty && !window.confirm('Kaydedilmemiş değişiklikler var. Formu kapatmak istediğinize emin misiniz?')) {
      return;
    }
    resetForm();
    setDrawerOpen(false);
  }, [isDirty, isSubmitting]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      requestCloseDrawer();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, requestCloseDrawer]);

  function startEdit(item: Item) {
    setEditingId(item.id);
    const nextForm: FormState = {
      name: item.name,
      sku: item.sku ?? '',
      brandId: item.brandId ?? '',
      supplierId: item.supplierId ?? '',
      mainStockArea: item.mainStockArea,
      attributeCategory: item.attributeCategory,
      subCategory: item.subCategory ?? '',
      baseUom: item.baseUom,
      packageSizeBase: item.packageSizeBase ?? '',
      purchaseVatRatePercent: toPercentString(item.purchaseVatRate, '20'),
      listPriceExVat: item.listPriceExVat ?? '',
      discountRatePercent: toPercentString(item.discountRate, '0'),
      lastPurchaseUnitCost: item.lastPurchaseUnitCost ?? '',
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
      packageUom: (item.packageUom ?? '') as FormState['packageUom']
    };
    setForm(nextForm);
    setInitialForm(nextForm);
    setPageError(null);
    setSuccessMessage(null);
    setDrawerOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError(null);
    setSuccessMessage(null);
    const vatPercent = parseMaybeNumber(form.purchaseVatRatePercent);
    const discountPercent = parseMaybeNumber(form.discountRatePercent);
    const packageSize = parseMaybeNumber(form.packageSizeBase);
    const sortOrder = parseMaybeNumber(form.sortOrder);
    const listPriceExVat = parseMaybeNumber(form.listPriceExVat);
    const lastCost = parseMaybeNumber(form.lastPurchaseUnitCost);

    if (vatPercent === null || vatPercent < 0 || vatPercent > 100) {
      setPageError('Alış KDV oranı 0 ile 100 arasında olmalı.');
      return;
    }
    if (discountPercent === null || discountPercent < 0 || discountPercent > 100) {
      setPageError('İskonto oranı 0 ile 100 arasında olmalı.');
      return;
    }
    if (form.packageUom && (packageSize === null || packageSize <= 0)) {
      setPageError('Paket tipi seçildiğinde paket miktarı 0’dan büyük olmalı.');
      return;
    }
    if (sortOrder === null || sortOrder < 0 || !Number.isInteger(sortOrder)) {
      setPageError('Sıra no 0 veya daha büyük tam sayı olmalı.');
      return;
    }

    const payload = {
      name: form.name,
      sku: form.sku || null,
      brandId: form.brandId || null,
      supplierId: form.supplierId || null,
      mainStockArea: form.mainStockArea,
      attributeCategory: form.attributeCategory,
      subCategory: form.subCategory || null,
      baseUom: form.baseUom,
      packageUom: form.packageUom || null,
      packageSizeBase: form.packageUom ? packageSize : null,
      purchaseVatRate: vatPercent / 100,
      listPriceExVat,
      discountRate: discountPercent / 100,
      lastPurchaseUnitCost: lastCost,
      isActive: form.isActive,
      sortOrder
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiFetch(`/app-api/inventory/items/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/app-api/inventory/items', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setSuccessMessage(editingId ? 'Ürün başarıyla güncellendi.' : 'Ürün başarıyla oluşturuldu.');
      resetForm();
      setDrawerOpen(false);
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleItem(item: Item) {
    await apiFetch(`/app-api/inventory/items/${item.id}/${item.isActive ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await loadData();
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Inventory Items</h1>
          <p className="text-sm text-slate-600">Envanter ana veri kartları: marka, distribütör, birim ve alış fiyat ayarları.</p>
        </div>
        <div className="flex gap-2">
          {caps.manageItem ? (
            <button type="button" className="rounded bg-mono-500 px-3 py-2 text-sm text-white hover:bg-mono-600" onClick={openCreateDrawer}>
              Yeni Ürün
            </button>
          ) : null}
          <Link href="/app/inventory/suppliers" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
            Marka & Distribütör
          </Link>
          <Link href="/app/inventory" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
            Stok Operasyonları
          </Link>
        </div>
      </header>

      {pageError ? (
        <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{pageError}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</div>
      ) : null}

      <table className="w-full rounded bg-white text-sm shadow-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left">Ad</th>
            <th className="px-3 py-2 text-left">Ana Firma</th>
            <th className="px-3 py-2 text-left">Distribütör</th>
            <th className="px-3 py-2 text-left">Ana Stok</th>
            <th className="px-3 py-2 text-left">Nitelik</th>
            <th className="px-3 py-2 text-left">Takip Birimi</th>
            <th className="px-3 py-2 text-left">Paket</th>
            <th className="px-3 py-2 text-left">Alış KDV %</th>
            <th className="px-3 py-2 text-left">Liste Fiyatı</th>
            <th className="px-3 py-2 text-left">İskonto %</th>
            <th className="px-3 py-2 text-left">Net Alış (KDV Dahil)</th>
            <th className="px-3 py-2 text-left">Durum</th>
            <th className="px-3 py-2 text-left">Sıra</th>
            <th className="px-3 py-2 text-left">İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="px-3 py-2">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-slate-500">{item.sku ?? '-'}</div>
              </td>
              <td className="px-3 py-2">{item.brand?.name ?? '-'}</td>
              <td className="px-3 py-2">{item.supplier?.shortName ?? '-'}</td>
              <td className="px-3 py-2">{item.mainStockArea}</td>
              <td className="px-3 py-2">{item.attributeCategory}</td>
              <td className="px-3 py-2">{item.baseUom.toLowerCase()}</td>
              <td className="px-3 py-2">{item.packageUom ? `${item.packageUom} (${item.packageSizeBase ?? '-'})` : '-'}</td>
              <td className="px-3 py-2">{toPercentString(item.purchaseVatRate, '0')}</td>
              <td className="px-3 py-2">{toMoney(item.listPriceExVat)}</td>
              <td className="px-3 py-2">{toPercentString(item.discountRate, '0')}</td>
              <td className="px-3 py-2">{toMoney(item.computedPriceIncVat)}</td>
              <td className="px-3 py-2">{item.isActive ? 'Aktif' : 'Pasif'}</td>
              <td className="px-3 py-2">{item.sortOrder}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  {caps.manageItem ? (
                    <>
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => startEdit(item)}>
                        Düzenle
                      </button>
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleItem(item).catch(handleApiError)}>
                        {item.isActive ? 'Pasife Al' : 'Aktifleştir'}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Salt okunur</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/35">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold">{editingId ? 'Ürünü Düzenle' : 'Yeni Ürün'}</h2>
                <p className="text-sm text-slate-500">
                  {editingId ? 'Mevcut ürün kartını güncelleyin.' : 'Yeni stok kartını hızlıca oluşturun.'}
                </p>
              </div>
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100" onClick={requestCloseDrawer}>
                Kapat
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => submitForm(event).catch(handleApiError)}>
              <div className="space-y-5 overflow-y-auto px-5 py-5">
                <section className="rounded border p-4">
                  <h3 className="mb-3 font-semibold">1) Temel Ürün Kimliği</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span>Ürün Adı</span>
                      <input
                        ref={firstInputRef}
                        className="w-full rounded border px-3 py-2"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        required
                      />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>SKU</span>
                      <input className="w-full rounded border px-3 py-2" value={form.sku} onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))} />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>Ana Firma (Brand)</span>
                      <select className="w-full rounded border px-3 py-2" value={form.brandId} onChange={(event) => setForm((prev) => ({ ...prev, brandId: event.target.value }))}>
                        <option value="">Seçiniz</option>
                        {brands.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>Distribütör / Fatura Keseni</span>
                      <select className="w-full rounded border px-3 py-2" value={form.supplierId} onChange={(event) => setForm((prev) => ({ ...prev, supplierId: event.target.value }))}>
                        <option value="">Seçiniz</option>
                        {suppliers.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.shortName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="rounded border p-4">
                  <h3 className="mb-3 font-semibold">2) Satın Alma Fiyatlandırma</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span>Alış KDV Oranı (%)</span>
                      <input className="w-full rounded border px-3 py-2" type="number" step="0.01" min={0} max={100} value={form.purchaseVatRatePercent} onChange={(event) => setForm((prev) => ({ ...prev, purchaseVatRatePercent: event.target.value }))} />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>Liste Fiyatı (KDV Hariç)</span>
                      <input className="w-full rounded border px-3 py-2" type="number" step="0.0001" min={0} value={form.listPriceExVat} onChange={(event) => setForm((prev) => ({ ...prev, listPriceExVat: event.target.value }))} />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>İskonto (%)</span>
                      <input className="w-full rounded border px-3 py-2" type="number" step="0.01" min={0} max={100} value={form.discountRatePercent} onChange={(event) => setForm((prev) => ({ ...prev, discountRatePercent: event.target.value }))} />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>Son Alış Birim Maliyeti</span>
                      <input className="w-full rounded border px-3 py-2" type="number" step="0.0001" min={0} value={form.lastPurchaseUnitCost} onChange={(event) => setForm((prev) => ({ ...prev, lastPurchaseUnitCost: event.target.value }))} />
                    </label>

                    <div className="rounded border bg-slate-50 px-3 py-3 text-sm md:col-span-2">
                      <p className="text-slate-500">Hesaplanan Net Alış (KDV Dahil)</p>
                      <p className="font-semibold">{computedPreview === null ? '-' : toMoney(String(computedPreview))}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded border p-4">
                  <h3 className="mb-3 font-semibold">3) Sınıflandırma</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span>Ana Stok Kategorisi</span>
                      <select className="w-full rounded border px-3 py-2" value={form.mainStockArea} onChange={(event) => setForm((prev) => ({ ...prev, mainStockArea: event.target.value as FormState['mainStockArea'] }))}>
                        <option value="BAR">Bar</option>
                        <option value="KITCHEN">Mutfak</option>
                        <option value="OTHER">Diğer</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>Nitelik</span>
                      <select className="w-full rounded border px-3 py-2" value={form.attributeCategory} onChange={(event) => setForm((prev) => ({ ...prev, attributeCategory: event.target.value as FormState['attributeCategory'] }))}>
                        <option value="ALCOHOL">Alkol</option>
                        <option value="SOFT">Soft</option>
                        <option value="KITCHEN">Mutfak</option>
                        <option value="OTHER">Diğer</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>Alt Kategori</span>
                      <input className="w-full rounded border px-3 py-2" placeholder="örn: Whisky, Vodka, Sebze" value={form.subCategory} onChange={(event) => setForm((prev) => ({ ...prev, subCategory: event.target.value }))} />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>Stok Takip Birimi</span>
                      <select className="w-full rounded border px-3 py-2" value={form.baseUom} onChange={(event) => setForm((prev) => ({ ...prev, baseUom: event.target.value as FormState['baseUom'] }))}>
                        <option value="CL">cl</option>
                        <option value="ML">ml</option>
                        <option value="GRAM">gram</option>
                        <option value="KG">kg</option>
                        <option value="PIECE">adet</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>Paket Tipi</span>
                      <select className="w-full rounded border px-3 py-2" value={form.packageUom} onChange={(event) => setForm((prev) => ({ ...prev, packageUom: event.target.value as FormState['packageUom'] }))}>
                        <option value="">Seçiniz</option>
                        <option value="BOTTLE">Şişe</option>
                        <option value="PACK">Paket</option>
                        <option value="PIECE">Adet</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>Paket Miktarı (base birim)</span>
                      <input className="w-full rounded border px-3 py-2" type="number" step="0.0001" min={0} value={form.packageSizeBase} onChange={(event) => setForm((prev) => ({ ...prev, packageSizeBase: event.target.value }))} />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span>Sıra No</span>
                      <input className="w-full rounded border px-3 py-2" type="number" min={0} step={1} value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))} />
                    </label>

                    <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm md:col-span-2">
                      <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
                      Aktif
                    </label>
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-white px-5 py-4">
                <button type="button" className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50" onClick={requestCloseDrawer} disabled={isSubmitting}>
                  İptal
                </button>
                <button className="rounded bg-mono-500 px-4 py-2 text-sm text-white hover:bg-mono-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting}>
                  {isSubmitting ? (editingId ? 'Güncelleniyor...' : 'Kaydediliyor...') : editingId ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
