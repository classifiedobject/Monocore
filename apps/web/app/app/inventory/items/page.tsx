'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError, apiFetch, handleApiError } from '../../../../lib/api';
import { getWebEnv } from '../../../../lib/env';

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
  priceDate: string;
  computedPriceIncVat: string | null;
  lastPurchaseUnitCost: string | null;
  isActive: boolean;
  brand: Brand | null;
};

type PagedItems = {
  rows: Item[];
  total: number;
  page: number;
  pageSize: number;
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

type EditFormState = CreateFormState & {
  packageUom: '' | 'BOTTLE' | 'PACK' | 'PIECE';
};

type SortKey =
  | 'code'
  | 'brand'
  | 'name'
  | 'packageSizeBase'
  | 'subCategory'
  | 'priceDate'
  | 'listPriceExVat'
  | 'discountRate'
  | 'grossPrice'
  | 'status'
  | null;

type StatusFilter = 'all' | 'active' | 'inactive';

type ImportPreview = {
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
  validRows: Array<{
    rowNumber: number;
    raw: Record<string, unknown>;
    display: Record<string, string>;
  }>;
  invalidRows: Array<{
    rowNumber: number;
    raw: Record<string, unknown>;
    errors: string[];
  }>;
};

const API_URL = getWebEnv().NEXT_PUBLIC_WEB_PUBLIC_API_URL;

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

function toMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return '-';
  return asNumber.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toQuantity(value: string | number | null | undefined) {
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

function csrfToken() {
  if (typeof document === 'undefined') return '';
  return (
    document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('csrf_token='))
      ?.split('=')[1] ?? ''
  );
}

function activeCompanyId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('activeCompanyId') ?? '';
}

async function fetchWithCompany(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const companyId = activeCompanyId();
  if (companyId) headers.set('x-company-id', companyId);
  const method = init?.method?.toUpperCase() ?? 'GET';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('x-csrf-token', csrfToken());
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include'
  });

  if (!res.ok) {
    throw new ApiError(res.status, (await res.text()) || `HTTP ${res.status}`);
  }

  return res;
}

function buildItemQuery(params: {
  search: string;
  brandId: string;
  status: StatusFilter;
  sortBy: SortKey;
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}) {
  const query = new URLSearchParams();
  if (params.search.trim()) query.set('search', params.search.trim());
  if (params.brandId) query.set('brandId', params.brandId);
  if (params.status !== 'all') query.set('status', params.status);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortBy) query.set('sortDirection', params.sortDirection);
  query.set('page', String(params.page));
  query.set('pageSize', String(params.pageSize));
  return query.toString();
}

