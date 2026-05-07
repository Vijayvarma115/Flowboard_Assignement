import { useState, useEffect } from 'react';
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

export default function Discover() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestStatus, setRequestStatus] = useState({}); // Track request status per project

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await api.get('/api/projects/discover/all');
      setProjects(res.data.data);
    } catch (err) {
      addToast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestJoin(projectId) {
    try {
      await api.post(`/api/projects/${projectId}/join`);
      setRequestStatus(prev => ({ ...prev, [projectId]: 'PENDING' }));
      addToast('Request sent! Waiting for admin approval.', 'success');
    } catch (err) {
      if (err.response?.status === 409) {
        addToast(err.response?.data?.details || 'Already a member or request pending', 'info');
      } else {
        addToast(err.response?.data?.details || 'Failed to send request', 'error');
      }
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Discover Projects</h1>
        <p className="text-sm text-gray-500 mt-1">Browse and join projects</p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-400 text-sm">No projects available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(project => {
            const tasks = project.tasks || [];
            const done = tasks.filter(t => t.status === 'DONE').length;
            const total = tasks.length;
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;
            const isMember = project.members?.some(m => m.user.id === user?.id);
            const isOverdue = project.deadline && new Date(project.deadline) < new Date();

            return (
              <div key={project.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
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
                    {isMember ? (
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-xs text-primary-500 font-medium hover:underline"
                      >
                        View board →
                      </Link>
                    ) : requestStatus[project.id] === 'PENDING' ? (
                      <span className="text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded font-medium">
                        Pending approval
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRequestJoin(project.id)}
                        className="text-xs px-2 py-1 bg-primary-500 hover:bg-primary-600 text-white rounded font-medium transition-colors"
                      >
                        Request
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
