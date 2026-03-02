'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type SalesCaps = {
  readOrder: boolean;
  manageOrder: boolean;
  postOrder: boolean;
  financeEntryCreate: boolean;
};

type Product = {
  id: string;
  name: string;
  salesPrice: string | null;
};

type Warehouse = {
  id: string;
  name: string;
};

type ProfitCenter = {
  id: string;
  name: string;
};

type Order = {
  id: string;
  orderNo: string | null;
  status: 'DRAFT' | 'POSTED' | 'VOID';
  orderDate: string;
  totalRevenue: string;
  totalCogs: string;
  warehouse: Warehouse | null;
  profitCenter: ProfitCenter | null;
  lines: Array<{ id: string; quantity: string; unitPrice: string; lineTotal: string; product: Product }>;
};

export default function SalesPage() {
  const [caps, setCaps] = useState<SalesCaps>({ readOrder: false, manageOrder: false, postOrder: false, financeEntryCreate: false });
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [profitCenters, setProfitCenters] = useState<ProfitCenter[]>([]);

  const [orderNo, setOrderNo] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState('');
  const [profitCenterId, setProfitCenterId] = useState('');
  const [lineProductId, setLineProductId] = useState('');
  const [lineQty, setLineQty] = useState('');
  const [linePrice, setLinePrice] = useState('');
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number; unitPrice: number }>>([]);

  const canPost = caps.postOrder && caps.financeEntryCreate;

  async function load() {
    const [capRows, orderRows, productRows, warehouseRows] = await Promise.all([
      apiFetch('/app-api/sales/capabilities') as Promise<SalesCaps>,
      apiFetch('/app-api/sales/orders') as Promise<Order[]>,
      apiFetch('/app-api/recipes/products') as Promise<Product[]>,
      apiFetch('/app-api/inventory/warehouses') as Promise<Warehouse[]>
    ]);
    setCaps(capRows);
    setOrders(orderRows);
    setProducts(productRows);
    setWarehouses(warehouseRows);

    try {
      const centers = (await apiFetch('/app-api/finance/profit-centers?active=true')) as ProfitCenter[];
      setProfitCenters(centers);
    } catch {
      setProfitCenters([]);
    }
  }

  useEffect(() => {
    load().catch(handleApiError);
  }, []);

  const linePreview = useMemo(
    () =>
      lines.map((row) => ({
        ...row,
        productName: products.find((p) => p.id === row.productId)?.name ?? row.productId,
        lineTotal: row.quantity * row.unitPrice
      })),
    [lines, products]
  );

  function addLine() {
    if (!lineProductId || Number(lineQty) <= 0 || Number(linePrice) < 0) return;
    setLines((prev) => [...prev, { productId: lineProductId, quantity: Number(lineQty), unitPrice: Number(linePrice) }]);
    setLineProductId('');
    setLineQty('');
    setLinePrice('');
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/sales/orders', {
      method: 'POST',
      body: JSON.stringify({
        orderNo: orderNo || null,
        orderDate,
        warehouseId: warehouseId || null,
        profitCenterId: profitCenterId || null,
        currency: 'TRY',
        lines
      })
    });
    setOrderNo('');
    setLines([]);
    await load();
  }

  async function postOrder(orderId: string) {
    await apiFetch(`/app-api/sales/orders/${orderId}/post`, { method: 'POST', body: JSON.stringify({}) });
    await load();
  }

  async function voidOrder(orderId: string) {
    await apiFetch(`/app-api/sales/orders/${orderId}/void`, { method: 'POST', body: JSON.stringify({}) });
    await load();
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Sales Core</h1>
        <p className="text-sm text-slate-600">Manual sales ledger with inventory consumption and COGS posting.</p>
      </header>

      {!caps.readOrder ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Your role does not have sales read permission.
        </p>
      ) : null}

      {caps.manageOrder ? (
        <form className="space-y-3 rounded bg-white p-4 shadow-sm" onSubmit={(event) => createOrder(event).catch(handleApiError)}>
          <h2 className="text-lg font-semibold">Create Order</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <input className="rounded border px-3 py-2" placeholder="Order no (optional)" value={orderNo} onChange={(event) => setOrderNo(event.target.value)} />
            <input className="rounded border px-3 py-2" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} required />
            <select className="rounded border px-3 py-2" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              <option value="">Warehouse (required for post)</option>
              {warehouses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select className="rounded border px-3 py-2" value={profitCenterId} onChange={(event) => setProfitCenterId(event.target.value)}>
              <option value="">Profit Center (optional)</option>
              {profitCenters.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <select className="rounded border px-3 py-2" value={lineProductId} onChange={(event) => setLineProductId(event.target.value)}>
              <option value="">Product</option>
              {products.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <input className="rounded border px-3 py-2" type="number" step="0.0001" placeholder="Quantity" value={lineQty} onChange={(event) => setLineQty(event.target.value)} />
            <input className="rounded border px-3 py-2" type="number" step="0.01" placeholder="Unit Price" value={linePrice} onChange={(event) => setLinePrice(event.target.value)} />
            <button type="button" className="rounded border border-slate-300 bg-white px-3 py-2" onClick={addLine}>
              Add Line
            </button>
          </div>

          <pre className="rounded bg-slate-50 p-3 text-xs">{JSON.stringify(linePreview, null, 2)}</pre>

          <button className="rounded bg-mono-500 px-3 py-2 text-white" disabled={lines.length === 0}>
            Save Draft Order
          </button>
        </form>
      ) : null}

      <div className="rounded bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Orders</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">Order</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Revenue</th>
              <th className="px-3 py-2 text-left">COGS</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-2">{row.orderNo ?? row.id.slice(0, 8)}</td>
                <td className="px-3 py-2">{new Date(row.orderDate).toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.totalRevenue}</td>
                <td className="px-3 py-2">{row.totalCogs}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {row.status === 'DRAFT' && canPost ? (
                      <button className="rounded bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => postOrder(row.id).catch(handleApiError)}>
                        Post
                      </button>
                    ) : null}
                    {row.status !== 'VOID' && caps.manageOrder ? (
                      <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={() => voidOrder(row.id).catch(handleApiError)}>
                        Void
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

