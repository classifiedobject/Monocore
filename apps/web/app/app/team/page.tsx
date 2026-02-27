'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type InviteRow = {
  id: string;
  email: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  roleId: string | null;
};

export default function TeamPage() {
  const [tab, setTab] = useState<'members' | 'invites'>('members');
  const [rows, setRows] = useState<any[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState('member@example.com');
  const [roleId, setRoleId] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const loadTeam = () => apiFetch('/app-api/team').then(setRows).catch(handleApiError);
  const loadInvites = () => apiFetch('/app-api/invites').then(setInvites).catch(handleApiError);
  useEffect(() => {
    void loadTeam();
    void loadInvites();
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    const result = (await apiFetch('/app-api/invites', {
      method: 'POST',
      body: JSON.stringify({ email, roleId: roleId || null })
    })) as { acceptUrl?: string };
    setInviteLink(result.acceptUrl ?? '');
    await loadInvites();
  }

  async function resend(id: string) {
    const result = (await apiFetch(`/app-api/invites/${id}/resend`, { method: 'POST' })) as { acceptUrl?: string };
    setInviteLink(result.acceptUrl ?? '');
    await loadInvites();
  }

  async function revoke(id: string) {
    await apiFetch(`/app-api/invites/${id}/revoke`, { method: 'POST' });
    await loadInvites();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Team</h1>
      <div className="flex gap-2">
        <button className="rounded border px-3 py-1" onClick={() => setTab('members')}>
          Members
        </button>
        <button className="rounded border px-3 py-1" onClick={() => setTab('invites')}>
          Invites
        </button>
      </div>
      {tab === 'members' ? <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(rows, null, 2)}</pre> : null}
      {tab === 'invites' ? (
        <div className="space-y-3">
          <form className="flex gap-2" onSubmit={invite}>
            <input className="rounded border p-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              className="rounded border p-2"
              placeholder="Role ID (optional)"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            />
            <button className="rounded bg-mono-500 px-4 text-white">Create Invite</button>
          </form>
          {inviteLink ? <p className="text-sm text-slate-700">Latest invite link: {inviteLink}</p> : null}
          <div className="space-y-2">
            {invites.map((inviteRow) => (
              <article key={inviteRow.id} className="rounded border bg-white p-3">
                <p className="font-medium">{inviteRow.email}</p>
                <p className="text-xs text-slate-600">
                  expires: {inviteRow.expiresAt} | used: {String(Boolean(inviteRow.usedAt))} | revoked:{' '}
                  {String(Boolean(inviteRow.revokedAt))}
                </p>
                <div className="mt-2 flex gap-2">
                  <button className="rounded border px-2 py-1 text-sm" onClick={() => void resend(inviteRow.id)}>
                    Resend
                  </button>
                  <button className="rounded border px-2 py-1 text-sm" onClick={() => void revoke(inviteRow.id)}>
                    Revoke
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
