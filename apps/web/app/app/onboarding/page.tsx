'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, handleApiError } from '../../../lib/api';

type OnboardingStatus = {
  id: string;
  name: string;
  locale: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [profitCenters, setProfitCenters] = useState('Main Hall, Delivery, Events');
  const [warehouseName, setWarehouseName] = useState('Main Warehouse');
  const [itemName, setItemName] = useState('Starter Item');
  const [employeeName, setEmployeeName] = useState('Jane Doe');
  const [productName, setProductName] = useState('Starter Product');
  const [busy, setBusy] = useState(false);

  async function load() {
    const current = (await apiFetch('/app-api/onboarding/status')) as OnboardingStatus;
    setStatus(current);
    setCompanyName(current.name);
    if (current.onboardingCompleted) {
      router.push('/app/home');
    }
  }

  useEffect(() => {
    load().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stepCompanyBasics(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/app-api/onboarding/company-basics', {
        method: 'POST',
        body: JSON.stringify({ name: companyName })
      });
      await load();
    } catch (error) {
      handleApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function stepProfitCenters(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const names = profitCenters
        .split(',')
        .map((row) => row.trim())
        .filter(Boolean);
      await apiFetch('/app-api/onboarding/profit-centers', {
        method: 'POST',
        body: JSON.stringify({ names })
      });
      await load();
    } catch (error) {
      handleApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function stepInventory(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/app-api/onboarding/inventory-bootstrap', {
        method: 'POST',
        body: JSON.stringify({
          warehouseName,
          itemName,
          unit: 'piece',
          initialStock: 25
        })
      });
      await load();
    } catch (error) {
      handleApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function stepEmployee(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const [firstName = 'Jane', lastName = 'Doe'] = employeeName.trim().split(/\s+/, 2);
      await apiFetch('/app-api/onboarding/employee', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          salaryType: 'fixed',
          baseSalary: 10000
        })
      });
      await load();
    } catch (error) {
      handleApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function stepFirstSale(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/app-api/onboarding/first-sales-order', {
        method: 'POST',
        body: JSON.stringify({
          productName,
          quantity: 1,
          unitPrice: 120
        })
      });
      await load();
      router.push('/app/home');
    } catch (error) {
      handleApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function generateDemoData() {
    setBusy(true);
    try {
      await apiFetch('/app-api/demo/generate', { method: 'POST', body: JSON.stringify({}) });
      await load();
      router.push('/app/executive');
    } catch (error) {
      handleApiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold">Onboarding Wizard</h1>
        <p className="text-sm text-slate-600">
          Step {status?.onboardingStep ?? 1} / 5 {status?.onboardingCompleted ? '(Completed)' : ''}
        </p>
      </header>

      <article className="space-y-2 rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">1) Company Basics</h2>
        <form className="flex gap-2" onSubmit={stepCompanyBasics}>
          <input
            className="w-full rounded border p-2"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Company name"
          />
          <button className="rounded bg-mono-500 px-4 py-2 text-white disabled:opacity-60" disabled={busy}>
            Save
          </button>
        </form>
      </article>

      <article className="space-y-2 rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">2) Profit Centers</h2>
        <form className="flex gap-2" onSubmit={stepProfitCenters}>
          <input
            className="w-full rounded border p-2"
            value={profitCenters}
            onChange={(event) => setProfitCenters(event.target.value)}
            placeholder="Comma separated names"
          />
          <button className="rounded bg-mono-500 px-4 py-2 text-white disabled:opacity-60" disabled={busy}>
            Create
          </button>
        </form>
      </article>

      <article className="space-y-2 rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">3) Inventory Bootstrap</h2>
        <form className="grid gap-2 md:grid-cols-3" onSubmit={stepInventory}>
          <input
            className="rounded border p-2"
            value={warehouseName}
            onChange={(event) => setWarehouseName(event.target.value)}
            placeholder="Warehouse"
          />
          <input
            className="rounded border p-2"
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            placeholder="First item"
          />
          <button className="rounded bg-mono-500 px-4 py-2 text-white disabled:opacity-60" disabled={busy}>
            Add
          </button>
        </form>
      </article>

      <article className="space-y-2 rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">4) Employee</h2>
        <form className="flex gap-2" onSubmit={stepEmployee}>
          <input
            className="w-full rounded border p-2"
            value={employeeName}
            onChange={(event) => setEmployeeName(event.target.value)}
            placeholder="Employee full name"
          />
          <button className="rounded bg-mono-500 px-4 py-2 text-white disabled:opacity-60" disabled={busy}>
            Add
          </button>
        </form>
      </article>

      <article className="space-y-2 rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">5) First Sales Order</h2>
        <form className="flex gap-2" onSubmit={stepFirstSale}>
          <input
            className="w-full rounded border p-2"
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            placeholder="Product name"
          />
          <button className="rounded bg-mono-500 px-4 py-2 text-white disabled:opacity-60" disabled={busy}>
            Create & Complete
          </button>
        </form>
      </article>

      <article className="space-y-2 rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Pilot Demo Data</h2>
        <p className="text-sm text-slate-600">Optional: generate full demo records for pilot sessions.</p>
        <button
          className="rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
          disabled={busy}
          onClick={() => void generateDemoData()}
        >
          Generate Demo Data
        </button>
      </article>
    </section>
  );
}
