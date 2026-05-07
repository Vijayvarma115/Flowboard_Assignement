import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../api/axios';

function ProgressRing({ percent, size = 48, strokeWidth = 4 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#6366f1"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}

function CreateProjectModal({ onClose, onCreated }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({ name: '', description: '', deadline: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || form.name.length < 2) {
      setErrors({ name: 'Project name must be at least 2 characters' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
      };
      const res = await api.post('/api/projects', payload);
      onCreated(res.data.data);
      addToast('Project created', 'success');
      onClose();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to create project', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900 mb-4">New Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name *</label>
            <input
              autoFocus
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Platform Redesign"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary-100 ${
                errors.name ? 'border-red-400' : 'border-gray-300 focus:border-primary-500'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="What is this project about?"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Projects() {
  const { isAdmin } = useAuth();
  const { addToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('flowboard_token');
    if (!token) return undefined;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('projects:changed', payload => {
      if (!payload) return;
      const { action } = payload;
      if (action === 'created' && payload.project) {
        setProjects(prev => [payload.project, ...prev.filter(p => p.id !== payload.project.id)]);
      } else if (action === 'updated' && payload.project) {
        setProjects(prev => prev.map(p => (p.id === payload.project.id ? payload.project : p)));
      } else if (action === 'deleted' && payload.projectId) {
        setProjects(prev => prev.filter(p => p.id !== payload.projectId));
      }
    });

    return () => socket.disconnect();
  }, []);

  async function fetchProjects() {
    try {
      const res = await api.get('/api/projects');
      setProjects(res.data.data);
    } catch (err) {
      addToast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(projectId) {
    if (!window.confirm('Archive this project?')) return;
    try {
      await api.delete(`/api/projects/${projectId}`);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      addToast('Project archived', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to archive project', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-32" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span>+</span> New Project
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-400 text-sm mb-3">No projects yet.</p>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-primary-500 text-sm font-medium hover:underline"
            >
              Create your first project →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(project => {
            const tasks = project.tasks || [];
            const done = tasks.filter(t => t.status === 'DONE').length;
            const total = tasks.length;
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;
            const isOverdue = project.deadline && new Date(project.deadline) < new Date();

            return (
              <div key={project.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/projects/${project.id}`}
                      className="text-[15px] font-semibold text-gray-900 hover:text-primary-600 transition-colors block truncate"
                    >
                      {project.name}
                    </Link>
                    {project.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{project.description}</p>
                    )}
                  </div>
                  <div className="relative shrink-0">
                    <ProgressRing percent={percent} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-700">{percent}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                  <span>{project.members?.length ?? 0} member{project.members?.length !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{total} task{total !== 1 ? 's' : ''}</span>
                  {project.deadline && (
                    <>
                      <span>·</span>
                      <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                        Due {new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {project.members?.slice(0, 4).map(m => (
                      <div
                        key={m.id}
                        className="w-6 h-6 rounded-full bg-primary-500 border-2 border-white flex items-center justify-center"
                        title={m.user.name}
                      >
                        <span className="text-white text-[9px] font-semibold">
                          {m.user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                    ))}
                    {project.members?.length > 4 && (
                      <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                        <span className="text-gray-600 text-[9px] font-semibold">+{project.members.length - 4}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/projects/${project.id}`}
                      className="text-xs text-primary-500 font-medium hover:underline"
                    >
                      View board →
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={p => setProjects(prev => [p, ...prev])}
        />
      )}
    </div>
  );
}
