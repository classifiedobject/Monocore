'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type ReservationCapabilities = {
  manageCustomer: boolean;
  manageReservation: boolean;
  readReservation: boolean;
  readReports: boolean;
};

type ReservationTag = {
  id: string;
  name: string;
};

type ReservationCustomer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  visitCount: number;
  totalSpend: string;
  lastVisitAt: string | null;
  tags?: Array<{ tag: ReservationTag }>;
  reservations?: Reservation[];
};

type Reservation = {
  id: string;
  customerId: string | null;
  name: string;
  phone: string | null;
  reservationDate: string;
  reservationTime: string;
  guestCount: number;
  status: 'BOOKED' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELED' | 'NO_SHOW';
  tableRef: string | null;
  notes: string | null;
  customer: ReservationCustomer | null;
};

type ReservationSummary = {
  totalReservations: number;
  noShowCount: number;
  completionRate: number;
  avgGuestsPerReservation: number;
};

type Tab = 'list' | 'customers' | 'reports';

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'list', label: 'Calendar / List' },
  { key: 'customers', label: 'Customers' },
  { key: 'reports', label: 'Reports' }
];

const statusFlow: Record<Reservation['status'], Reservation['status'][]> = {
  BOOKED: ['CONFIRMED', 'CANCELED', 'NO_SHOW'],
  CONFIRMED: ['SEATED', 'CANCELED', 'NO_SHOW'],
  SEATED: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: [],
  NO_SHOW: []
};

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function ReservationsPage() {
  const [tab, setTab] = useState<Tab>('list');
  const [caps, setCaps] = useState<ReservationCapabilities>({
    manageCustomer: false,
    manageReservation: false,
    readReservation: false,
    readReports: false
  });

  const [customers, setCustomers] = useState<ReservationCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [tags, setTags] = useState<ReservationTag[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<ReservationCustomer | null>(null);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationDateFilter, setReservationDateFilter] = useState(ymd(new Date()));
  const [reservationStatusFilter, setReservationStatusFilter] = useState('');

  const [reportFrom, setReportFrom] = useState(ymd(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)));
  const [reportTo, setReportTo] = useState(ymd(new Date()));
  const [summary, setSummary] = useState<ReservationSummary | null>(null);

  const [customerForm, setCustomerForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    notes: ''
  });

  const [tagName, setTagName] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [reservationForm, setReservationForm] = useState({
    customerId: '',
    name: '',
    phone: '',
    reservationDate: ymd(new Date()),
    reservationTime: '19:00',
    guestCount: '2',
    tableRef: '',
    notes: ''
  });

  async function loadCapabilities() {
    const data = (await apiFetch('/app-api/reservations/capabilities')) as ReservationCapabilities;
    setCaps(data);
  }

  async function loadCustomers() {
    const query = new URLSearchParams();
    if (customerSearch.trim()) query.set('search', customerSearch.trim());
    const rows = (await apiFetch(`/app-api/reservations/customers?${query.toString()}`)) as ReservationCustomer[];
    setCustomers(rows);
  }

  async function loadTags() {
    const rows = (await apiFetch('/app-api/reservations/customer-tags')) as ReservationTag[];
    setTags(rows);
  }

  async function loadReservations() {
    const query = new URLSearchParams();
    if (reservationDateFilter) query.set('date', reservationDateFilter);
    if (reservationStatusFilter) query.set('status', reservationStatusFilter);
    const rows = (await apiFetch(`/app-api/reservations/reservations?${query.toString()}`)) as Reservation[];
    setReservations(rows);
  }

  async function loadSummary() {
    const data = (await apiFetch(
      `/app-api/reservations/reports/reservation-summary?from=${reportFrom}&to=${reportTo}`
    )) as ReservationSummary;
    setSummary(data);
  }

  async function loadAll() {
    await Promise.all([loadCapabilities(), loadCustomers(), loadTags(), loadReservations(), loadSummary()]);
  }

  useEffect(() => {
    loadAll().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/reservations/customers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: customerForm.firstName,
        lastName: customerForm.lastName,
        phone: customerForm.phone || null,
        email: customerForm.email || null,
        notes: customerForm.notes || null
      })
    });
    setCustomerForm({ firstName: '', lastName: '', phone: '', email: '', notes: '' });
    await loadCustomers();
  }

  async function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/reservations/customer-tags', {
      method: 'POST',
      body: JSON.stringify({ name: tagName })
    });
    setTagName('');
    await loadTags();
  }

  async function loadCustomerDetail(customerId: string) {
    if (!customerId) {
      setSelectedCustomer(null);
      return;
    }
    const row = (await apiFetch(`/app-api/reservations/customers/${customerId}`)) as ReservationCustomer;
    setSelectedCustomer(row);
    setSelectedTagIds((row.tags ?? []).map((item) => item.tag.id));
  }

  async function saveCustomerTags(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCustomerId) return;
    await apiFetch(`/app-api/reservations/customers/${selectedCustomerId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagIds: selectedTagIds })
    });
    await loadCustomerDetail(selectedCustomerId);
    await loadCustomers();
  }

  async function createReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/reservations/reservations', {
      method: 'POST',
      body: JSON.stringify({
        customerId: reservationForm.customerId || null,
        name: reservationForm.name,
        phone: reservationForm.phone || null,
        reservationDate: reservationForm.reservationDate,
        reservationTime: reservationForm.reservationTime,
        guestCount: Number(reservationForm.guestCount),
        tableRef: reservationForm.tableRef || null,
        notes: reservationForm.notes || null
      })
    });
    setReservationForm((prev) => ({ ...prev, name: '', phone: '', guestCount: '2', tableRef: '', notes: '' }));
    await Promise.all([loadReservations(), loadCustomers(), loadSummary()]);
  }

  async function setStatus(id: string, newStatus: Reservation['status']) {
    await apiFetch(`/app-api/reservations/reservations/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ newStatus })
    });
    await Promise.all([loadReservations(), loadCustomers(), loadSummary()]);
    if (selectedCustomerId) {
      await loadCustomerDetail(selectedCustomerId);
    }
  }

  const groupedReservations = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const row of reservations) {
      const key = row.reservationDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [reservations]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Reservation & CRM</h1>
        <p className="mt-2 text-sm text-slate-600">Customer profiles, reservations and basic operational CRM metrics.</p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded border px-3 py-1.5 text-sm ${tab === item.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'list' && (
        <div className="space-y-4">
          {caps.manageReservation && (
            <form onSubmit={createReservation} className="rounded border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">Create Reservation</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <select className="rounded border p-2" value={reservationForm.customerId} onChange={(e) => setReservationForm((prev) => ({ ...prev, customerId: e.target.value }))}>
                  <option value="">Walk-in / no customer</option>
                  {customers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.firstName} {row.lastName}
                    </option>
                  ))}
                </select>
                <input className="rounded border p-2" placeholder="Reservation name" value={reservationForm.name} onChange={(e) => setReservationForm((prev) => ({ ...prev, name: e.target.value }))} required />
                <input className="rounded border p-2" placeholder="Phone" value={reservationForm.phone} onChange={(e) => setReservationForm((prev) => ({ ...prev, phone: e.target.value }))} />
                <input className="rounded border p-2" type="date" value={reservationForm.reservationDate} onChange={(e) => setReservationForm((prev) => ({ ...prev, reservationDate: e.target.value }))} required />
                <input className="rounded border p-2" type="time" value={reservationForm.reservationTime} onChange={(e) => setReservationForm((prev) => ({ ...prev, reservationTime: e.target.value }))} required />
                <input className="rounded border p-2" type="number" min={1} value={reservationForm.guestCount} onChange={(e) => setReservationForm((prev) => ({ ...prev, guestCount: e.target.value }))} required />
                <input className="rounded border p-2" placeholder="Table ref" value={reservationForm.tableRef} onChange={(e) => setReservationForm((prev) => ({ ...prev, tableRef: e.target.value }))} />
                <input className="rounded border p-2 md:col-span-2" placeholder="Notes" value={reservationForm.notes} onChange={(e) => setReservationForm((prev) => ({ ...prev, notes: e.target.value }))} />
              </div>
              <button type="submit" className="mt-3 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white">Save Reservation</button>
            </form>
          )}

          <div className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Reservations</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <input type="date" className="rounded border p-2 text-sm" value={reservationDateFilter} onChange={(e) => setReservationDateFilter(e.target.value)} />
              <select className="rounded border p-2 text-sm" value={reservationStatusFilter} onChange={(e) => setReservationStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {(['BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELED', 'NO_SHOW'] as const).map((row) => (
                  <option key={row} value={row}>
                    {row}
                  </option>
                ))}
              </select>
              <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => loadReservations().catch(handleApiError)}>
                Apply
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {groupedReservations.length === 0 && <p className="text-sm text-slate-500">No reservations found.</p>}
              {groupedReservations.map(([day, rows]) => (
                <div key={day} className="rounded border border-slate-100">
                  <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{day}</div>
                  <ul>
                    {rows.map((row) => (
                      <li key={row.id} className="border-b px-3 py-3 last:border-b-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">
                              {row.name} {row.customer ? `(${row.customer.firstName} ${row.customer.lastName})` : ''}
                            </p>
                            <p className="text-xs text-slate-500">
                              {row.reservationTime.slice(11, 16)} • Guests: {row.guestCount} • Table: {row.tableRef || '-'} • Status: {row.status}
                            </p>
                          </div>
                          {caps.manageReservation && (
                            <div className="flex flex-wrap gap-2">
                              {statusFlow[row.status].map((nextStatus) => (
                                <button
                                  key={`${row.id}-${nextStatus}`}
                                  type="button"
                                  onClick={() => setStatus(row.id, nextStatus)}
                                  className="rounded border px-2 py-1 text-xs"
                                >
                                  {nextStatus}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <div className="space-y-4">
          {caps.manageCustomer && (
            <form onSubmit={createCustomer} className="rounded border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">Create Customer</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input className="rounded border p-2" placeholder="First name" value={customerForm.firstName} onChange={(e) => setCustomerForm((prev) => ({ ...prev, firstName: e.target.value }))} required />
                <input className="rounded border p-2" placeholder="Last name" value={customerForm.lastName} onChange={(e) => setCustomerForm((prev) => ({ ...prev, lastName: e.target.value }))} required />
                <input className="rounded border p-2" placeholder="Phone" value={customerForm.phone} onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))} />
                <input className="rounded border p-2" placeholder="Email" value={customerForm.email} onChange={(e) => setCustomerForm((prev) => ({ ...prev, email: e.target.value }))} />
                <input className="rounded border p-2 md:col-span-2" placeholder="Notes" value={customerForm.notes} onChange={(e) => setCustomerForm((prev) => ({ ...prev, notes: e.target.value }))} />
              </div>
              <button type="submit" className="mt-3 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white">Save Customer</button>
            </form>
          )}

          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input className="rounded border p-2 text-sm" placeholder="Search customers" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
              <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => loadCustomers().catch(handleApiError)}>
                Search
              </button>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="rounded border border-slate-100">
                <ul>
                  {customers.map((row) => (
                    <li key={row.id} className="border-b px-3 py-2 last:border-b-0">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => {
                          setSelectedCustomerId(row.id);
                          loadCustomerDetail(row.id).catch(handleApiError);
                        }}
                      >
                        <p className="font-medium text-slate-900">
                          {row.firstName} {row.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          Visits: {row.visitCount} • Total spend: {Number(row.totalSpend).toFixed(2)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded border border-slate-100 p-3">
                {!selectedCustomer && <p className="text-sm text-slate-500">Select a customer to view profile and visit history.</p>}
                {selectedCustomer && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h3>
                    <p className="text-sm text-slate-600">
                      Visits: {selectedCustomer.visitCount} • Total spend: {Number(selectedCustomer.totalSpend).toFixed(2)} • Last visit:{' '}
                      {selectedCustomer.lastVisitAt ? selectedCustomer.lastVisitAt.slice(0, 10) : '-'}
                    </p>

                    {caps.manageCustomer && (
                      <>
                        <form onSubmit={createTag} className="flex gap-2">
                          <input className="flex-1 rounded border p-2 text-sm" placeholder="New tag name" value={tagName} onChange={(e) => setTagName(e.target.value)} />
                          <button type="submit" className="rounded border px-3 py-2 text-sm">
                            Add Tag
                          </button>
                        </form>

                        <form onSubmit={saveCustomerTags} className="space-y-2">
                          <p className="text-sm font-medium text-slate-700">Tags</p>
                          <div className="grid gap-1">
                            {tags.map((row) => (
                              <label key={row.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={selectedTagIds.includes(row.id)}
                                  onChange={(e) =>
                                    setSelectedTagIds((prev) =>
                                      e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id)
                                    )
                                  }
                                />
                                {row.name}
                              </label>
                            ))}
                          </div>
                          <button type="submit" className="rounded border px-3 py-2 text-sm">
                            Save Tags
                          </button>
                        </form>
                      </>
                    )}

                    <div>
                      <p className="text-sm font-medium text-slate-700">Visit history</p>
                      <ul className="mt-1 space-y-1 text-sm text-slate-600">
                        {(selectedCustomer.reservations ?? []).slice(0, 10).map((row) => (
                          <li key={row.id}>
                            {row.reservationDate.slice(0, 10)} {row.reservationTime.slice(11, 16)} • {row.status} • {row.guestCount} guests
                          </li>
                        ))}
                        {(selectedCustomer.reservations ?? []).length === 0 && <li>No visits yet.</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Reservation Summary</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <input type="date" className="rounded border p-2 text-sm" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
            <input type="date" className="rounded border p-2 text-sm" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => loadSummary().catch(handleApiError)}>
              Refresh
            </button>
          </div>

          {summary && (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <div className="rounded border border-slate-100 p-3 text-sm">Total reservations: {summary.totalReservations}</div>
              <div className="rounded border border-slate-100 p-3 text-sm">No-show count: {summary.noShowCount}</div>
              <div className="rounded border border-slate-100 p-3 text-sm">Completion rate: {summary.completionRate.toFixed(2)}%</div>
              <div className="rounded border border-slate-100 p-3 text-sm">Avg guests/reservation: {summary.avgGuestsPerReservation.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
