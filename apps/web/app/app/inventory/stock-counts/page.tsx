'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch, handleApiError } from '../../../../lib/api';

type Capabilities = {
  manageStockCount?: boolean;
  readStockCount?: boolean;
};

type Warehouse = {
  id: string;
  name: string;
  isActive: boolean;
};

type Item = {
  id: string;
  name: string;
  sku: string | null;
  baseUom: 'CL' | 'ML' | 'GRAM' | 'KG' | 'PIECE';
  packageUom: 'BOTTLE' | 'PACK' | 'PIECE' | null;
  packageSizeBase: string | null;
  isActive: boolean;
};

type Session = {
  id: string;
  warehouseId: string;
  countDate: string;
  status: 'DRAFT' | 'POSTED';
  notes: string | null;
  createdAt: string;
  warehouse: Warehouse;
  _count?: { lines: number };
};

type SessionLine = {
  id: string;
  itemId: string;
  countedQtyBase: string;
  closedPackageQty: number | null;
  openPackageCount: number | null;
  openQtyBase: string | null;
  item: Item;
};

type SessionDetail = Session & { lines: SessionLine[] };

function asNum(value: string | null | undefined) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function InventoryStockCountsPage() {
  const [caps, setCaps] = useState<Capabilities>({});
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);

  const [warehouseId, setWarehouseId] = useState('');
  const [countDate, setCountDate] = useState('');
  const [notes, setNotes] = useState('');

  const [lineItemId, setLineItemId] = useState('');
  const [countedQtyBase, setCountedQtyBase] = useState('');
  const [closedPackageQty, setClosedPackageQty] = useState('0');
  const [openPackageCount, setOpenPackageCount] = useState('0');
  const [openQtyBase, setOpenQtyBase] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(() => items.find((row) => row.id === lineItemId) ?? null, [items, lineItemId]);
  const packageSize = selectedItem?.packageSizeBase ? asNum(selectedItem.packageSizeBase) : 0;
  const isPackageItem = Boolean(selectedItem?.packageUom && packageSize > 0);
  const computedTotal = isPackageItem ? asNum(closedPackageQty) * packageSize + asNum(openQtyBase) : asNum(countedQtyBase);

  async function loadInitial() {
    const [capsRes, warehouseRes, itemRes, sessionRes] = await Promise.all([
      apiFetch('/app-api/inventory/capabilities') as Promise<Capabilities>,
      apiFetch('/app-api/inventory/warehouses') as Promise<Warehouse[]>,
      apiFetch('/app-api/inventory/items') as Promise<Item[]>,
      apiFetch('/app-api/inventory/stock-counts') as Promise<Session[]>
    ]);
    setCaps(capsRes);
    setWarehouses(warehouseRes);
    setItems(itemRes);
    setSessions(sessionRes);
    if (!warehouseId && warehouseRes[0]?.id) setWarehouseId(warehouseRes[0].id);
    if (!lineItemId && itemRes[0]?.id) setLineItemId(itemRes[0].id);
  }

  async function loadSessions() {
    const rows = (await apiFetch('/app-api/inventory/stock-counts')) as Session[];
    setSessions(rows);
  }

  async function loadSessionDetail(sessionId: string) {
    const detail = (await apiFetch(`/app-api/inventory/stock-counts/${sessionId}`)) as SessionDetail;
    setSessionDetail(detail);
  }

  useEffect(() => {
    const init = async () => {
      const [capsRes, warehouseRes, itemRes, sessionRes] = await Promise.all([
        apiFetch('/app-api/inventory/capabilities') as Promise<Capabilities>,
        apiFetch('/app-api/inventory/warehouses') as Promise<Warehouse[]>,
        apiFetch('/app-api/inventory/items') as Promise<Item[]>,
        apiFetch('/app-api/inventory/stock-counts') as Promise<Session[]>
      ]);
      setCaps(capsRes);
      setWarehouses(warehouseRes);
      setItems(itemRes);
      setSessions(sessionRes);
      setWarehouseId((current) => current || warehouseRes[0]?.id || '');
      setLineItemId((current) => current || itemRes[0]?.id || '');
    };
    init().catch(handleApiError);
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionDetail(null);
      return;
    }
    loadSessionDetail(selectedSessionId).catch(handleApiError);
  }, [selectedSessionId]);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await apiFetch('/app-api/inventory/stock-counts', {
      method: 'POST',
      body: JSON.stringify({
        warehouseId,
        countDate,
        notes: notes || null
      })
    });
    setNotes('');
    await loadSessions();
  }

  async function upsertLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSessionId) return;
    setError(null);

    if (isPackageItem) {
      if (asNum(openQtyBase) > asNum(openPackageCount) * packageSize) {
        setError('Açık toplam miktar, açık şişe kapasitesinden büyük olamaz.');
        return;
      }
    }

    await apiFetch(`/app-api/inventory/stock-counts/${selectedSessionId}/lines`, {
      method: 'PATCH',
      body: JSON.stringify({
        itemId: lineItemId,
        countedQtyBase: isPackageItem ? null : asNum(countedQtyBase),
        closedPackageQty: isPackageItem ? Math.floor(asNum(closedPackageQty)) : null,
        openPackageCount: isPackageItem ? Math.floor(asNum(openPackageCount)) : null,
        openQtyBase: isPackageItem ? asNum(openQtyBase) : null
      })
    });

    setCountedQtyBase('');
    setClosedPackageQty('0');
    setOpenPackageCount('0');
    setOpenQtyBase('0');
    await loadSessionDetail(selectedSessionId);
  }

  async function deleteLine(lineId: string) {
    if (!selectedSessionId) return;
    await apiFetch(`/app-api/inventory/stock-counts/${selectedSessionId}/lines/${lineId}`, {
      method: 'DELETE'
    });
    await loadSessionDetail(selectedSessionId);
  }

  async function postSession() {
    if (!selectedSessionId || !sessionDetail) return;
    if (!window.confirm('Bu oturumu post etmek istediğinize emin misiniz? Post sonrası düzenleme yapılamaz.')) return;
    await apiFetch(`/app-api/inventory/stock-counts/${selectedSessionId}/post`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await Promise.all([loadSessions(), loadSessionDetail(selectedSessionId)]);
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Stok Sayım Oturumları</h1>
          <p className="text-sm text-slate-600">Açılış/periyodik sayım oturumu oluşturup güvenli şekilde stok düzeltme hareketine post edin.</p>
        </div>
        <Link href="/app/inventory" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
          Envantere Dön
        </Link>
      </header>

      {error ? <p className="rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}

      {!caps.readStockCount ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Bu ekran için `module:inventory-core.stock-count.read` yetkisi gerekiyor.
        </p>
      ) : null}

      {caps.readStockCount ? (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            {caps.manageStockCount ? (
              <form className="grid gap-2 rounded bg-white p-4 shadow-sm" onSubmit={(event) => createSession(event).catch(handleApiError)}>
                <h2 className="text-lg font-semibold">1) Oturum Oluştur</h2>
                <select className="rounded border px-3 py-2" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required>
                  <option value="">Depo seçin</option>
                  {warehouses
                    .filter((row) => row.isActive)
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                </select>
                <input className="rounded border px-3 py-2" type="date" value={countDate} onChange={(event) => setCountDate(event.target.value)} required />
                <input className="rounded border px-3 py-2" placeholder="Not (opsiyonel)" value={notes} onChange={(event) => setNotes(event.target.value)} />
                <button className="rounded bg-mono-500 px-3 py-2 text-white">Oturum Aç</button>
              </form>
            ) : null}

            <div className="rounded bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">Oturumlar</h2>
              <div className="space-y-2">
                {sessions.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setSelectedSessionId(row.id)}
                    className={`block w-full rounded border px-3 py-2 text-left text-sm ${selectedSessionId === row.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}
                  >
                    <div className="font-medium">
                      {row.warehouse?.name} - {new Date(row.countDate).toLocaleDateString('tr-TR')}
                    </div>
                    <div className="text-xs text-slate-500">
                      Durum: {row.status === 'DRAFT' ? 'Taslak' : 'Post Edildi'} | Satır: {row._count?.lines ?? 0}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {sessionDetail ? (
              <>
                <div className="rounded bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold">2) Satır Gir</h2>
                  <p className="text-sm text-slate-600">
                    Depo: {sessionDetail.warehouse.name} | Tarih: {new Date(sessionDetail.countDate).toLocaleDateString('tr-TR')} | Durum:{' '}
                    {sessionDetail.status === 'DRAFT' ? 'Taslak' : 'Post Edildi'}
                  </p>

                  {sessionDetail.status === 'DRAFT' && caps.manageStockCount ? (
                    <form className="mt-3 grid gap-2" onSubmit={(event) => upsertLine(event).catch(handleApiError)}>
                      <select className="rounded border px-3 py-2" value={lineItemId} onChange={(event) => setLineItemId(event.target.value)} required>
                        <option value="">Ürün seçin</option>
                        {items
                          .filter((row) => row.isActive)
                          .map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name} {row.sku ? `(${row.sku})` : ''}
                            </option>
                          ))}
                      </select>

                      {isPackageItem ? (
                        <div className="grid gap-2 md:grid-cols-3">
                          <label className="text-sm">
                            Kapalı Şişe (adet)
                            <input className="mt-1 w-full rounded border px-3 py-2" type="number" min={0} step={1} value={closedPackageQty} onChange={(event) => setClosedPackageQty(event.target.value)} />
                          </label>
                          <label className="text-sm">
                            Açık Şişe (adet)
                            <input className="mt-1 w-full rounded border px-3 py-2" type="number" min={0} step={1} value={openPackageCount} onChange={(event) => setOpenPackageCount(event.target.value)} />
                          </label>
                          <label className="text-sm">
                            Açık Toplam ({selectedItem?.baseUom.toLowerCase()})
                            <input className="mt-1 w-full rounded border px-3 py-2" type="number" min={0} step="0.0001" value={openQtyBase} onChange={(event) => setOpenQtyBase(event.target.value)} />
                          </label>
                          <p className="text-sm text-slate-600 md:col-span-3">
                            Hesaplanan Toplam: <strong>{computedTotal.toFixed(4)}</strong> {selectedItem?.baseUom.toLowerCase()}
                          </p>
                        </div>
                      ) : (
                        <label className="text-sm">
                          Toplam ({selectedItem?.baseUom.toLowerCase() || 'birim'})
                          <input className="mt-1 w-full rounded border px-3 py-2" type="number" min={0} step="0.0001" value={countedQtyBase} onChange={(event) => setCountedQtyBase(event.target.value)} required />
                        </label>
                      )}

                      <button className="rounded bg-mono-500 px-3 py-2 text-white">Satırı Kaydet</button>
                    </form>
                  ) : (
                    <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
                      Bu oturum post edildiği için satırlar düzenlenemez.
                    </p>
                  )}
                </div>

                <div className="rounded bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-base font-semibold">Satırlar</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-2 py-1 text-left">Ürün</th>
                        <th className="px-2 py-1 text-left">Toplam</th>
                        <th className="px-2 py-1 text-left">Detay</th>
                        <th className="px-2 py-1 text-left">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionDetail.lines.map((line) => (
                        <tr key={line.id} className="border-t">
                          <td className="px-2 py-1">{line.item.name}</td>
                          <td className="px-2 py-1">
                            {Number(line.countedQtyBase).toFixed(4)} {line.item.baseUom.toLowerCase()}
                          </td>
                          <td className="px-2 py-1 text-xs text-slate-600">
                            {line.closedPackageQty !== null
                              ? `Kapalı: ${line.closedPackageQty}, Açık: ${line.openPackageCount ?? 0}, Açık Toplam: ${line.openQtyBase ?? 0}`
                              : '-'}
                          </td>
                          <td className="px-2 py-1">
                            {sessionDetail.status === 'DRAFT' && caps.manageStockCount ? (
                              <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => deleteLine(line.id).catch(handleApiError)}>
                                Sil
                              </button>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {sessionDetail.status === 'DRAFT' && caps.manageStockCount ? (
                  <button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => postSession().catch(handleApiError)}>
                    3) Oturumu Post Et
                  </button>
                ) : null}
              </>
            ) : (
              <div className="rounded bg-white p-4 text-sm text-slate-600 shadow-sm">Sağ panel için bir oturum seçin.</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
