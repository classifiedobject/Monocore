'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type TaskCapabilities = {
  manageTemplate: boolean;
  manageTask: boolean;
  readTask: boolean;
  completeTask: boolean;
  readReports: boolean;
};

type TaskBoard = {
  id: string;
  name: string;
};

type TaskTemplate = {
  id: string;
  boardId: string | null;
  title: string;
  description: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  scheduleType: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  scheduleMeta: Record<string, unknown> | null;
  defaultAssigneeType: 'USER' | 'ROLE';
  defaultAssigneeUserId: string | null;
  defaultAssigneeRoleId: string | null;
  isActive: boolean;
  _count?: { taskInstances: number };
};

type Role = {
  id: string;
  name: string;
};

type Member = {
  id: string;
  userId: string;
  status: string;
  user: { id: string; fullName: string; email: string };
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
  assigneeUserId: string | null;
  assigneeRoleId: string | null;
  assigneeUser: { id: string; fullName: string } | null;
  assigneeRole: { id: string; name: string } | null;
  board: TaskBoard | null;
  template: TaskTemplate | null;
};

type TaskReport = {
  total: number;
  done: number;
  overdue: number;
  completionRate: number;
  byAssignee: Array<{ assignee: string; total: number; done: number; overdue: number }>;
};

type OverdueReport = {
  overdueTotal: number;
  byAssignee: Array<{ assignee: string; overdueCount: number }>;
};

type Tab = 'my' | 'team' | 'templates' | 'reports';