export default function InventoryItemsPage() {
  const [caps, setCaps] = useState<InventoryCapabilities>({});
  const [itemsPage, setItemsPage] = useState<PagedItems>({ rows: [], total: 0, page: 1, pageSize: 50 });
  const [brands, setBrands] = useState<Brand[]>([]);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateForm);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toolbarSearch, setToolbarSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditForm);
  const [initialEditForm, setInitialEditForm] = useState<EditFormState>(defaultEditForm);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const computedPreview = useMemo(
    () => computeIncVat(createForm.listPriceExVat, createForm.discountRatePercent, createForm.purchaseVatRatePercent),
    [createForm.discountRatePercent, createForm.listPriceExVat, createForm.purchaseVatRatePercent]
  );
  const editComputedPreview = useMemo(
    () => computeIncVat(editForm.listPriceExVat, editForm.discountRatePercent, editForm.purchaseVatRatePercent),
    [editForm.discountRatePercent, editForm.listPriceExVat, editForm.purchaseVatRatePercent]
  );
  const isCreateDirty = useMemo(() => JSON.stringify(createForm) !== JSON.stringify(defaultCreateForm), [createForm]);
  const isEditDirty = useMemo(() => JSON.stringify(editForm) !== JSON.stringify(initialEditForm), [editForm, initialEditForm]);
  const isDrawerDirty = drawerMode === 'create' ? isCreateDirty : isEditDirty;
  const requestCloseDrawer = useCallback(() => {
    if (isDrawerDirty && !window.confirm('Kaydedilmemiş değişiklikler var. Formu kapatmak istediğinize emin misiniz?')) {
      return;
    }
    setIsDrawerOpen(false);
    setPageError(null);
    if (drawerMode === 'create') {
      setCreateForm(defaultCreateForm);
      return;
    }
    setEditingItem(null);
    setInitialEditForm(defaultEditForm);
    setEditForm(defaultEditForm);
  }, [drawerMode, isDrawerDirty]);

  const totalPages = Math.max(1, Math.ceil(itemsPage.total / itemsPage.pageSize));

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(toolbarSearch), 300);
    return () => window.clearTimeout(timer);
  }, [toolbarSearch]);

  useEffect(() => {
    async function loadBasics() {
      const [capsRes, brandsRes] = await Promise.allSettled([
        apiFetch('/app-api/inventory/capabilities') as Promise<InventoryCapabilities>,
        apiFetch('/app-api/inventory/brands') as Promise<Brand[]>
      ]);

      if (capsRes.status === 'fulfilled') setCaps(capsRes.value);
      else handleApiError(capsRes.reason);

      if (brandsRes.status === 'fulfilled') setBrands(brandsRes.value);
      else handleApiError(brandsRes.reason);
    }

    loadBasics().catch(handleApiError);
  }, []);

  useEffect(() => {
    async function loadItems() {
      setIsLoadingItems(true);
      setPageError(null);
      try {
        const query = buildItemQuery({
          search: debouncedSearch,
          brandId: brandFilter,
          status: statusFilter,
          sortBy,
          sortDirection,
          page,
          pageSize
        });
        const result = await apiFetch(`/app-api/inventory/items?${query}`) as PagedItems;
        setItemsPage(result);
      } catch (error) {
        setPageError(error instanceof ApiError ? `Ürünler yüklenemedi (HTTP ${error.status}).` : 'Ürünler yüklenemedi.');
        handleApiError(error);
      } finally {
        setIsLoadingItems(false);
      }
    }

    loadItems().catch(handleApiError);
  }, [brandFilter, debouncedSearch, page, pageSize, sortBy, sortDirection, statusFilter]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isDrawerOpen, drawerMode]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      requestCloseDrawer();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawerOpen, requestCloseDrawer]);

  function resetItemPage() {
    setPage(1);
  }

  function onSort(column: Exclude<SortKey, null>) {
    if (sortBy !== column) {
      setSortBy(column);
      setSortDirection('asc');
      resetItemPage();
      return;
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc');
      resetItemPage();
      return;
    }
    setSortBy('name');
    setSortDirection('asc');
    resetItemPage();
  }

  async function reloadItems() {
    const query = buildItemQuery({
      search: debouncedSearch,
      brandId: brandFilter,
      status: statusFilter,
      sortBy,
      sortDirection,
      page,
      pageSize
    });
    const result = await apiFetch(`/app-api/inventory/items?${query}`) as PagedItems;
    setItemsPage(result);
  }

  async function submitCreateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
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

      setImportMessage('Ürün başarıyla oluşturuldu.');
      setCreateForm(defaultCreateForm);
      setIsDrawerOpen(false);
      await reloadItems();
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCreateDrawer() {
    setDrawerMode('create');
    setCreateForm(defaultCreateForm);
    setPageError(null);
    setIsDrawerOpen(true);
  }

  function startEdit(item: Item) {
    const nextForm = {
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
    } satisfies EditFormState;
    setEditingItem(item);
    setInitialEditForm(nextForm);
    setEditForm(nextForm);
    setDrawerMode('edit');
    setPageError(null);
    setIsDrawerOpen(true);
  }

  async function submitEditForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem) return;
    setIsSubmitting(true);

    try {
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

      setImportMessage('Ürün başarıyla güncellendi.');
      setIsDrawerOpen(false);
      setEditingItem(null);
      setInitialEditForm(defaultEditForm);
      setEditForm(defaultEditForm);
      await reloadItems();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleItem(item: Item) {
    await apiFetch(`/app-api/inventory/items/${item.id}/${item.isActive ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await reloadItems();
  }

  function grossPrice(item: Item) {
    return item.lastPurchaseUnitCost ?? item.computedPriceIncVat;
  }

  async function downloadExport(format: 'csv' | 'xlsx', scope: 'filtered' | 'all') {
    setIsExporting(true);
    try {
      const query = new URLSearchParams(
        scope === 'all'
          ? { scope }
          : {
              scope,
              ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
              ...(brandFilter ? { brandId: brandFilter } : {}),
              ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
              ...(sortBy ? { sortBy, sortDirection } : {})
            }
      );
      const res = await fetchWithCompany(`/app-api/inventory/items/export.${format}?${query.toString()}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = format === 'csv' ? 'inventory-items.csv' : 'inventory-items.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setImportMessage(scope === 'all' ? 'Tüm ürünler dışa aktarıldı.' : 'Filtrelenmiş ürünler dışa aktarıldı.');
    } catch (error) {
      setImportError('Dışa aktarma başarısız oldu.');
      handleApiError(error);
    } finally {
      setIsExporting(false);
    }
  }

  async function downloadTemplate(format: 'csv' | 'xlsx') {
    try {
      const res = await fetchWithCompany(`/app-api/inventory/items/import/template.${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = format === 'csv' ? 'inventory-items-template.csv' : 'inventory-items-template.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setImportError('Şablon indirilemedi.');
      handleApiError(error);
    }
  }

  async function previewImport() {
    if (!importFile) {
      setImportError('Önce içe aktarılacak dosyayı seçin.');
      return;
    }
    setIsPreviewingImport(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetchWithCompany('/app-api/inventory/items/import/preview', {
        method: 'POST',
        body: formData
      });
      const preview = (await res.json()) as ImportPreview;
      setImportPreview(preview);
      setImportMessage(`Önizleme hazır. Geçerli: ${preview.summary.validRows}, hatalı: ${preview.summary.invalidRows}.`);
    } catch (error) {
      setImportPreview(null);
      setImportError('İçe aktarma önizlemesi oluşturulamadı.');
      handleApiError(error);
    } finally {
      setIsPreviewingImport(false);
    }
  }

  async function confirmImport() {
    if (!importPreview?.validRows.length) {
      setImportError('Onaylanacak geçerli satır bulunmuyor.');
      return;
    }

    setIsConfirmingImport(true);
    setImportError(null);
    try {
      const result = await apiFetch('/app-api/inventory/items/import/confirm', {
        method: 'POST',
        body: JSON.stringify({
          rows: importPreview.validRows.map((row) => row.raw)
        })
      }) as { createdCount: number; failedCount: number };

      setImportMessage(`İçe aktarma tamamlandı. Oluşturulan: ${result.createdCount}, başarısız: ${result.failedCount}.`);
      setImportPreview(null);
      setImportFile(null);
      resetItemPage();
      await reloadItems();
    } catch (error) {
      setImportError('Geçerli satırlar içe aktarılamadı.');
      handleApiError(error);
    } finally {
      setIsConfirmingImport(false);
    }
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Ürün Kartları</h1>
          <p className="text-sm text-slate-600">Stok ana verisini arama, sayfalama, dışa aktarma ve toplu içe aktarma ile yönetin.</p>
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

      {pageError ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{pageError}</div> : null}
      {importError ? <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{importError}</div> : null}
      {importMessage ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{importMessage}</div> : null}

      <section className="space-y-4 rounded bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <label className="min-w-[280px] flex-1 space-y-1 text-sm">
            <span>Arama</span>
            <input
              className="h-10 w-full rounded border px-3 py-2"
              placeholder="ID, ürün adı, ana firma, distribütör, kategori, miktar..."
              value={toolbarSearch}
              onChange={(event) => {
                setToolbarSearch(event.target.value);
                resetItemPage();
              }}
            />
          </label>
          <label className="min-w-[180px] space-y-1 text-sm">
            <span>Ana Firma</span>
            <select className="h-10 w-full rounded border px-3 py-2" value={brandFilter} onChange={(event) => { setBrandFilter(event.target.value); resetItemPage(); }}>
              <option value="">Tümü</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[160px] space-y-1 text-sm">
            <span>Durum</span>
            <select className="h-10 w-full rounded border px-3 py-2" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); resetItemPage(); }}>
              <option value="all">Tümü</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </label>
          <label className="min-w-[140px] space-y-1 text-sm">
            <span>Sayfa Boyutu</span>
            <select className="h-10 w-full rounded border px-3 py-2" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <div className="flex min-w-[250px] flex-1 items-end justify-end gap-2">
            <details className="relative">
              <summary className="flex h-10 cursor-pointer items-center rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
                {isExporting ? 'Dışa Aktarılıyor...' : 'Dışa Aktar'}
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-56 rounded border bg-white p-2 shadow-lg">
                <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => downloadExport('csv', 'filtered').catch(handleApiError)}>
                  CSV indir (filtrelenmiş)
                </button>
                <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => downloadExport('xlsx', 'filtered').catch(handleApiError)}>
                  Excel indir (filtrelenmiş)
                </button>
                <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => downloadExport('csv', 'all').catch(handleApiError)}>
                  CSV indir (tümü)
                </button>
                <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => downloadExport('xlsx', 'all').catch(handleApiError)}>
                  Excel indir (tümü)
                </button>
              </div>
            </details>
          </div>
        </div>

        {caps.manageItem ? (
          <div className="rounded border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Toplu İçe Aktar</h2>
                <p className="text-sm text-slate-600">Excel veya CSV yükleyin, önce önizleme görün, sonra onaylayın.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="rounded border px-3 py-2 text-sm hover:bg-slate-100" onClick={() => downloadTemplate('csv').catch(handleApiError)}>
                  CSV Şablonu
                </button>
                <button type="button" className="rounded border px-3 py-2 text-sm hover:bg-slate-100" onClick={() => downloadTemplate('xlsx').catch(handleApiError)}>
                  Excel Şablonu
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] ?? null);
                  setImportPreview(null);
                  setImportError(null);
                  setImportMessage(null);
                }}
              />
              <button type="button" className="rounded border px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50" onClick={() => previewImport().catch(handleApiError)} disabled={!importFile || isPreviewingImport}>
                {isPreviewingImport ? 'Önizleme Hazırlanıyor...' : 'Önizleme Oluştur'}
              </button>
            </div>

            {importPreview ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded border bg-slate-50 px-3 py-2 text-sm">Toplam satır: <strong>{importPreview.summary.totalRows}</strong></div>
                  <div className="rounded border bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Geçerli satır: <strong>{importPreview.summary.validRows}</strong></div>
                  <div className="rounded border bg-amber-50 px-3 py-2 text-sm text-amber-800">Hatalı satır: <strong>{importPreview.summary.invalidRows}</strong></div>
                </div>

                {importPreview.validRows.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-medium">Geçerli Satırlar</h3>
                    <div className="overflow-auto rounded border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-left">Satır</th>
                            <th className="px-3 py-2 text-left">Ana Firma</th>
                            <th className="px-3 py-2 text-left">Ürün Adı</th>
                            <th className="px-3 py-2 text-left">Miktarı</th>
                            <th className="px-3 py-2 text-left">Birim</th>
                            <th className="px-3 py-2 text-left">Liste Fiyatı</th>
                            <th className="px-3 py-2 text-left">İskonto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.validRows.map((row) => (
                            <tr key={`valid-${row.rowNumber}`} className="border-t">
                              <td className="px-3 py-2">{row.rowNumber}</td>
                              <td className="px-3 py-2">{row.display.anaFirma}</td>
                              <td className="px-3 py-2">{row.display.urunAdi}</td>
                              <td className="px-3 py-2">{row.display.miktari}</td>
                              <td className="px-3 py-2">{row.display.stokTakipBirimi}</td>
                              <td className="px-3 py-2">{row.display.listeFiyatiKdvHaric}</td>
                              <td className="px-3 py-2">{row.display.iskontosu}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {importPreview.invalidRows.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-medium">Hatalı Satırlar</h3>
                    <div className="overflow-auto rounded border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-left">Satır</th>
                            <th className="px-3 py-2 text-left">Ürün</th>
                            <th className="px-3 py-2 text-left">Hata Nedeni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.invalidRows.map((row) => (
                            <tr key={`invalid-${row.rowNumber}`} className="border-t bg-rose-50">
                              <td className="px-3 py-2">{row.rowNumber}</td>
                              <td className="px-3 py-2">{String(row.raw.urunAdi ?? '-')}</td>
                              <td className="px-3 py-2">{row.errors.join(', ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button type="button" className="rounded border px-3 py-2 text-sm hover:bg-slate-100" onClick={() => setImportPreview(null)}>
                    Önizlemeyi Temizle
                  </button>
                  <button type="button" className="rounded bg-mono-500 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => confirmImport().catch(handleApiError)} disabled={!importPreview.validRows.length || isConfirmingImport}>
                    {isConfirmingImport ? 'İçe Aktarılıyor...' : `Geçerli ${importPreview.validRows.length} Satırı İçe Aktar`}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-auto rounded border">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('code')}>ID {sortIndicator(sortBy, sortDirection, 'code')}</button></th>
                <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('brand')}>Ana Firma {sortIndicator(sortBy, sortDirection, 'brand')}</button></th>
                <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('name')}>Ürün Adı {sortIndicator(sortBy, sortDirection, 'name')}</button></th>
                <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('packageSizeBase')}>Miktarı {sortIndicator(sortBy, sortDirection, 'packageSizeBase')}</button></th>
                <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('subCategory')}>Ürün Grubu {sortIndicator(sortBy, sortDirection, 'subCategory')}</button></th>
                <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('priceDate')}>Fiyat Tarihi {sortIndicator(sortBy, sortDirection, 'priceDate')}</button></th>
                <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('listPriceExVat')}>Liste Fiyatı {sortIndicator(sortBy, sortDirection, 'listPriceExVat')}</button></th>
                <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('discountRate')}>İskontosu {sortIndicator(sortBy, sortDirection, 'discountRate')}</button></th>
                <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('grossPrice')}>Brüt Fiyatı {sortIndicator(sortBy, sortDirection, 'grossPrice')}</button></th>
                <th className="px-3 py-2 text-left"><button type="button" onClick={() => onSort('status')}>Durum {sortIndicator(sortBy, sortDirection, 'status')}</button></th>
                <th className="px-3 py-2 text-left">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {itemsPage.rows.map((item) => (
                <tr key={item.id} className={`border-t ${item.isActive ? '' : 'bg-rose-50'}`}>
                  <td className="px-3 py-2">{item.code ?? '-'}</td>
                  <td className="px-3 py-2">{item.brand?.name ?? '-'}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{toQuantity(item.packageSizeBase)}</td>
                  <td className="px-3 py-2">{item.subCategory ?? '-'}</td>
                  <td className="px-3 py-2">{toDateDisplay(item.priceDate)}</td>
                  <td className="px-3 py-2">{toMoney(item.listPriceExVat)}</td>
                  <td className="px-3 py-2">%{toPercentString(item.discountRate, '0')}</td>
                  <td className="px-3 py-2">{toMoney(grossPrice(item))}</td>
                  <td className="px-3 py-2">{item.isActive ? 'Aktif' : 'Pasif'}</td>
                  <td className="px-3 py-2">
                    {caps.manageItem ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => startEdit(item)}>Düzenle</button>
                        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => toggleItem(item).catch(handleApiError)}>
                          {item.isActive ? 'Pasife Al' : 'Aktifleştir'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Salt okunur</span>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoadingItems && itemsPage.rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-sm text-slate-500">
                    Bu filtrelerle eşleşen ürün bulunamadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <div>
            Toplam <strong>{itemsPage.total}</strong> kayıt • Sayfa <strong>{itemsPage.page}</strong> / <strong>{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded border px-3 py-2 hover:bg-slate-100 disabled:opacity-50" disabled={itemsPage.page <= 1 || isLoadingItems} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              Önceki
            </button>
            <button type="button" className="rounded border px-3 py-2 hover:bg-slate-100 disabled:opacity-50" disabled={itemsPage.page >= totalPages || isLoadingItems} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
              Sonraki
            </button>
          </div>
        </div>
      </section>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40">
          <div className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">{drawerMode === 'create' ? 'Yeni Ürün' : 'Ürün Düzenle'}</h2>
                <p className="text-sm text-slate-500">
                  {drawerMode === 'create'
                    ? 'Yeni stok kartı oluşturun. Liste filtreleri ve sayfalama olduğu gibi korunur.'
                    : 'Ürünü düzenleyin. Kaydettikten sonra mevcut liste görünümü korunur.'}
                </p>
              </div>
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100" onClick={requestCloseDrawer}>
                Kapat
              </button>
            </div>

            {drawerMode === 'create' ? (
              <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => submitCreateForm(event).catch(handleApiError)}>
                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  <div className="rounded border p-3">
                    <h3 className="mb-3 font-semibold">Temel Ürün Kimliği</h3>
                    <div className="grid gap-3 md:grid-cols-2">
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
                        <input ref={firstInputRef} className="h-10 w-full rounded border px-3 py-2" value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} required />
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
                    <h3 className="mb-3 font-semibold">Satın Alma Fiyatlandırma</h3>
                    <div className="grid gap-3 md:grid-cols-2">
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
                        <span className="block text-xs text-slate-500">Boş bırakılırsa ürün oluşturma tarihi kullanılır.</span>
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Alış KDV Oranı</span>
                        <input className="h-10 w-full rounded border px-3 py-2" type="number" min={0} max={100} step="0.01" value={createForm.purchaseVatRatePercent} onChange={(event) => setCreateForm((prev) => ({ ...prev, purchaseVatRatePercent: event.target.value }))} />
                      </label>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Hesaplanan net alış (KDV dahil): <strong>{computedPreview === null ? '-' : toMoney(computedPreview)}</strong>
                    </p>
                  </div>

                  <div className="rounded border p-3">
                    <h3 className="mb-3 font-semibold">Sınıflandırma</h3>
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
                </div>

                <div className="border-t bg-white px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <button type="button" className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100" onClick={requestCloseDrawer}>
                      İptal
                    </button>
                    <button className="rounded bg-mono-500 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={isSubmitting}>
                      {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => submitEditForm(event).catch(handleApiError)}>
                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  <div className="rounded border p-3">
                    <h3 className="mb-3 font-semibold">Temel Ürün Kimliği</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span>Ana Firma</span>
                        <select className="h-10 w-full rounded border px-3 py-2" value={editForm.brandId} onChange={(event) => setEditForm((prev) => ({ ...prev, brandId: event.target.value }))}>
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
                        <input ref={firstInputRef} className="h-10 w-full rounded border px-3 py-2" value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} required />
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
                    </div>
                  </div>

                  <div className="rounded border p-3">
                    <h3 className="mb-3 font-semibold">Satın Alma Fiyatlandırma</h3>
                    <div className="grid gap-3 md:grid-cols-2">
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
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Hesaplanan net alış (KDV dahil): <strong>{editComputedPreview === null ? '-' : toMoney(editComputedPreview)}</strong>
                    </p>
                  </div>

                  <div className="rounded border p-3">
                    <h3 className="mb-3 font-semibold">Sınıflandırma</h3>
                    <div className="grid gap-3 md:grid-cols-3">
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
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span>Paket Tipi</span>
                        <select className="h-10 w-full rounded border px-3 py-2" value={editForm.packageUom} onChange={(event) => setEditForm((prev) => ({ ...prev, packageUom: event.target.value as EditFormState['packageUom'] }))}>
                          <option value="">Seçiniz</option>
                          <option value="BOTTLE">Şişe</option>
                          <option value="PACK">Paket</option>
                          <option value="PIECE">Adet</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="border-t bg-white px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <button type="button" className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100" onClick={requestCloseDrawer}>
                      İptal
                    </button>
                    <button className="rounded bg-mono-500 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={isSubmitting}>
                      {isSubmitting ? 'Güncelleniyor...' : 'Güncelle'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
