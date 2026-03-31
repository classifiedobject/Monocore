'use client';

import { FormEvent, useEffect, useState } from 'react';
import { EmptyState, PageHeader, SectionCard, StatusBadge, formatDate, formatTextList } from '../../../components/readable-ui';
import { apiFetch, handleApiError } from '../../../lib/api';

type InviteRow = {
  id: string;
  email: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  roleId: string | null;
};

type PlatformRoleEntry = { role?: { name?: string | null } | null } | { name?: string | null };

type UserRow = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  platformRoles?: PlatformRoleEntry[];
};

function getPlatformRoleName(entry: PlatformRoleEntry) {
  const roleEntry = entry as { role?: { name?: string | null } | null };
  if (roleEntry.role) {
    return roleEntry.role.name ?? null;
  }
  return (entry as { name?: string | null }).name ?? null;
}

export default function PlatformTeamPage() {
  const [tab, setTab] = useState<'members' | 'invites'>('members');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState('internal@themonocore.com');
  const [roleId, setRoleId] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const loadUsers = () => apiFetch('/platform-api/team').then(setUsers).catch(handleApiError);
  const loadInvites = () => apiFetch('/platform-api/invites').then(setInvites).catch(handleApiError);
  useEffect(() => {
    void loadUsers();
    void loadInvites();
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    const result = (await apiFetch('/platform-api/invites', {
      method: 'POST',
      body: JSON.stringify({ email, roleId: roleId || null })
    })) as { acceptUrl?: string };
    setInviteLink(result.acceptUrl ?? '');
    await loadInvites();
  }

  async function resend(id: string) {
    const result = (await apiFetch(`/platform-api/invites/${id}/resend`, { method: 'POST' })) as { acceptUrl?: string };
    setInviteLink(result.acceptUrl ?? '');
    await loadInvites();
  }

  async function revoke(id: string) {
    await apiFetch(`/platform-api/invites/${id}/revoke`, { method: 'POST' });
    await loadInvites();
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Platform Ekibi"
        description="Monocore iç ekibindeki kullanıcıları ve davet süreçlerini bu ekrandan yönetebilirsin."
      />

      <div className="flex gap-2">
        <button className="rounded border px-3 py-1" onClick={() => setTab('members')}>
          Üyeler
        </button>
        <button className="rounded border px-3 py-1" onClick={() => setTab('invites')}>
          Davetler
        </button>
      </div>

      {tab === 'members' ? (
        <SectionCard title="Üyeler" description="Platform tarafında aktif çalışan kullanıcılar ve atanmış rolleri.">
          {users.length === 0 ? (
            <EmptyState title="Üye bulunamadı" description="Platform ekibinde listelenecek kullanıcı yok." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Ad Soyad</th>
                    <th className="px-3 py-2">E-posta</th>
                    <th className="px-3 py-2">Roller</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const roles = (user.platformRoles ?? []).map(getPlatformRoleName);
                    return (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="px-3 py-3 font-medium text-slate-900">{user.fullName ?? 'İsimsiz kullanıcı'}</td>
                        <td className="px-3 py-3 text-slate-600">{user.email ?? '-'}</td>
                        <td className="px-3 py-3 text-slate-600">{formatTextList(roles)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}

      {tab === 'invites' ? (
        <SectionCard title="Davetler" description="Yeni platform ekip üyeleri için oluşturulan davetler.">
          <form className="flex gap-2" onSubmit={invite}>
            <input className="rounded border p-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta adresi" />
            <input
              className="rounded border p-2"
              placeholder="Rol ID (opsiyonel)"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            />
            <button className="rounded bg-mono-500 px-4 text-white">Davet Oluştur</button>
          </form>
          {inviteLink ? <p className="text-sm text-slate-700">Son üretilen davet linki: {inviteLink}</p> : null}
          <div className="space-y-2">
            {invites.map((inviteRow) => (
              <article key={inviteRow.id} className="rounded border bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{inviteRow.email}</p>
                    <p className="text-xs text-slate-600">Son kullanım: {formatDate(inviteRow.expiresAt)}</p>
                  </div>
                  <StatusBadge
                    label={inviteRow.revokedAt ? 'İptal' : inviteRow.usedAt ? 'Kullanıldı' : 'Bekliyor'}
                    tone={inviteRow.revokedAt ? 'red' : inviteRow.usedAt ? 'green' : 'amber'}
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="rounded border px-2 py-1 text-sm" onClick={() => void resend(inviteRow.id)}>
                    Tekrar Gönder
                  </button>
                  <button className="rounded border px-2 py-1 text-sm" onClick={() => void revoke(inviteRow.id)}>
                    İptal Et
                  </button>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </section>
  );
}