export default function TasksPage() {
  const [tab, setTab] = useState<Tab>('my');
  const [caps, setCaps] = useState<TaskCapabilities>({
    manageTemplate: false,
    manageTask: false,
    readTask: false,
    completeTask: false,
    readReports: false
  });

  const [boards, setBoards] = useState<TaskBoard[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const weekLater = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [taskFilterStatus, setTaskFilterStatus] = useState('');
  const [taskFilterAssigneeUserId, setTaskFilterAssigneeUserId] = useState('');
  const [taskFilterAssigneeRoleId, setTaskFilterAssigneeRoleId] = useState('');
  const [taskFilterOverdue, setTaskFilterOverdue] = useState(false);
  const [taskFilterFrom, setTaskFilterFrom] = useState(today);
  const [taskFilterTo, setTaskFilterTo] = useState(weekLater);

  const [newBoardName, setNewBoardName] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [newTaskDueDate, setNewTaskDueDate] = useState(today);
  const [newTaskBoardId, setNewTaskBoardId] = useState('');
  const [newTaskAssigneeType, setNewTaskAssigneeType] = useState<'USER' | 'ROLE'>('USER');
  const [newTaskAssigneeUserId, setNewTaskAssigneeUserId] = useState('');
  const [newTaskAssigneeRoleId, setNewTaskAssigneeRoleId] = useState('');

  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templatePriority, setTemplatePriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [templateBoardId, setTemplateBoardId] = useState('');
  const [templateScheduleType, setTemplateScheduleType] = useState<'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('DAILY');
  const [templateDaysOfWeek, setTemplateDaysOfWeek] = useState('1,2,3,4,5');
  const [templateDayOfMonth, setTemplateDayOfMonth] = useState('1');
  const [templateMonth, setTemplateMonth] = useState('1');
  const [templateAssigneeType, setTemplateAssigneeType] = useState<'USER' | 'ROLE'>('ROLE');
  const [templateAssigneeUserId, setTemplateAssigneeUserId] = useState('');
  const [templateAssigneeRoleId, setTemplateAssigneeRoleId] = useState('');

  const [generateFrom, setGenerateFrom] = useState(today);
  const [generateTo, setGenerateTo] = useState(weekLater);

  const [reportFrom, setReportFrom] = useState(today);
  const [reportTo, setReportTo] = useState(weekLater);
  const [summaryReport, setSummaryReport] = useState<TaskReport | null>(null);
  const [overdueReport, setOverdueReport] = useState<OverdueReport | null>(null);

  async function loadCapabilities() {
    const data = (await apiFetch('/app-api/tasks/capabilities')) as TaskCapabilities;
    setCaps(data);
  }

  async function loadMeta() {
    const [boardRows, templateRows, roleRows, teamRows] = await Promise.all([
      apiFetch('/app-api/tasks/boards') as Promise<TaskBoard[]>,
      apiFetch('/app-api/tasks/templates') as Promise<TaskTemplate[]>,
      apiFetch('/app-api/roles') as Promise<Role[]>,
      apiFetch('/app-api/team') as Promise<Member[]>
    ]);

    setBoards(boardRows);
    setTemplates(templateRows);
    setRoles(roleRows);
    setMembers(teamRows.filter((row) => row.status === 'active'));
  }

  async function loadTasks() {
    const query = new URLSearchParams();
    if (taskFilterFrom) query.set('from', taskFilterFrom);
    if (taskFilterTo) query.set('to', taskFilterTo);
    if (taskFilterStatus) query.set('status', taskFilterStatus);
    if (taskFilterAssigneeUserId) query.set('assigneeUserId', taskFilterAssigneeUserId);
    if (taskFilterAssigneeRoleId) query.set('assigneeRoleId', taskFilterAssigneeRoleId);
    if (taskFilterOverdue) query.set('overdue', 'true');

    const rows = (await apiFetch(`/app-api/tasks?${query.toString()}`)) as Task[];
    setTasks(rows);
  }

  async function loadReports() {
    const [summary, overdue] = await Promise.all([
      apiFetch(`/app-api/tasks/reports/summary?from=${reportFrom}&to=${reportTo}`) as Promise<TaskReport>,
      apiFetch('/app-api/tasks/reports/overdue-by-assignee') as Promise<OverdueReport>
    ]);

    setSummaryReport(summary);
    setOverdueReport(overdue);
  }

  async function loadAll() {
    await Promise.all([loadCapabilities(), loadMeta(), loadTasks()]);
  }

  useEffect(() => {
    loadAll().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/tasks/boards', {
      method: 'POST',
      body: JSON.stringify({ name: newBoardName })
    });
    setNewBoardName('');
    await loadMeta();
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        boardId: newTaskBoardId || null,
        title: newTaskTitle,
        description: newTaskDescription || null,
        priority: newTaskPriority,
        dueDate: newTaskDueDate,
        assigneeUserId: newTaskAssigneeType === 'USER' ? newTaskAssigneeUserId || null : null,
        assigneeRoleId: newTaskAssigneeType === 'ROLE' ? newTaskAssigneeRoleId || null : null
      })
    });
    setNewTaskTitle('');
    setNewTaskDescription('');
    await loadTasks();
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const scheduleMeta: Record<string, unknown> | null =
      templateScheduleType === 'WEEKLY'
        ? { daysOfWeek: templateDaysOfWeek.split(',').map((item) => Number(item.trim())).filter((item) => item >= 1 && item <= 7) }
        : templateScheduleType === 'MONTHLY'
        ? { dayOfMonth: Number(templateDayOfMonth) }
        : templateScheduleType === 'YEARLY'
        ? { month: Number(templateMonth), day: Number(templateDayOfMonth) }
        : null;

    await apiFetch('/app-api/tasks/templates', {
      method: 'POST',
      body: JSON.stringify({
        boardId: templateBoardId || null,
        title: templateTitle,
        description: templateDescription || null,
        priority: templatePriority,
        scheduleType: templateScheduleType,
        scheduleMeta,
        defaultAssigneeType: templateAssigneeType,
        defaultAssigneeUserId: templateAssigneeType === 'USER' ? templateAssigneeUserId || null : null,
        defaultAssigneeRoleId: templateAssigneeType === 'ROLE' ? templateAssigneeRoleId || null : null
      })
    });

    setTemplateTitle('');
    setTemplateDescription('');
    await loadMeta();
  }

  async function deactivateTemplate(id: string) {
    await apiFetch(`/app-api/tasks/templates/${id}`, { method: 'DELETE', body: JSON.stringify({}) });
    await loadMeta();
  }

  async function completeTask(id: string) {
    await apiFetch(`/app-api/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify({}) });
    await loadTasks();
  }

  async function reopenTask(id: string) {
    await apiFetch(`/app-api/tasks/${id}/reopen`, { method: 'POST', body: JSON.stringify({}) });
    await loadTasks();
  }

  async function runGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch(`/app-api/tasks/generate?from=${generateFrom}&to=${generateTo}`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await loadTasks();
  }

  const myTasks = useMemo(() => {
    return tasks.filter((row) => row.assigneeUserId && members.some((member) => member.userId === row.assigneeUserId));
  }, [members, tasks]);

  const groupedByDay = useMemo(() => {
    const source = tab === 'my' ? myTasks : tasks;
    const map = new Map<string, Task[]>();
    for (const task of source) {
      const key = task.dueDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [myTasks, tab, tasks]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Task &amp; Workforce Core</h1>
        <p className="text-sm text-slate-600">Templates, assignees and operational task tracking for your company.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          ['my', 'My Tasks'],
          ['team', 'Team Tasks'],
          ['templates', 'Templates'],
          ['reports', 'Reports']
        ].map(([key, label]) => (
          <button
            key={key}
            className={`rounded px-3 py-2 text-sm ${tab === key ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white'}`}
            onClick={() => setTab(key as Tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === 'my' || tab === 'team') && caps.readTask ? (
        <div className="space-y-4">
          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Filters</h2>
            <form className="grid gap-2 md:grid-cols-6" onSubmit={(event) => {
              event.preventDefault();
              loadTasks().catch(handleApiError);
            }}>
              <input className="rounded border p-2" type="date" value={taskFilterFrom} onChange={(event) => setTaskFilterFrom(event.target.value)} />
              <input className="rounded border p-2" type="date" value={taskFilterTo} onChange={(event) => setTaskFilterTo(event.target.value)} />
              <select className="rounded border p-2" value={taskFilterStatus} onChange={(event) => setTaskFilterStatus(event.target.value)}>
                <option value="">All status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
                <option value="CANCELED">Canceled</option>
              </select>
              <select className="rounded border p-2" value={taskFilterAssigneeUserId} onChange={(event) => setTaskFilterAssigneeUserId(event.target.value)}>
                <option value="">All users</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.fullName}
                  </option>
                ))}
              </select>
              <select className="rounded border p-2" value={taskFilterAssigneeRoleId} onChange={(event) => setTaskFilterAssigneeRoleId(event.target.value)}>
                <option value="">All roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Load</button>
            </form>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={taskFilterOverdue} onChange={(event) => setTaskFilterOverdue(event.target.checked)} />
              Overdue only
            </label>
          </article>

          {caps.manageTask ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Create One-off Task</h2>
              <form className="grid gap-2 md:grid-cols-3" onSubmit={(event) => createTask(event).catch(handleApiError)}>
                <input className="rounded border p-2" placeholder="Task title" value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} required />
                <input className="rounded border p-2" placeholder="Description (optional)" value={newTaskDescription} onChange={(event) => setNewTaskDescription(event.target.value)} />
                <input className="rounded border p-2" type="date" value={newTaskDueDate} onChange={(event) => setNewTaskDueDate(event.target.value)} required />
                <select className="rounded border p-2" value={newTaskPriority} onChange={(event) => setNewTaskPriority(event.target.value as Task['priority'])}>
                  <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
                </select>
                <select className="rounded border p-2" value={newTaskBoardId} onChange={(event) => setNewTaskBoardId(event.target.value)}>
                  <option value="">No board</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>{board.name}</option>
                  ))}
                </select>
                <select className="rounded border p-2" value={newTaskAssigneeType} onChange={(event) => setNewTaskAssigneeType(event.target.value as 'USER' | 'ROLE')}>
                  <option value="USER">Assign User</option>
                  <option value="ROLE">Assign Role</option>
                </select>
                {newTaskAssigneeType === 'USER' ? (
                  <select className="rounded border p-2" value={newTaskAssigneeUserId} onChange={(event) => setNewTaskAssigneeUserId(event.target.value)}>
                    <option value="">No user</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>{member.user.fullName}</option>
                    ))}
                  </select>
                ) : (
                  <select className="rounded border p-2" value={newTaskAssigneeRoleId} onChange={(event) => setNewTaskAssigneeRoleId(event.target.value)}>
                    <option value="">No role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                )}
                <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-3">Create Task</button>
              </form>
            </article>
          ) : null}

          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Tasks by Day</h2>
            <div className="space-y-3">
              {groupedByDay.map(([day, rows]) => (
                <div key={day} className="rounded border border-slate-200 p-3">
                  <h3 className="mb-2 text-sm font-semibold">{day}</h3>
                  <div className="space-y-2 text-sm">
                    {rows.map((task) => (
                      <div key={task.id} className="rounded border border-slate-100 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{task.title}</p>
                          <span className="text-xs">{task.priority} | {task.status}</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Assignee: {task.assigneeUser?.fullName ?? task.assigneeRole?.name ?? 'Unassigned'}
                          {task.board ? ` | Board: ${task.board.name}` : ''}
                          {task.template ? ' | Recurring' : ''}
                        </p>
                        <div className="mt-2 flex gap-2">
                          {caps.completeTask && task.status !== 'DONE' ? (
                            <button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => completeTask(task.id).catch(handleApiError)}>Complete</button>
                          ) : null}
                          {caps.completeTask && task.status === 'DONE' ? (
                            <button className="rounded bg-slate-700 px-2 py-1 text-xs text-white" onClick={() => reopenTask(task.id).catch(handleApiError)}>Reopen</button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {tab === 'templates' ? (
        <div className="space-y-4">
          {caps.manageTemplate ? (
            <>
              <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold">Task Board</h2>
                <form className="flex gap-2" onSubmit={(event) => createBoard(event).catch(handleApiError)}>
                  <input className="flex-1 rounded border p-2" value={newBoardName} onChange={(event) => setNewBoardName(event.target.value)} placeholder="Board name" required />
                  <button className="rounded bg-mono-500 px-3 py-2 text-white">Create Board</button>
                </form>
              </article>

              <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold">Create Template</h2>
                <form className="grid gap-2 md:grid-cols-4" onSubmit={(event) => createTemplate(event).catch(handleApiError)}>
                  <input className="rounded border p-2" placeholder="Template title" value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} required />
                  <input className="rounded border p-2" placeholder="Description" value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} />
                  <select className="rounded border p-2" value={templateBoardId} onChange={(event) => setTemplateBoardId(event.target.value)}>
                    <option value="">No board</option>
                    {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
                  </select>
                  <select className="rounded border p-2" value={templatePriority} onChange={(event) => setTemplatePriority(event.target.value as Task['priority'])}>
                    <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
                  </select>

                  <select className="rounded border p-2" value={templateScheduleType} onChange={(event) => setTemplateScheduleType(event.target.value as TaskTemplate['scheduleType'])}>
                    <option value="NONE">None</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>

                  {templateScheduleType === 'WEEKLY' ? (
                    <input className="rounded border p-2" placeholder="daysOfWeek: 1,2,3" value={templateDaysOfWeek} onChange={(event) => setTemplateDaysOfWeek(event.target.value)} />
                  ) : templateScheduleType === 'MONTHLY' || templateScheduleType === 'YEARLY' ? (
                    <input className="rounded border p-2" type="number" min={1} max={31} value={templateDayOfMonth} onChange={(event) => setTemplateDayOfMonth(event.target.value)} />
                  ) : (
                    <div className="rounded border border-dashed p-2 text-sm text-slate-500">No schedule meta needed</div>
                  )}

                  {templateScheduleType === 'YEARLY' ? (
                    <input className="rounded border p-2" type="number" min={1} max={12} value={templateMonth} onChange={(event) => setTemplateMonth(event.target.value)} />
                  ) : (
                    <div className="rounded border border-dashed p-2 text-sm text-slate-500">No month field</div>
                  )}

                  <select className="rounded border p-2" value={templateAssigneeType} onChange={(event) => setTemplateAssigneeType(event.target.value as 'USER' | 'ROLE')}>
                    <option value="ROLE">Default Role</option>
                    <option value="USER">Default User</option>
                  </select>

                  {templateAssigneeType === 'USER' ? (
                    <select className="rounded border p-2" value={templateAssigneeUserId} onChange={(event) => setTemplateAssigneeUserId(event.target.value)} required>
                      <option value="">Select user</option>
                      {members.map((member) => <option key={member.userId} value={member.userId}>{member.user.fullName}</option>)}
                    </select>
                  ) : (
                    <select className="rounded border p-2" value={templateAssigneeRoleId} onChange={(event) => setTemplateAssigneeRoleId(event.target.value)} required>
                      <option value="">Select role</option>
                      {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                  )}

                  <button className="rounded bg-mono-500 px-3 py-2 text-white md:col-span-4">Create Template</button>
                </form>
              </article>

              <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold">Generate Recurring Tasks</h2>
                <form className="grid gap-2 md:grid-cols-3" onSubmit={(event) => runGenerate(event).catch(handleApiError)}>
                  <input className="rounded border p-2" type="date" value={generateFrom} onChange={(event) => setGenerateFrom(event.target.value)} required />
                  <input className="rounded border p-2" type="date" value={generateTo} onChange={(event) => setGenerateTo(event.target.value)} required />
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Generate</button>
                </form>
              </article>
            </>
          ) : null}

          <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Templates</h2>
            <div className="space-y-2 text-sm">
              {templates.map((template) => (
                <div key={template.id} className="rounded border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{template.title}</p>
                    <span className="text-xs">{template.priority} | {template.scheduleType} | {template.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p className="text-xs text-slate-500">Generated tasks: {template._count?.taskInstances ?? 0}</p>
                  {caps.manageTemplate && template.isActive ? (
                    <button className="mt-2 rounded bg-slate-700 px-2 py-1 text-xs text-white" onClick={() => deactivateTemplate(template.id).catch(handleApiError)}>
                      Deactivate
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {tab === 'reports' ? (
        <div className="space-y-4">
          {caps.readReports ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Reporting Range</h2>
              <form className="grid gap-2 md:grid-cols-3" onSubmit={(event) => {
                event.preventDefault();
                loadReports().catch(handleApiError);
              }}>
                <input className="rounded border p-2" type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} required />
                <input className="rounded border p-2" type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} required />
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Load Reports</button>
              </form>
            </article>
          ) : null}

          {summaryReport ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">Completion Summary</h3>
              <p className="mb-2 text-sm">
                Total: {summaryReport.total} | Done: {summaryReport.done} | Overdue: {summaryReport.overdue} | Completion Rate:{' '}
                {summaryReport.completionRate.toFixed(2)}%
              </p>
              <div className="space-y-1 text-sm">
                {summaryReport.byAssignee.map((row) => (
                  <div key={row.assignee} className="rounded border border-slate-200 px-3 py-2">
                    {row.assignee}: total {row.total}, done {row.done}, overdue {row.overdue}
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {overdueReport ? (
            <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold">Overdue by Assignee</h3>
              <p className="mb-2 text-sm">Total overdue: {overdueReport.overdueTotal}</p>
              <div className="space-y-1 text-sm">
                {overdueReport.byAssignee.map((row) => (
                  <div key={row.assignee} className="rounded border border-slate-200 px-3 py-2">
                    {row.assignee}: {row.overdueCount}
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
