'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch, handleApiError } from '../../../lib/api';

type InventoryCapabilities = {
  manageItem: boolean;
  manageItemCost: boolean;
  manageWarehouse: boolean;
  manageMovement: boolean;
  readMovement: boolean;
};

type Warehouse = {
  id: string;
  name: string;
  location: string | null;
  isActive: boolean;
};

type Item = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  lastPurchaseUnitCost: string | null;
  isActive: boolean;
};

type StockRow = {
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  unit: string;
  quantity: number;
};

type Movement = {
  id: string;
  type: 'IN' | 'OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';
  quantity: string;
  reference: string | null;
  relatedDocumentType: string | null;
  createdAt: string;
  item: Item;
  warehouse: Warehouse;
};

type Tab = 'items' | 'warehouses' | 'stock' | 'movements';

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'items', label: 'Items' },
  { key: 'warehouses', label: 'Warehouses' },
  { key: 'stock', label: 'Stock' },
  { key: 'movements', label: 'Movements' }
];

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('items');
  const [caps, setCaps] = useState<InventoryCapabilities>({
    manageItem: false,
    manageItemCost: false,
    manageWarehouse: false,
    manageMovement: false,
    readMovement: false
  });

  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  const [itemName, setItemName] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [itemUnit, setItemUnit] = useState('piece');
  const [itemActive, setItemActive] = useState(true);
  const [itemCostDraft, setItemCostDraft] = useState<Record<string, string>>({});

  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [warehouseActive, setWarehouseActive] = useState(true);

  const [movementType, setMovementType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [movementItemId, setMovementItemId] = useState('');
  const [movementWarehouseId, setMovementWarehouseId] = useState('');
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementReference, setMovementReference] = useState('');

  const [transferItemId, setTransferItemId] = useState('');
  const [transferFromWarehouseId, setTransferFromWarehouseId] = useState('');
  const [transferToWarehouseId, setTransferToWarehouseId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [transferReference, setTransferReference] = useState('');

  const [filterItemId, setFilterItemId] = useState('');
  const [filterWarehouseId, setFilterWarehouseId] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  const [activeOnlyItems, setActiveOnlyItems] = useState(true);
  const [activeOnlyWarehouses, setActiveOnlyWarehouses] = useState(true);

  const isTransferValid = useMemo(
    () =>
      Boolean(transferItemId) &&
      Boolean(transferFromWarehouseId) &&
      Boolean(transferToWarehouseId) &&
      transferFromWarehouseId !== transferToWarehouseId &&
      Number(transferQuantity) > 0,
    [transferFromWarehouseId, transferItemId, transferQuantity, transferToWarehouseId]
  );

  async function loadCapabilities() {
    const data = (await apiFetch('/app-api/inventory/capabilities')) as InventoryCapabilities;
    setCaps(data);
  }

  async function loadItems() {
    const rows = (await apiFetch('/app-api/inventory/items')) as Item[];
    setItems(rows);
  }

  async function loadWarehouses() {
    const rows = (await apiFetch('/app-api/inventory/warehouses')) as Warehouse[];
    setWarehouses(rows);
  }

  async function loadStock() {
    const params = new URLSearchParams();
    if (filterItemId) params.set('itemId', filterItemId);
    if (filterWarehouseId) params.set('warehouseId', filterWarehouseId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const rows = (await apiFetch(`/app-api/inventory/stock-balance${suffix}`)) as StockRow[];
    setStockRows(rows);
  }

  async function loadMovements() {
    const params = new URLSearchParams();
    if (filterItemId) params.set('itemId', filterItemId);
    if (filterWarehouseId) params.set('warehouseId', filterWarehouseId);
    if (filterFromDate) params.set('from', filterFromDate);
    if (filterToDate) params.set('to', filterToDate);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const rows = (await apiFetch(`/app-api/inventory/movements${suffix}`)) as Movement[];
    setMovements(rows);
  }

  async function loadAll() {
    await Promise.all([loadCapabilities(), loadItems(), loadWarehouses(), loadStock(), loadMovements()]);
  }

  useEffect(() => {
    loadAll().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/inventory/items', {
      method: 'POST',
      body: JSON.stringify({
        name: itemName,
        sku: itemSku || null,
        unit: itemUnit,
        isActive: itemActive
      })
    });
    setItemName('');
    setItemSku('');
    setItemUnit('piece');
    setItemActive(true);
    await Promise.all([loadItems(), loadStock(), loadMovements()]);
  }

  async function createWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/inventory/warehouses', {
      method: 'POST',
      body: JSON.stringify({
        name: warehouseName,
        location: warehouseLocation || null,
        isActive: warehouseActive
      })
    });
    setWarehouseName('');
    setWarehouseLocation('');
    setWarehouseActive(true);
    await Promise.all([loadWarehouses(), loadStock(), loadMovements()]);
  }

  async function createMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/inventory/movements', {
      method: 'POST',
      body: JSON.stringify({
        type: movementType,
        itemId: movementItemId,
        warehouseId: movementWarehouseId,
        quantity: Number(movementQuantity),
        reference: movementReference || null,
        relatedDocumentType: 'manual'
      })
    });
    setMovementQuantity('');
    setMovementReference('');
    await Promise.all([loadStock(), loadMovements()]);
  }

  async function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isTransferValid) return;
    await apiFetch('/app-api/inventory/transfer', {
      method: 'POST',
      body: JSON.stringify({
        itemId: transferItemId,
        fromWarehouseId: transferFromWarehouseId,
        toWarehouseId: transferToWarehouseId,
        quantity: Number(transferQuantity),
        reference: transferReference || null
      })
    });
    setTransferQuantity('');
    setTransferReference('');
    await Promise.all([loadStock(), loadMovements()]);
  }

  const visibleItems = useMemo(() => {
    if (!activeOnlyItems) return items;
    return items.filter((row) => row.isActive);
  }, [activeOnlyItems, items]);

  const visibleWarehouses = useMemo(() => {
    if (!activeOnlyWarehouses) return warehouses;
    return warehouses.filter((row) => row.isActive);
  }, [activeOnlyWarehouses, warehouses]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Inventory Core</h1>
        <p className="text-sm text-slate-600">Manage items, warehouses, movements and transfers for this tenant.</p>
        <div className="mt-2">
          <Link href="/app/inventory/items" className="mr-2 rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100">
            Item Master Data
          </Link>
          <Link href="/app/inventory/suppliers" className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100">
            Manage Suppliers & Brands
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((row) => (
          <button
            key={row.key}
            onClick={() => setTab(row.key)}
            className={`rounded px-3 py-2 text-sm ${tab === row.key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}
          >
            {row.label}
          </button>
        ))}
      </div>

      {!caps.readMovement ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Your role does not have inventory read permissions.
        </p>
      ) : null}

      {tab === 'items' && caps.readMovement ? (
        <div className="space-y-4">
          {caps.manageItem ? (
            <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-5" onSubmit={(event) => createItem(event).catch(handleApiError)}>
              <input className="rounded border px-3 py-2" placeholder="Item name" value={itemName} onChange={(event) => setItemName(event.target.value)} required />
              <input className="rounded border px-3 py-2" placeholder="SKU (optional)" value={itemSku} onChange={(event) => setItemSku(event.target.value)} />
              <input className="rounded border px-3 py-2" placeholder="Unit (piece, kg...)" value={itemUnit} onChange={(event) => setItemUnit(event.target.value)} required />
              <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <input type="checkbox" checked={itemActive} onChange={(event) => setItemActive(event.target.checked)} />
                Active
              </label>
              <button className="rounded bg-mono-500 px-3 py-2 text-white">Create Item</button>
            </form>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activeOnlyItems} onChange={(event) => setActiveOnlyItems(event.target.checked)} />
            Show active only
          </label>

          <table className="w-full rounded bg-white text-sm shadow-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">Unit</th>
                <th className="px-3 py-2 text-left">Last Cost</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.sku ?? '-'}</td>
                  <td className="px-3 py-2">{row.unit}</td>
                  <td className="px-3 py-2">
                    {caps.manageItemCost ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="w-28 rounded border px-2 py-1"
                          type="number"
                          step="0.0001"
                          value={itemCostDraft[row.id] ?? (row.lastPurchaseUnitCost ?? '')}
                          onChange={(event) => {
                            const value = event.target.value;
                            setItemCostDraft((prev) => ({ ...prev, [row.id]: value }));
                          }}
                        />
                        <button
                          className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                          onClick={() => {
                            const raw = itemCostDraft[row.id] ?? row.lastPurchaseUnitCost ?? '';
                            const next = raw === '' ? null : Number(raw);
                            apiFetch(`/app-api/inventory/items/${row.id}/cost`, {
                              method: 'PATCH',
                              body: JSON.stringify({ lastPurchaseUnitCost: next })
                            })
                              .then(() => loadItems())
                              .then(() => loadStock())
                              .catch(handleApiError);
                          }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      row.lastPurchaseUnitCost ?? '-'
                    )}
                  </td>
                  <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'warehouses' && caps.readMovement ? (
        <div className="space-y-4">
          {caps.manageWarehouse ? (
            <form
              className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-4"
              onSubmit={(event) => createWarehouse(event).catch(handleApiError)}
            >
              <input className="rounded border px-3 py-2" placeholder="Warehouse name" value={warehouseName} onChange={(event) => setWarehouseName(event.target.value)} required />
              <input className="rounded border px-3 py-2" placeholder="Location (optional)" value={warehouseLocation} onChange={(event) => setWarehouseLocation(event.target.value)} />
              <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <input type="checkbox" checked={warehouseActive} onChange={(event) => setWarehouseActive(event.target.checked)} />
                Active
              </label>
              <button className="rounded bg-mono-500 px-3 py-2 text-white">Create Warehouse</button>
            </form>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activeOnlyWarehouses} onChange={(event) => setActiveOnlyWarehouses(event.target.checked)} />
            Show active only
          </label>

          <table className="w-full rounded bg-white text-sm shadow-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleWarehouses.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.location ?? '-'}</td>
                  <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'stock' && caps.readMovement ? (
        <div className="space-y-4">
          <div className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-4">
            <select className="rounded border px-3 py-2" value={filterItemId} onChange={(event) => setFilterItemId(event.target.value)}>
              <option value="">All items</option>
              {items.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select className="rounded border px-3 py-2" value={filterWarehouseId} onChange={(event) => setFilterWarehouseId(event.target.value)}>
              <option value="">All warehouses</option>
              {warehouses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => loadStock().catch(handleApiError)}>
              Refresh Stock
            </button>
            <button
              className="rounded border border-slate-200 bg-white px-3 py-2"
              onClick={() => {
                setFilterItemId('');
                setFilterWarehouseId('');
                setTimeout(() => {
                  loadStock().catch(handleApiError);
                }, 0);
              }}
            >
              Clear
            </button>
          </div>

          <table className="w-full rounded bg-white text-sm shadow-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Warehouse</th>
                <th className="px-3 py-2 text-left">Current Quantity</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((row) => (
                <tr key={`${row.itemId}-${row.warehouseId}`} className="border-t">
                  <td className="px-3 py-2">{row.itemName}</td>
                  <td className="px-3 py-2">{row.warehouseName}</td>
                  <td className="px-3 py-2">
                    {row.quantity} {row.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'movements' && caps.readMovement ? (
        <div className="space-y-6">
          {caps.manageMovement ? (
            <div className="grid gap-4 md:grid-cols-2">
              <form className="space-y-2 rounded bg-white p-4 shadow-sm" onSubmit={(event) => createMovement(event).catch(handleApiError)}>
                <h2 className="text-lg font-semibold">Manual Movement</h2>
                <select className="w-full rounded border px-3 py-2" value={movementType} onChange={(event) => setMovementType(event.target.value as 'IN' | 'OUT' | 'ADJUSTMENT')}>
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                  <option value="ADJUSTMENT">ADJUSTMENT</option>
                </select>
                <select className="w-full rounded border px-3 py-2" value={movementItemId} onChange={(event) => setMovementItemId(event.target.value)} required>
                  <option value="">Select item</option>
                  {items.filter((row) => row.isActive).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <select className="w-full rounded border px-3 py-2" value={movementWarehouseId} onChange={(event) => setMovementWarehouseId(event.target.value)} required>
                  <option value="">Select warehouse</option>
                  {warehouses.filter((row) => row.isActive).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <input className="w-full rounded border px-3 py-2" type="number" step="0.0001" placeholder="Quantity" value={movementQuantity} onChange={(event) => setMovementQuantity(event.target.value)} required />
                <input className="w-full rounded border px-3 py-2" placeholder="Reference (optional)" value={movementReference} onChange={(event) => setMovementReference(event.target.value)} />
                <button className="rounded bg-mono-500 px-3 py-2 text-white">Create Movement</button>
              </form>

              <form className="space-y-2 rounded bg-white p-4 shadow-sm" onSubmit={(event) => createTransfer(event).catch(handleApiError)}>
                <h2 className="text-lg font-semibold">Transfer</h2>
                <select className="w-full rounded border px-3 py-2" value={transferItemId} onChange={(event) => setTransferItemId(event.target.value)} required>
                  <option value="">Select item</option>
                  {items.filter((row) => row.isActive).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <select className="w-full rounded border px-3 py-2" value={transferFromWarehouseId} onChange={(event) => setTransferFromWarehouseId(event.target.value)} required>
                  <option value="">From warehouse</option>
                  {warehouses.filter((row) => row.isActive).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <select className="w-full rounded border px-3 py-2" value={transferToWarehouseId} onChange={(event) => setTransferToWarehouseId(event.target.value)} required>
                  <option value="">To warehouse</option>
                  {warehouses.filter((row) => row.isActive).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <input className="w-full rounded border px-3 py-2" type="number" step="0.0001" placeholder="Quantity" value={transferQuantity} onChange={(event) => setTransferQuantity(event.target.value)} required />
                <input className="w-full rounded border px-3 py-2" placeholder="Reference (optional)" value={transferReference} onChange={(event) => setTransferReference(event.target.value)} />
                <button className="rounded bg-slate-900 px-3 py-2 text-white disabled:bg-slate-400" disabled={!isTransferValid}>
                  Apply Transfer
                </button>
              </form>
            </div>
          ) : null}

          <div className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-5">
            <select className="rounded border px-3 py-2" value={filterItemId} onChange={(event) => setFilterItemId(event.target.value)}>
              <option value="">All items</option>
              {items.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select className="rounded border px-3 py-2" value={filterWarehouseId} onChange={(event) => setFilterWarehouseId(event.target.value)}>
              <option value="">All warehouses</option>
              {warehouses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <input className="rounded border px-3 py-2" type="date" value={filterFromDate} onChange={(event) => setFilterFromDate(event.target.value)} />
            <input className="rounded border px-3 py-2" type="date" value={filterToDate} onChange={(event) => setFilterToDate(event.target.value)} />
            <button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => loadMovements().catch(handleApiError)}>
              Refresh
            </button>
          </div>

          <table className="w-full rounded bg-white text-sm shadow-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Warehouse</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">Reference</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2">{row.item.name}</td>
                  <td className="px-3 py-2">{row.warehouse.name}</td>
                  <td className="px-3 py-2">
                    {Number(row.quantity)} {row.item.unit}
                  </td>
                  <td className="px-3 py-2">{row.reference ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
