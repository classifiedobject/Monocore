'use client';

import { useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type LogItem = {
  id: string;
  action: string;
  actorUserId: string | null;
  createdAt: string;
  actor?: { id: string; email: string } | null;
};

export default function LogsCenterPage() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('');
  const [actorUserId, setActorUserId] = useState('');

  const load = async (targetPage = page) => {
    const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (action) params.set('action', action);
    if (actorUserId) params.set('actorUserId', actorUserId);

    const response = (await apiFetch(`/platform-api/audit-logs?${params.toString()}`)) as {
      items: LogItem[];
      total: number;
      page: number;
      pageSize: number;
    };

    setItems(response.items);
    setTotal(response.total);
    setPage(response.page);
  };

  useEffect(() => {
    load().catch(handleApiError);
  }, []);

  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Logs Center</h1>

      <div className="grid gap-2 rounded border bg-white p-3 md:grid-cols-5">
        <input type="datetime-local" className="rounded border p-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="datetime-local" className="rounded border p-2" value={to} onChange={(e) => setTo(e.target.value)} />
        <input className="rounded border p-2" placeholder="Action" value={action} onChange={(e) => setAction(e.target.value)} />
        <input
          className="rounded border p-2"
          placeholder="Actor user id"
          value={actorUserId}
          onChange={(e) => setActorUserId(e.target.value)}
        />
        <button className="rounded bg-mono-500 px-3 py-2 text-white" onClick={() => void load(1)}>
          Apply Filters
        </button>
      </div>

      <div className="rounded border bg-white p-3">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Time</th>
              <th>Action</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="py-2">{row.createdAt}</td>
                <td>{row.action}</td>
                <td>{row.actor?.email ?? row.actorUserId ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="rounded border px-3 py-1"
          disabled={page <= 1}
          onClick={() => void load(page - 1)}
        >
          Prev
        </button>
        <span className="text-sm">Page {page} / {maxPage}</span>
        <button
          className="rounded border px-3 py-1"
          disabled={page >= maxPage}
          onClick={() => void load(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
