'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, handleApiError } from '../../../lib/api';

type CompanyMembership = {
  id: string;
  companyId: string;
  status: string;
  company: {
    id: string;
    name: string;
    plan: string;
    locale: string;
    onboardingCompleted: boolean;
    onboardingStep: number;
  };
};

export default function CompanyPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<CompanyMembership[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState('');
  const [name, setName] = useState('New Company');
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    const rows = (await apiFetch('/app-api/companies')) as CompanyMembership[];
    setMemberships(rows);
    const stored = window.localStorage.getItem('activeCompanyId') ?? '';
    const first = rows[0]?.company?.id ?? '';
    const selected = rows.some((row) => row.company.id === stored) ? stored : first;
    if (selected) {
      window.localStorage.setItem('activeCompanyId', selected);
      setActiveCompanyId(selected);
    }
  };

  useEffect(() => {
    load().catch(handleApiError);
  }, []);

  function selectCompany(companyId: string) {
    window.localStorage.setItem('activeCompanyId', companyId);
    setActiveCompanyId(companyId);
    const selected = memberships.find((row) => row.company.id === companyId);
    if (selected && !selected.company.onboardingCompleted) {
      router.push('/app/onboarding');
      return;
    }
    router.push('/app/home');
  }

  async function createCompany(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const created = (await apiFetch('/app-api/companies', {
        method: 'POST',
        body: JSON.stringify({ name })
      })) as { id: string };
      await load();
      selectCompany(created.id);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Company Selection / Create</h1>
      <form className="flex gap-2" onSubmit={createCompany}>
        <input
          className="rounded border p-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Company name"
        />
        <button className="rounded bg-mono-500 px-4 text-white disabled:opacity-60" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create'}
        </button>
      </form>
      <div className="grid gap-3">
        {memberships.map((membership) => {
          const isActive = membership.company.id === activeCompanyId;
          return (
            <article
              key={membership.id}
              className="flex items-center justify-between rounded border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <h2 className="text-lg font-semibold">{membership.company.name}</h2>
                <p className="text-sm text-slate-600">
                  Plan: {membership.company.plan} | Locale: {membership.company.locale}
                </p>
                <p className="text-xs text-slate-500">
                  Onboarding: {membership.company.onboardingCompleted ? 'Completed' : `Step ${membership.company.onboardingStep}/5`}
                </p>
              </div>
              <button
                className="rounded px-3 py-2 text-sm text-white disabled:cursor-default disabled:bg-slate-400 bg-mono-500"
                disabled={isActive}
                onClick={() => selectCompany(membership.company.id)}
              >
                {isActive ? 'Active' : 'Select'}
              </button>
            </article>
          );
        })}
        {memberships.length === 0 ? (
          <p className="rounded border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            No companies yet. Create one above.
          </p>
        ) : null}
      </div>
    </section>
  );
}
