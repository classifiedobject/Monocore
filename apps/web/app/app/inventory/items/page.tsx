'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError, apiFetch, handleApiError } from '../../../../lib/api';
import { getWebEnv } from '../../../../lib/env';

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

type ItemListResponse = {
  rows: Item[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

type ItemSortBy =
  | 'name'
  | 'brand'
  | 'supplier'
  | 'mainStockArea'
  | 'attributeCategory'
  | 'baseUom'
  | 'purchaseVatRate'
  | 'listPriceExVat'
  | 'discountRate'
  | 'computedPriceIncVat'
  | 'isActive'
  | 'sortOrder';

type ViewFilters = {
  brandId: string | null;
  status: 'all' | 'active' | 'inactive' | null;
  mainStockArea: 'BAR' | 'KITCHEN' | 'OTHER' | null;
  attributeCategory: 'ALCOHOL' | 'SOFT' | 'KITCHEN' | 'OTHER' | null;
  subCategory: string | null;
};

type SavedView = {
  id: string;
  name: string;
  isDefault: boolean;
  filtersJson: ViewFilters | null;
  searchQuery: string | null;
  sortBy: ItemSortBy | null;
  sortDirection: 'asc' | 'desc' | null;
  pageSize: number | null;
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

const defaultFilters: ViewFilters = {
  brandId: null,
  status: 'all',
  mainStockArea: null,
  attributeCategory: null,
  subCategory: null
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

function currentViewState(
  search: string,
  filters: ViewFilters,
  sortBy: ItemSortBy | null,
  sortDirection: 'asc' | 'desc' | null,
  pageSize: number
) {
  return {
    searchQuery: search.trim() || null,
    filtersJson: {
      brandId: filters.brandId || null,
      status: filters.status ?? 'all',
      mainStockArea: filters.mainStockArea || null,
      attributeCategory: filters.attributeCategory || null,
      subCategory: filters.subCategory?.trim() || null
    },
    sortBy,
    sortDirection,
    pageSize
  };
}

function normalizeSavedView(view: SavedView | null | undefined) {
  if (!view) return null;
  return {
    searchQuery: view.searchQuery ?? null,
    filtersJson: {
      brandId: view.filtersJson?.brandId ?? null,
      status: view.filtersJson?.status ?? 'all',
      mainStockArea: view.filtersJson?.mainStockArea ?? null,
      attributeCategory: view.filtersJson?.attributeCategory ?? null,
      subCategory: view.filtersJson?.subCategory ?? null
    },
    sortBy: view.sortBy ?? null,
    sortDirection: view.sortDirection ?? null,
    pageSize: view.pageSize ?? 50
  };
}

export default function InventoryItemsPage() {
  const [caps, setCaps] = useState<InventoryCapabilities>({});
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toolbarBusy, setToolbarBusy] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ViewFilters>(defaultFilters);
  const [sortBy, setSortBy] = useState<ItemSortBy | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [manageViewsOpen, setManageViewsOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const didBootstrapDefault = useRef(false);

  const computedPreview = useMemo(
    () => computeIncVat(form.listPriceExVat, form.discountRatePercent, form.purchaseVatRatePercent),
    [form.discountRatePercent, form.listPriceExVat, form.purchaseVatRatePercent]
  );

  const selectedCount = selectedIds.length;
  const allSelectedOnPage = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  const activeView = useMemo(
    () => savedViews.find((view) => view.id === activeSavedViewId) ?? null,
    [savedViews, activeSavedViewId]
  );
  const viewState = useMemo(
    () => currentViewState(searchQuery, filters, sortBy, sortDirection, pageSize),
    [searchQuery, filters, sortBy, sortDirection, pageSize]
  );
  const savedViewChanged = useMemo(() => {
    if (!activeView) return false;
    return JSON.stringify(viewState) !== JSON.stringify(normalizeSavedView(activeView));
  }, [activeView, viewState]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (filters.brandId) {
      const brand = brands.find((row) => row.id === filters.brandId);
      chips.push({
        key: 'brandId',
        label: `Ana Firma: ${brand?.name ?? 'Seçili'}`,
        clear: () => setFilters((prev) => ({ ...prev, brandId: null }))
      });
    }
    if (filters.status && filters.status !== 'all') {
      chips.push({
        key: 'status',
        label: `Durum: ${filters.status === 'active' ? 'Aktif' : 'Pasif'}`,
        clear: () => setFilters((prev) => ({ ...prev, status: 'all' }))
      });
    }
    if (filters.mainStockArea) {
      chips.push({
        key: 'mainStockArea',
        label: `Gelir Merkezi: ${filters.mainStockArea === 'BAR' ? 'Bar' : filters.mainStockArea === 'KITCHEN' ? 'Mutfak' : 'Diğer'}`,
        clear: () => setFilters((prev) => ({ ...prev, mainStockArea: null }))
      });
    }
    if (filters.attributeCategory) {
      chips.push({
        key: 'attributeCategory',
        label: `Stok Kategorisi: ${filters.attributeCategory === 'ALCOHOL' ? 'Alkol' : filters.attributeCategory === 'SOFT' ? 'Soft' : filters.attributeCategory === 'KITCHEN' ? 'Mutfak' : 'Diğer'}`,
        clear: () => setFilters((prev) => ({ ...prev, attributeCategory: null }))
      });
    }
    if (filters.subCategory) {
      chips.push({
        key: 'subCategory',
        label: `Ürün Grubu: ${filters.subCategory}`,
        clear: () => setFilters((prev) => ({ ...prev, subCategory: null }))
      });
    }
    if (searchQuery.trim()) {
      chips.push({
        key: 'search',
        label: `Arama: ${searchQuery}`,
        clear: () => {
          setSearchDraft('');
          setSearchQuery('');
        }
      });
    }
    return chips;
  }, [brands, filters, searchQuery]);

  const applySavedView = useCallback((view: SavedView, fromBootstrap = false) => {
    setActiveSavedViewId(view.id);
    setSearchDraft(view.searchQuery ?? '');
    setSearchQuery(view.searchQuery ?? '');
    setFilters({
      brandId: view.filtersJson?.brandId ?? null,
      status: view.filtersJson?.status ?? 'all',
      mainStockArea: view.filtersJson?.mainStockArea ?? null,
      attributeCategory: view.filtersJson?.attributeCategory ?? null,
      subCategory: view.filtersJson?.subCategory ?? null
    });
    setSortBy(view.sortBy ?? null);
    setSortDirection(view.sortDirection ?? null);
    setPageSize(view.pageSize ?? 50);
    setPage(1);
    if (!fromBootstrap) setManageViewsOpen(false);
  }, []);

  const loadMeta = useCallback(async () => {
    setPageError(null);
    const [capsRes, brandsRes, suppliersRes, savedViewsRes] = await Promise.allSettled([
      apiFetch('/app-api/inventory/capabilities') as Promise<InventoryCapabilities>,
      apiFetch('/app-api/inventory/brands') as Promise<Brand[]>,
      apiFetch('/app-api/inventory/suppliers') as Promise<Supplier[]>,
      apiFetch('/app-api/inventory/items/saved-views') as Promise<SavedView[]>
    ]);

    if (capsRes.status === 'fulfilled') setCaps(capsRes.value);
    if (brandsRes.status === 'fulfilled') setBrands(brandsRes.value);
    else handleApiError(brandsRes.reason);
    if (suppliersRes.status === 'fulfilled') setSuppliers(suppliersRes.value);
    else handleApiError(suppliersRes.reason);
    if (savedViewsRes.status === 'fulfilled') {
      setSavedViews(savedViewsRes.value);
      if (!didBootstrapDefault.current) {
        const defaultView = savedViewsRes.value.find((row) => row.isDefault) ?? null;
        if (defaultView) {
          applySavedView(defaultView, true);
        }
        didBootstrapDefault.current = true;
      }
    } else {
      handleApiError(savedViewsRes.reason);
      didBootstrapDefault.current = true;
    }

    setMetaLoaded(true);
  }, [applySavedView]);

  const loadItems = useCallback(async () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (filters.brandId) params.set('brandId', filters.brandId);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.mainStockArea) params.set('mainStockArea', filters.mainStockArea);
    if (filters.attributeCategory) params.set('attributeCategory', filters.attributeCategory);
    if (filters.subCategory?.trim()) params.set('subCategory', filters.subCategory.trim());
    if (sortBy) params.set('sortBy', sortBy);
    if (sortDirection) params.set('sortDirection', sortDirection);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    const response = (await apiFetch(`/app-api/inventory/items?${params.toString()}`)) as ItemListResponse;
    setItems(response.rows);
    setTotal(response.total);
    setPage(response.page);
    setPageSize(response.pageSize);
    setTotalPages(response.totalPages);
    setSelectedIds([]);
  }, [filters, page, pageSize, searchQuery, sortBy, sortDirection]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(searchDraft);
    }, 275);
    return () => window.clearTimeout(timeout);
  }, [searchDraft]);

  useEffect(() => {
    loadMeta().catch(handleApiError);
  }, [loadMeta]);

  useEffect(() => {
    if (!metaLoaded || !didBootstrapDefault.current) return;
    loadItems().catch((error) => {
      if (error instanceof ApiError) {
        setPageError(`Items okunamadı (HTTP ${error.status}). Yetkinizi kontrol edin.`);
      } else {
        setPageError('Items yüklenemedi.');
      }
      handleApiError(error);
    });
  }, [loadItems, metaLoaded]);

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      sku: item.sku ?? '',
      brandId: item.brandId ?? '',
      supplierId: item.supplierId ?? '',
      mainStockArea: item.mainStockArea,
      attributeCategory: item.attributeCategory,
      subCategory: item.subCategory ?? '',
      baseUom: item.baseUom,
      packageUom: item.packageUom ?? '',
      packageSizeBase: item.packageSizeBase ?? '',
      purchaseVatRatePercent: toPercentString(item.purchaseVatRate, '20'),
      listPriceExVat: item.listPriceExVat ?? '',
      discountRatePercent: toPercentString(item.discountRate, '0'),
      lastPurchaseUnitCost: item.lastPurchaseUnitCost ?? '',
      sortOrder: String(item.sortOrder),
      isActive: item.isActive
    });
  }

  async function refreshAfterMutation() {
    await Promise.all([loadMeta(), loadItems()]);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    resetForm();
    await refreshAfterMutation();
  }

  async function toggleItem(item: Item) {
    await apiFetch(`/app-api/inventory/items/${item.id}/${item.isActive ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await loadItems();
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
  }

  function toggleSelectAllOnPage() {
    setSelectedIds(allSelectedOnPage ? [] : items.map((item) => item.id));
  }

  async function bulkSetActive(isActive: boolean) {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(
      `${selectedIds.length} ürün ${isActive ? 'aktif' : 'pasif'} duruma alınacak. Devam edilsin mi?`
    );
    if (!confirmed) return;

    setBulkBusy(true);
    setPageError(null);
    try {
      await apiFetch('/app-api/inventory/items/bulk-status', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds, isActive })
      });
      await loadItems();
    } catch (error) {
      handleApiError(error);
      setPageError(isActive ? 'Toplu aktifleştirme başarısız oldu.' : 'Toplu pasifleştirme başarısız oldu.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportSelected(format: 'csv' | 'excel') {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    setPageError(null);
    try {
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('x-company-id', activeCompanyId());
      headers.set('x-csrf-token', csrfToken());

      const response = await fetch(`${getWebEnv().NEXT_PUBLIC_WEB_PUBLIC_API_URL}/app-api/inventory/items/bulk-export`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ ids: selectedIds, format })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') ?? '';
      const matched = contentDisposition.match(/filename="([^"]+)"/);
      const fileName = matched?.[1] ?? `inventory-items-selected.${format === 'csv' ? 'csv' : 'xls'}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      handleApiError(error);
      setPageError('Seçili ürünler dışa aktarılırken hata oluştu.');
    } finally {
      setBulkBusy(false);
    }
  }

  function cycleSort(field: ItemSortBy) {
    if (sortBy !== field) {
      setSortBy(field);
      setSortDirection('asc');
      setPage(1);
      return;
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc');
      setPage(1);
      return;
    }
    setSortBy(null);
    setSortDirection(null);
    setPage(1);
  }

  async function saveCurrentView() {
    if (!saveViewName.trim()) {
      setPageError('Görünüm adı boş olamaz.');
      return;
    }
    setToolbarBusy(true);
    setPageError(null);
    try {
      const payload = {
        name: saveViewName.trim(),
        isDefault: saveAsDefault,
        ...viewState
      };
      const created = (await apiFetch('/app-api/inventory/items/saved-views', {
        method: 'POST',
        body: JSON.stringify(payload)
      })) as SavedView;
      setSaveModalOpen(false);
      setSaveViewName('');
      setSaveAsDefault(false);
      await loadMeta();
      setActiveSavedViewId(created.id);
    } catch (error) {
      handleApiError(error);
      setPageError('Görünüm kaydedilemedi.');
    } finally {
      setToolbarBusy(false);
    }
  }

  async function renameSavedView(view: SavedView) {
    const nextName = window.prompt('Yeni görünüm adı', view.name)?.trim();
    if (!nextName || nextName === view.name) return;
    setToolbarBusy(true);
    try {
      await apiFetch(`/app-api/inventory/items/saved-views/${view.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName })
      });
      await loadMeta();
    } catch (error) {
      handleApiError(error);
      setPageError('Görünüm adı güncellenemedi.');
    } finally {
      setToolbarBusy(false);
    }
  }

  async function deleteSavedView(view: SavedView) {
    const confirmed = window.confirm(`"${view.name}" görünümü silinsin mi?`);
    if (!confirmed) return;
    setToolbarBusy(true);
    try {
      await apiFetch(`/app-api/inventory/items/saved-views/${view.id}`, {
        method: 'DELETE',
        body: JSON.stringify({})
      });
      await loadMeta();
      if (activeSavedViewId === view.id) setActiveSavedViewId(null);
    } catch (error) {
      handleApiError(error);
      setPageError('Görünüm silinemedi.');
    } finally {
      setToolbarBusy(false);
    }
  }

  async function setDefaultSavedView(view: SavedView) {
    setToolbarBusy(true);
    try {
      await apiFetch(`/app-api/inventory/items/saved-views/${view.id}/set-default`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      await loadMeta();
    } catch (error) {
      handleApiError(error);
      setPageError('Varsayılan görünüm ayarlanamadı.');
    } finally {
      setToolbarBusy(false);
    }
  }

  function clearAllFilters() {
    setActiveSavedViewId(null);
    setSearchDraft('');
    setSearchQuery('');
    setFilters(defaultFilters);
    setSortBy(null);
    setSortDirection(null);
    setPageSize(50);
    setPage(1);
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Inventory Items</h1>
          <p className="text-sm text-slate-600">Envanter ana veri kartları: marka, distribütör, birim ve alış fiyat ayarları.</p>
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

      <div className="space-y-3 rounded bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={activeSavedViewId ?? ''}
            onChange={(event) => {
              const nextId = event.target.value;
              if (!nextId) {
                setActiveSavedViewId(null);
                return;
              }
              const view = savedViews.find((row) => row.id === nextId);
              if (view) applySavedView(view);
            }}
          >
            <option value="">Kayıtlı Görünümler</option>
            {savedViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.isDefault ? '★ ' : ''}
                {view.name}
              </option>
            ))}
          </select>
          <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60" onClick={() => { setSaveViewName(activeView?.name ?? ''); setSaveAsDefault(Boolean(activeView?.isDefault)); setSaveModalOpen(true); }} disabled={toolbarBusy || !caps.readItems}>
            Görünümü Kaydet
          </button>
          <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60" onClick={() => setManageViewsOpen(true)} disabled={toolbarBusy || savedViews.length === 0}>
            Görünümleri Yönet
          </button>
          {activeView ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Aktif görünüm: {activeView.name}</span> : null}
          {savedViewChanged ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">Görünüm değiştirildi</span> : null}
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="space-y-1 text-sm md:col-span-2 xl:col-span-2">
            <span>Arama</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Ürün, marka, distribütör veya grup ara"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>Ana Firma</span>
            <select className="w-full rounded border border-slate-300 px-3 py-2" value={filters.brandId ?? ''} onChange={(event) => { setFilters((prev) => ({ ...prev, brandId: event.target.value || null })); setPage(1); }}>
              <option value="">Tümü</option>
              {brands.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>Durum</span>
            <select className="w-full rounded border border-slate-300 px-3 py-2" value={filters.status ?? 'all'} onChange={(event) => { setFilters((prev) => ({ ...prev, status: event.target.value as ViewFilters['status'] })); setPage(1); }}>
              <option value="all">Tümü</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>Gelir Merkezi</span>
            <select className="w-full rounded border border-slate-300 px-3 py-2" value={filters.mainStockArea ?? ''} onChange={(event) => { setFilters((prev) => ({ ...prev, mainStockArea: (event.target.value as ViewFilters['mainStockArea']) || null })); setPage(1); }}>
              <option value="">Tümü</option>
              <option value="BAR">Bar</option>
              <option value="KITCHEN">Mutfak</option>
              <option value="OTHER">Diğer</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>Stok Kategorisi</span>
            <select className="w-full rounded border border-slate-300 px-3 py-2" value={filters.attributeCategory ?? ''} onChange={(event) => { setFilters((prev) => ({ ...prev, attributeCategory: (event.target.value as ViewFilters['attributeCategory']) || null })); setPage(1); }}>
              <option value="">Tümü</option>
              <option value="ALCOHOL">Alkol</option>
              <option value="SOFT">Soft</option>
              <option value="KITCHEN">Mutfak</option>
              <option value="OTHER">Diğer</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>Ürün Grubu</span>
            <input className="w-full rounded border border-slate-300 px-3 py-2" value={filters.subCategory ?? ''} onChange={(event) => { setFilters((prev) => ({ ...prev, subCategory: event.target.value || null })); setPage(1); }} placeholder="örn: Whisky" />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {activeFilterChips.map((chip) => (
              <button key={chip.key} type="button" className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100" onClick={() => { chip.clear(); setPage(1); }}>
                {chip.label} ×
              </button>
            ))}
            {activeFilterChips.length > 0 ? (
              <button type="button" className="text-xs font-medium text-slate-600 underline" onClick={clearAllFilters}>
                Tüm filtreleri temizle
              </button>
            ) : null}
          </div>
          <div className="text-xs text-slate-500">Toplam {total} kayıt</div>
        </div>
      </div>

      {caps.manageItem ? (
        <form className="grid gap-3 rounded bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={(event) => submitForm(event).catch(handleApiError)}>
          <label className="space-y-1 text-sm">
            <span>Ürün Adı</span>
            <input className="w-full rounded border px-3 py-2" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
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
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>Distribütör / Fatura Keseni</span>
            <select className="w-full rounded border px-3 py-2" value={form.supplierId} onChange={(event) => setForm((prev) => ({ ...prev, supplierId: event.target.value }))}>
              <option value="">Seçiniz</option>
              {suppliers.map((row) => (
                <option key={row.id} value={row.id}>{row.shortName}</option>
              ))}
            </select>
          </label>

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

          <label className="space-y-1 text-sm">
            <span>Sıra No</span>
            <input className="w-full rounded border px-3 py-2" type="number" min={0} step={1} value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))} />
          </label>

          <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
            Aktif
          </label>

          <div className="rounded border bg-slate-50 px-3 py-2 text-sm">
            <p className="text-slate-500">Hesaplanan Net Alış (KDV Dahil)</p>
            <p className="font-semibold">{computedPreview === null ? '-' : toMoney(String(computedPreview))}</p>
          </div>

          <div className="flex items-end gap-2 md:col-span-4">
            <button className="rounded bg-mono-500 px-3 py-2 text-white">{editingId ? 'Kaydet' : 'Ürün Oluştur'}</button>
            {editingId ? <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={resetForm}>İptal</button> : null}
          </div>
        </form>
      ) : null}

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm">
          <div className="font-medium text-slate-700">{selectedCount} ürün seçildi</div>
          <div className="flex flex-wrap gap-2">
            {caps.manageItem ? (
              <>
                <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-white disabled:opacity-60" onClick={() => bulkSetActive(false).catch(handleApiError)} disabled={bulkBusy}>Seçilenleri Pasife Al</button>
                <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-white disabled:opacity-60" onClick={() => bulkSetActive(true).catch(handleApiError)} disabled={bulkBusy}>Seçilenleri Aktife Al</button>
              </>
            ) : null}
            {caps.readItems ? (
              <>
                <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-white disabled:opacity-60" onClick={() => exportSelected('csv').catch(handleApiError)} disabled={bulkBusy}>Seçilenleri CSV Dışa Aktar</button>
                <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-white disabled:opacity-60" onClick={() => exportSelected('excel').catch(handleApiError)} disabled={bulkBusy}>Seçilenleri Excel Dışa Aktar</button>
              </>
            ) : null}
            <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-white disabled:opacity-60" onClick={() => setSelectedIds([])} disabled={bulkBusy}>Seçimi Temizle</button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left"><input type="checkbox" checked={allSelectedOnPage} onChange={toggleSelectAllOnPage} aria-label="Bu sayfadaki tüm ürünleri seç" /></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('name')}>Ad {sortBy === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('brand')}>Ana Firma {sortBy === 'brand' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('supplier')}>Distribütör {sortBy === 'supplier' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('mainStockArea')}>Ana Stok {sortBy === 'mainStockArea' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('attributeCategory')}>Nitelik {sortBy === 'attributeCategory' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('baseUom')}>Takip Birimi {sortBy === 'baseUom' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left">Paket</th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('purchaseVatRate')}>Alış KDV % {sortBy === 'purchaseVatRate' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('listPriceExVat')}>Liste Fiyatı {sortBy === 'listPriceExVat' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('discountRate')}>İskonto % {sortBy === 'discountRate' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('computedPriceIncVat')}>Net Alış (KDV Dahil) {sortBy === 'computedPriceIncVat' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('isActive')}>Durum {sortBy === 'isActive' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left"><button type="button" className="font-semibold" onClick={() => cycleSort('sortOrder')}>Sıra {sortBy === 'sortOrder' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
              <th className="px-3 py-2 text-left">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={`border-t ${item.isActive ? '' : 'bg-rose-50/50'}`}>
                <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`${item.name} ürününü seç`} /></td>
                <td className="px-3 py-2"><div className="font-medium">{item.name}</div><div className="text-xs text-slate-500">{item.sku ?? '-'}</div></td>
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
                        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => startEdit(item)}>Düzenle</button>
                        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => toggleItem(item).catch(handleApiError)}>{item.isActive ? 'Pasife Al' : 'Aktifleştir'}</button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">Salt okunur</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-10 text-center text-slate-500" colSpan={15}>
                  Sonuç bulunamadı. İstersen filtreleri temizleyip tekrar deneyelim.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded bg-white px-4 py-3 text-sm shadow-sm">
        <div className="text-slate-600">Sayfa {page} / {totalPages} • {total} kayıt</div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span>Sayfa boyutu</span>
            <select className="rounded border border-slate-300 px-2 py-1" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <button type="button" className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Önceki</button>
          <button type="button" className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>Sonraki</button>
        </div>
      </div>

      {saveModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-md rounded bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Görünümü Kaydet</h2>
            <div className="mt-4 space-y-3">
              <label className="space-y-1 text-sm">
                <span>Görünüm Adı</span>
                <input className="w-full rounded border border-slate-300 px-3 py-2" value={saveViewName} onChange={(event) => setSaveViewName(event.target.value)} placeholder="örn: Bar Ürünleri" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={saveAsDefault} onChange={(event) => setSaveAsDefault(event.target.checked)} />
                Varsayılan yap
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setSaveModalOpen(false)}>İptal</button>
              <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60" onClick={() => saveCurrentView().catch(handleApiError)} disabled={toolbarBusy}>Kaydet</button>
            </div>
          </div>
        </div>
      ) : null}

      {manageViewsOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-2xl rounded bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Kayıtlı Görünümler</h2>
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setManageViewsOpen(false)}>Kapat</button>
            </div>
            <div className="mt-4 space-y-2">
              {savedViews.length === 0 ? <div className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Henüz kayıtlı görünüm yok.</div> : null}
              {savedViews.map((view) => (
                <div key={view.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 px-3 py-3 text-sm">
                  <div>
                    <div className="font-medium">{view.name} {view.isDefault ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">Varsayılan</span> : null}</div>
                    <div className="text-xs text-slate-500">{view.searchQuery ? `Arama: ${view.searchQuery}` : 'Kayıtlı filtre görünümü'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded border border-slate-300 px-3 py-2 text-xs" onClick={() => applySavedView(view)}>Uygula</button>
                    <button type="button" className="rounded border border-slate-300 px-3 py-2 text-xs" onClick={() => renameSavedView(view).catch(handleApiError)}>Yeniden Adlandır</button>
                    <button type="button" className="rounded border border-slate-300 px-3 py-2 text-xs" onClick={() => setDefaultSavedView(view).catch(handleApiError)}>Varsayılan Yap</button>
                    <button type="button" className="rounded border border-rose-300 px-3 py-2 text-xs text-rose-700" onClick={() => deleteSavedView(view).catch(handleApiError)}>Sil</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
