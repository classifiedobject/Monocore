'use client';

import { useEffect, useState } from 'react';
import { EmptyState, PageHeader, SectionCard, StatusBadge, formatTextList } from '../../../components/readable-ui';
import { apiFetch, handleApiError } from '../../../lib/api';

type PermissionRow = {
  id: string;
  key: string;
  description?: string | null;
};

type RoleRow = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  permissions?: Array<{ permission?: PermissionRow | null }>;
};

export default function PlatformRolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);

  useEffect(() => {
    apiFetch('/platform-api/roles').then(setRoles).catch(handleApiError);
    apiFetch('/platform-api/permissions').then(setPermissions).catch(handleApiError);
  }, []);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Platform Rolleri ve Yetkileri"
        description="Monocore iç ekibinin erişim yapısını ve platform seviyesindeki yetkileri burada görebilirsin."
      />

      <SectionCard title="Platform Rolleri" description="Her rolün sahip olduğu ana yetkiler.">
        {roles.length === 0 ? (
          <EmptyState title="Rol bulunamadı" description="Platform tarafında tanımlı rol yok." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Açıklama</th>
                  <th className="px-3 py-2">Yetki Sayısı</th>
                  <th className="px-3 py-2">Öne Çıkan Yetkiler</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const permissionKeys = (role.permissions ?? []).map((item) => item.permission?.key ?? null);
                  return (
                    <tr key={role.id} className="border-b last:border-0">
                      <td className="px-3 py-3">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{role.name}</p>
                          <p className="text-xs text-slate-500">{role.key}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{role.description ?? 'Açıklama yok'}</td>
                      <td className="px-3 py-3">
                        <StatusBadge label={String(permissionKeys.filter(Boolean).length)} tone="slate" />
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatTextList(permissionKeys.slice(0, 3))}
                        {permissionKeys.filter(Boolean).length > 3 ? ' +' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Platform Yetkileri" description="İç ekip için tanımlı tüm sistem yetkileri.">
        {permissions.length === 0 ? (
          <EmptyState title="Yetki bulunamadı" description="Platform tarafında tanımlı yetki yok." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {permissions.map((permission) => (
              <article key={permission.id} className="rounded border border-slate-200 p-3">
                <p className="font-medium text-slate-900">{permission.key}</p>
                <p className="mt-1 text-sm text-slate-600">{permission.description ?? 'Açıklama girilmemiş.'}</p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  );
}
