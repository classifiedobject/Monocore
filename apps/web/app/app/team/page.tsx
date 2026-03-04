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

type RoleRow = { id: string; key: string; name: string };
type RoleTemplate = { key: string; name: string; description: string; permissionCount: number };

export default function TeamPage() {
  const [tab, setTab] = useState<'members' | 'invites'>('members');
  const [rows, setRows] = useState<any[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [email, setEmail] = useState('member@example.com');
  const [roleId, setRoleId] = useState('');
  const [templateKey, setTemplateKey] = useState('staff');
  const [inviteLink, setInviteLink] = useState('');

  const loadTeam = () => apiFetch('/app-api/team').then(setRows).catch(handleApiError);
  const loadInvites = () => apiFetch('/app-api/invites').then(setInvites).catch(handleApiError);
  const loadRoles = () => apiFetch('/app-api/roles').then((items) => setRoles(items as RoleRow[])).catch(handleApiError);
  const loadTemplates = () =>
    apiFetch('/app-api/company/role-templates').then((items) => setTemplates(items as RoleTemplate[])).catch(handleApiError);
  useEffect(() => {
    void loadTeam();
    void loadInvites();
    void loadRoles();
    void loadTemplates();
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

  async function applyTemplate(membershipId: string) {
    await apiFetch('/app-api/company/apply-role-template', {
      method: 'POST',
      body: JSON.stringify({ membershipId, template: templateKey })
    });
    await loadTeam();
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
      {tab === 'members' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded border bg-white p-3">
            <label className="text-sm">Role preset:</label>
            <select
              className="rounded border px-2 py-1 text-sm"
              value={templateKey}
              onChange={(event) => setTemplateKey(event.target.value)}
            >
              {templates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          {rows.map((member) => (
            <article key={member.id} className="rounded border bg-white p-3">
              <p className="font-medium">{member.user?.fullName ?? member.user?.email ?? member.id}</p>
              <p className="text-sm text-slate-600">{member.user?.email ?? '-'}</p>
              <p className="text-xs text-slate-500">
                Roles: {(member.roles ?? []).map((entry: { role?: { name?: string } }) => entry.role?.name).filter(Boolean).join(', ') || '-'}
              </p>
              <button className="mt-2 rounded border px-2 py-1 text-sm" onClick={() => void applyTemplate(member.id)}>
                Apply Selected Template
              </button>
            </article>
          ))}
        </div>
      ) : null}
      {tab === 'invites' ? (
        <div className="space-y-3">
          <form className="flex gap-2" onSubmit={invite}>
            <input className="rounded border p-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="rounded border p-2" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">No role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} ({role.key})
                </option>
              ))}
            </select>
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
