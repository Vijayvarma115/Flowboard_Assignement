import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../api/axios';

export default function NewTask() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addToast } = useToast();
  const [members, setMembers] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignee_id: '',
    priority: 'MEDIUM',
    due_date: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isAdmin) { navigate(`/projects/${projectId}`); return; }
    async function fetchMembers() {
      try {
        const res = await api.get('/api/projects');
        const project = res.data.data.find(p => p.id === projectId);
        if (project) {
          setProjectName(project.name);
          setMembers(project.members?.map(m => m.user) || []);
        }
      } catch {
        addToast('Failed to load project members', 'error');
      }
    }
    fetchMembers();
  }, [projectId, isAdmin]);

  function validate() {
    const errs = {};
    if (!form.title || form.title.length < 3) errs.title = 'Title must be at least 3 characters';
    if (form.title.length > 120) errs.title = 'Title must be at most 120 characters';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        assignee_id: form.assignee_id || undefined,
        priority: form.priority,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
      };
      await api.post(`/api/projects/${projectId}/tasks`, payload);
      addToast('Task created', 'success');
      navigate(`/projects/${projectId}`);
    } catch (err) {
      const details = err.response?.data?.details;
      if (Array.isArray(details)) {
        const fieldErrs = {};
        details.forEach(d => { fieldErrs[d.field] = d.message; });
        setErrors(fieldErrs);
      } else {
        addToast(err.response?.data?.error || 'Failed to create task', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass = (field) =>
    `w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary-100 transition-colors ${
      errors[field] ? 'border-red-400' : 'border-gray-300 focus:border-primary-500'
    }`;

  return (
    <div className="flex-1 p-8 max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
        <Link to="/projects" className="hover:text-primary-500">Projects</Link>
        <span>/</span>
        <Link to={`/projects/${projectId}`} className="hover:text-primary-500">{projectName}</Link>
        <span>/</span>
        <span className="text-gray-700">New Task</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Task</h1>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
            <input
              autoFocus
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Implement design token system"
              className={inputClass('title')}
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe what needs to be done…"
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 resize-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assignee</label>
              <select
                value={form.assignee_id}
                onChange={e => setForm(p => ({ ...p, assignee_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              >
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              to={`/projects/${projectId}`}
              className="flex-1 text-center py-2.5 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
