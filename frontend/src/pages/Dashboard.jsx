import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const STATUS_CONFIG = {
  TODO: { label: 'To Do', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  IN_REVIEW: { label: 'In Review', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  DONE: { label: 'Done', color: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
};

function getDaysOverdue(dueDate) {
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((now - due) / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval;
    async function fetchDashboard() {
      try {
        const res = await api.get('/api/dashboard');
        setData(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
    interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const totalTasks = data
    ? Object.values(data.tasksByStatus).reduce((s, v) => s + v, 0)
    : 0;

  return (
    <div className="flex-1 p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Good morning, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-gray-500 mt-1">Here's what's happening across your projects.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Projects</p>
          <p className="text-3xl font-bold text-gray-900">{data?.totalProjects ?? 0}</p>
        </div>
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <div key={status} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`}></span>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{cfg.label}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{data?.tasksByStatus?.[status] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Task Progress Bar */}
      {totalTasks > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Overall Progress</h2>
            <span className="text-xs text-gray-500">
              {data?.tasksByStatus?.DONE ?? 0} / {totalTasks} tasks done
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
              const count = data?.tasksByStatus?.[status] ?? 0;
              const pct = totalTasks ? (count / totalTasks) * 100 : 0;
              return pct > 0 ? (
                <div
                  key={status}
                  style={{ width: `${pct}%` }}
                  className={`h-full ${cfg.dot} transition-all`}
                  title={`${cfg.label}: ${count}`}
                />
              ) : null;
            })}
          </div>
          <div className="flex gap-4 mt-3">
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`}></span>
                <span className="text-xs text-gray-500">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Tasks */}
      {data?.overdueTasks?.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-5 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <h2 className="text-sm font-semibold text-gray-900">Overdue Tasks</h2>
            <span className="ml-auto text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full">
              {data.overdueTasks.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {data.overdueTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.project && (
                      <Link
                        to={`/projects/${task.projectId}`}
                        className="text-xs text-primary-500 hover:underline"
                      >
                        {task.project.name}
                      </Link>
                    )}
                    {task.assignee && (
                      <span className="text-xs text-gray-400">· {task.assignee.name}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                  {getDaysOverdue(task.dueDate)}d overdue
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Tasks */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">My Tasks</h2>
          <span className="text-xs text-gray-400">{data?.myTasks?.length ?? 0} tasks</span>
        </div>
        {!data?.myTasks?.length ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">No tasks assigned to you yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.myTasks.map(task => {
              const cfg = STATUS_CONFIG[task.status];
              return (
                <div key={task.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}></span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{task.title}</p>
                      {task.project && (
                        <Link
                          to={`/projects/${task.projectId}`}
                          className="text-xs text-primary-500 hover:underline"
                        >
                          {task.project.name}
                        </Link>
                      )}
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
