'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type Department = { id: string; name: string; parentId: string | null };
type Title = { id: string; name: string };
type TeamMember = { id: string; user: { id: string; email: string; fullName: string } };

type Profile = {
  userId: string;
  departmentId: string | null;
  titleId: string | null;
  managerUserId: string | null;
  user: { id: string; email: string; fullName: string };
};

export default function OrgChartPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [departmentName, setDepartmentName] = useState('Engineering');
  const [departmentParentId, setDepartmentParentId] = useState('');
  const [titleName, setTitleName] = useState('Senior Engineer');

  const [profileUserId, setProfileUserId] = useState('');
  const [profileDepartmentId, setProfileDepartmentId] = useState('');
  const [profileTitleId, setProfileTitleId] = useState('');
  const [profileManagerUserId, setProfileManagerUserId] = useState('');

  const load = async () => {
    const [deps, ts, teamRows, profileRows] = await Promise.all([
      apiFetch('/platform-api/org/departments'),
      apiFetch('/platform-api/org/titles'),
      apiFetch('/platform-api/team'),
      apiFetch('/platform-api/org/profiles')
    ]);
    setDepartments(deps);
    setTitles(ts);
    setTeam(teamRows);
    setProfiles(profileRows);
    if (!profileUserId && teamRows[0]?.user?.id) {
      setProfileUserId(teamRows[0].user.id);
    }
  };

  useEffect(() => {
    load().catch(handleApiError);
  }, []);

  async function addDepartment(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/platform-api/org/departments', {
      method: 'POST',
      body: JSON.stringify({ name: departmentName, parentId: departmentParentId || null })
    });
    await load();
  }

  async function addTitle(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/platform-api/org/titles', {
      method: 'POST',
      body: JSON.stringify({ name: titleName })
    });
    await load();
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    await apiFetch(`/platform-api/org/profiles/${profileUserId}`, {
      method: 'POST',
      body: JSON.stringify({
        departmentId: profileDepartmentId || null,
        titleId: profileTitleId || null,
        managerUserId: profileManagerUserId || null
      })
    });
    await load();
  }

  const tree = useMemo(() => {
    const children = new Map<string | null, Department[]>();
    for (const dep of departments) {
      const key = dep.parentId ?? null;
      const list = children.get(key) ?? [];
      list.push(dep);
      children.set(key, list);
    }

    const render = (parentId: string | null, depth = 0): React.ReactNode[] => {
      const list = children.get(parentId) ?? [];
      return list.flatMap((dep) => [
        <div key={dep.id} style={{ paddingLeft: `${depth * 20}px` }} className="py-1">
          {dep.name}
        </div>,
        ...render(dep.id, depth + 1)
      ]);
    };

    return render(null);
  }, [departments]);

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">Org Chart</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <form className="space-y-2 rounded border bg-white p-3" onSubmit={addDepartment}>
          <h2 className="text-lg font-semibold">Add Department</h2>
          <input className="w-full rounded border p-2" value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} />
          <select className="w-full rounded border p-2" value={departmentParentId} onChange={(e) => setDepartmentParentId(e.target.value)}>
            <option value="">No parent</option>
            {departments.map((dep) => (
              <option key={dep.id} value={dep.id}>{dep.name}</option>
            ))}
          </select>
          <button className="rounded bg-mono-500 px-3 py-2 text-white">Create Department</button>
        </form>

        <form className="space-y-2 rounded border bg-white p-3" onSubmit={addTitle}>
          <h2 className="text-lg font-semibold">Add Title</h2>
          <input className="w-full rounded border p-2" value={titleName} onChange={(e) => setTitleName(e.target.value)} />
          <button className="rounded bg-mono-500 px-3 py-2 text-white">Create Title</button>
        </form>
      </div>

      <form className="space-y-2 rounded border bg-white p-3" onSubmit={saveProfile}>
        <h2 className="text-lg font-semibold">Assign User Profile</h2>
        <select className="w-full rounded border p-2" value={profileUserId} onChange={(e) => setProfileUserId(e.target.value)}>
          {team.map((member) => (
            <option key={member.user.id} value={member.user.id}>{member.user.fullName} ({member.user.email})</option>
          ))}
        </select>
        <select className="w-full rounded border p-2" value={profileDepartmentId} onChange={(e) => setProfileDepartmentId(e.target.value)}>
          <option value="">No department</option>
          {departments.map((dep) => (
            <option key={dep.id} value={dep.id}>{dep.name}</option>
          ))}
        </select>
        <select className="w-full rounded border p-2" value={profileTitleId} onChange={(e) => setProfileTitleId(e.target.value)}>
          <option value="">No title</option>
          {titles.map((title) => (
            <option key={title.id} value={title.id}>{title.name}</option>
          ))}
        </select>
        <select className="w-full rounded border p-2" value={profileManagerUserId} onChange={(e) => setProfileManagerUserId(e.target.value)}>
          <option value="">No manager</option>
          {team.map((member) => (
            <option key={member.user.id} value={member.user.id}>{member.user.fullName}</option>
          ))}
        </select>
        <button className="rounded bg-mono-500 px-3 py-2 text-white">Save Profile</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded border bg-white p-3">
          <h2 className="mb-2 text-lg font-semibold">Department Tree</h2>
          {tree}
        </article>
        <article className="rounded border bg-white p-3">
          <h2 className="mb-2 text-lg font-semibold">Profiles</h2>
          <pre className="text-xs">{JSON.stringify(profiles, null, 2)}</pre>
        </article>
      </div>
    </section>
  );
}
