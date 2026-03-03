'use client';

import { useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type TrendPoint = { date: string; value: number };

type DashboardData = {
  summary: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    netProfit: number;
    netMarginPct: number;
    cashPosition: number;
    outstandingReceivables: number;
    outstandingPayables: number;
    inventoryValue: number;
    reservationCount: number;
    taskOverdueCount: number;
  };
  trends: {
    revenueTrend: TrendPoint[];
    netProfitTrend: TrendPoint[];
    cashflowTrend: TrendPoint[];
  };
  alerts: Array<{ type: string; severity: 'info' | 'warning' | 'critical' | 'good'; severityColor: 'green' | 'yellow' | 'red'; message: string }>;
  topRisks: Array<{ type: string; severity: 'info' | 'warning' | 'critical' | 'good'; severityColor: 'green' | 'yellow' | 'red'; message: string }>;
  recommendedActions: string[];
  lowStockItems: Array<{ itemId: string; name: string; quantity: number; threshold: number }>;
  overdueTasks: Array<{ id: string; title: string; dueDate: string; assignee: string | null }>;
};

function money(value: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(value);
}

export default function ExecutivePage() {
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<DashboardData | null>(null);

  async function load() {
    const query = new URLSearchParams({ from, to });
    const result = (await apiFetch(`/app-api/executive/dashboard?${query.toString()}`)) as DashboardData;
    setData(result);
  }

  useEffect(() => {
    load().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Executive Intelligence</h1>
        <p className="text-sm text-slate-600">Cross-module KPI dashboard with trend lines and risk alerts.</p>
      </header>

      <form
        className="flex flex-wrap items-end gap-3 rounded bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          load().catch(handleApiError);
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          From
          <input className="rounded border px-3 py-2" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          To
          <input className="rounded border px-3 py-2" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button className="rounded bg-mono-500 px-4 py-2 text-white">Refresh</button>
      </form>

      {data ? (
        <>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Revenue</p><p className="text-xl font-semibold">{money(data.summary.revenue)}</p></div>
            <div className="rounded bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Gross Profit</p><p className="text-xl font-semibold">{money(data.summary.grossProfit)}</p><p className="text-xs text-slate-500">{data.summary.grossMarginPct.toFixed(1)}% margin</p></div>
            <div className="rounded bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Net Profit</p><p className="text-xl font-semibold">{money(data.summary.netProfit)}</p><p className="text-xs text-slate-500">{data.summary.netMarginPct.toFixed(1)}% margin</p></div>
            <div className="rounded bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Cash Position</p><p className="text-xl font-semibold">{money(data.summary.cashPosition)}</p></div>
            <div className="rounded bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Receivables</p><p className="text-xl font-semibold">{money(data.summary.outstandingReceivables)}</p></div>
            <div className="rounded bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Payables</p><p className="text-xl font-semibold">{money(data.summary.outstandingPayables)}</p></div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">Revenue Trend</h2>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-2 py-1 text-left">Date</th>
                      <th className="px-2 py-1 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trends.revenueTrend.map((point) => (
                      <tr key={point.date} className="border-t">
                        <td className="px-2 py-1">{point.date}</td>
                        <td className="px-2 py-1 text-right">{money(point.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">Net Profit Trend</h2>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-2 py-1 text-left">Date</th>
                      <th className="px-2 py-1 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trends.netProfitTrend.map((point) => (
                      <tr key={point.date} className="border-t">
                        <td className="px-2 py-1">{point.date}</td>
                        <td className="px-2 py-1 text-right">{money(point.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Cashflow Trend</h2>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Date</th>
                    <th className="px-2 py-1 text-right">Net Inflow</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trends.cashflowTrend.map((point) => (
                    <tr key={point.date} className="border-t">
                      <td className="px-2 py-1">{point.date}</td>
                      <td className="px-2 py-1 text-right">{money(point.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">Alerts</h2>
              {data.alerts.length === 0 ? <p className="text-sm text-slate-500">No alerts.</p> : null}
              <ul className="space-y-2 text-sm">
                {data.alerts.map((alert) => (
                  <li
                    key={alert.type}
                    className={`rounded border p-2 ${
                      alert.severityColor === 'red'
                        ? 'border-red-300 bg-red-50'
                        : alert.severityColor === 'yellow'
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-green-300 bg-green-50'
                    }`}
                  >
                    <p className="font-medium">{alert.severity.toUpperCase()}</p>
                    <p>{alert.message}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">Low Stock</h2>
              {data.lowStockItems.length === 0 ? <p className="text-sm text-slate-500">No low stock items.</p> : null}
              <ul className="space-y-2 text-sm">
                {data.lowStockItems.map((item) => (
                  <li key={item.itemId} className="flex items-center justify-between rounded border p-2">
                    <span>{item.name}</span>
                    <span className="font-medium">{item.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">Overdue Tasks</h2>
              {data.overdueTasks.length === 0 ? <p className="text-sm text-slate-500">No overdue tasks.</p> : null}
              <ul className="space-y-2 text-sm">
                {data.overdueTasks.map((task) => (
                  <li key={task.id} className="rounded border p-2">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-slate-500">Due: {task.dueDate}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">Top 3 Risks</h2>
              <ul className="space-y-2 text-sm">
                {data.topRisks.map((risk) => (
                  <li key={risk.type} className="rounded border p-2">
                    <p className="font-medium">{risk.type}</p>
                    <p>{risk.message}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">Recommended Actions</h2>
              <ol className="list-decimal space-y-2 pl-6 text-sm">
                {data.recommendedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ol>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading dashboard…</p>
      )}
    </section>
  );
}
