import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import TaskCard from '../components/TaskCard';
import TaskCollaborationDrawer from '../components/TaskCollaborationDrawer';
import api from '../api/axios';

const COLUMNS = [
  { status: 'TODO', label: 'To Do', dot: 'bg-gray-400' },
  { status: 'IN_PROGRESS', label: 'In Progress', dot: 'bg-blue-500' },
  { status: 'IN_REVIEW', label: 'In Review', dot: 'bg-amber-500' },
  { status: 'DONE', label: 'Done', dot: 'bg-green-500' },
];

function AddMemberModal({ projectId, onClose, onAdded }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) { setError('Email is required'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.post(`/api/projects/${projectId}/members`, { email });
      onAdded(res.data.data);
      addToast('Member added', 'success');
      onClose();
    } catch (err) {
      setError(err.response?.data?.details || err.response?.data?.error || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Add Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Member email</label>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="stephendakota43@gmail.com"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary-100 ${
                error ? 'border-red-400' : 'border-gray-300 focus:border-primary-500'
              }`}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div className="flex gap-3">
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
              className="flex-1 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-60"
            >
              {loading ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const { addToast } = useToast();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskComments, setTaskComments] = useState([]);
  const [taskActivity, setTaskActivity] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const socketRef = useRef(null);
  const selectedTaskRef = useRef(null);

  async function handleDrop(e, newStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      const res = await api.put(`/api/tasks/${taskId}`, { status: newStatus });
      const updated = res.data.data;
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      addToast('Task moved', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to move task', 'error');
    }
  }

  async function loadCollaboration(taskId) {
    try {
      const [commentsRes, activityRes] = await Promise.all([
        api.get(`/api/tasks/${taskId}/comments`),
        api.get(`/api/tasks/${taskId}/activity`),
      ]);
      setTaskComments(commentsRes.data.data);
      setTaskActivity(activityRes.data.data);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to load task discussion', 'error');
    }
  }

  function openTask(task) {
    setSelectedTask(task);
    setCommentDraft('');
    loadCollaboration(task.id);
  }

  function closeTaskDrawer() {
    setSelectedTask(null);
    setTaskComments([]);
    setTaskActivity([]);
    setCommentDraft('');
  }

  async function handleSubmitComment(e) {
    e.preventDefault();
    if (!selectedTask || !commentDraft.trim()) return;

    setCommentSubmitting(true);
    try {
      const res = await api.post(`/api/tasks/${selectedTask.id}/comments`, { content: commentDraft.trim() });
      const { comment, activity } = res.data.data;
      setTaskComments(prev => [...prev.filter(item => item.id !== comment.id), comment]);
      setTaskActivity(prev => [activity, ...prev.filter(item => item.id !== activity.id)]);
      setCommentDraft('');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to post comment', 'error');
    } finally {
      setCommentSubmitting(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    selectedTaskRef.current = selectedTask;
  }, [selectedTask]);

  useEffect(() => {
    const token = localStorage.getItem('flowboard_token');
    if (!token || !id) return undefined;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('project:join', { projectId: id });
    });

    socket.on('task:created', ({ task }) => {
      setTasks(prev => [task, ...prev.filter(item => item.id !== task.id)]);
    });

    socket.on('task:updated', ({ task }) => {
      setTasks(prev => prev.map(item => (item.id === task.id ? task : item)));
      setSelectedTask(prev => (prev?.id === task.id ? { ...prev, ...task } : prev));
    });

    socket.on('task:deleted', ({ taskId }) => {
      setTasks(prev => prev.filter(item => item.id !== taskId));
      setSelectedTask(prev => (prev?.id === taskId ? null : prev));
      setTaskComments(prev => (selectedTaskRef.current?.id === taskId ? [] : prev));
      setTaskActivity(prev => (selectedTaskRef.current?.id === taskId ? [] : prev));
    });

    socket.on('task:comment-created', ({ taskId, comment, activity }) => {
      if (selectedTaskRef.current?.id !== taskId) return;
      setTaskComments(prev => [...prev.filter(item => item.id !== comment.id), comment]);
      setTaskActivity(prev => [activity, ...prev.filter(item => item.id !== activity.id)]);
    });

    socket.on('task:activity-created', ({ taskId, activity }) => {
      if (selectedTaskRef.current?.id !== taskId) return;
      setTaskActivity(prev => [activity, ...prev.filter(item => item.id !== activity.id)]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id]);

  async function fetchData() {
    try {
      const [projRes, tasksRes, requestsRes] = await Promise.all([
        api.get(`/api/projects`),
        api.get(`/api/projects/${id}/tasks`),
        isAdmin ? api.get(`/api/projects/${id}/requests`) : Promise.resolve({ data: { data: [] } }),
      ]);
      const found = projRes.data.data.find(p => p.id === id);
      if (!found) { navigate('/projects'); return; }
      setProject(found);
      setTasks(tasksRes.data.data);
      if (isAdmin) setRequests(requestsRes.data.data);
    } catch (err) {
      addToast('Failed to load project', 'error');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }

  function handleTaskUpdate(updated) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  function handleTaskDelete(taskId) {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }

  function handleMemberAdded(member) {
    setProject(prev => ({
      ...prev,
      members: [...(prev.members || []), member],
    }));
  }

  async function handleRemoveMember(userId) {
    if (!window.confirm('Remove this member from the project?')) return;
    try {
      await api.delete(`/api/projects/${id}/members/${userId}`);
      setProject(prev => ({ ...prev, members: (prev.members || []).filter(m => m.user.id !== userId) }));
      addToast('Member removed', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to remove member', 'error');
    }
  }

  async function handleApproveRequest(userId, userName) {
    try {
      const res = await api.post(`/api/projects/${id}/requests/${userId}/approve`);
      setProject(prev => ({ ...prev, members: [...(prev.members || []), res.data.data] }));
      setRequests(prev => prev.filter(r => r.userId !== userId));
      addToast(`${userName} approved!`, 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to approve', 'error');
    }
  }

  async function handleRejectRequest(userId, userName) {
    if (!window.confirm(`Reject ${userName}'s request?`)) return;
    try {
      await api.post(`/api/projects/${id}/requests/${userId}/reject`);
      setRequests(prev => prev.filter(r => r.userId !== userId));
      addToast(`${userName}'s request rejected`, 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to reject', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-8 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <Link to="/projects" className="hover:text-primary-500 transition-colors">Projects</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{project?.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{project?.name}</h1>
            {project?.description && (
              <p className="text-sm text-gray-500 mt-0.5">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5">
              {project?.members?.slice(0, 5).map(m => (
                <div key={m.id} className="relative">
                  <div
                    className="w-7 h-7 rounded-full bg-primary-500 border-2 border-white flex items-center justify-center"
                    title={m.user.name}
                  >
                    <span className="text-white text-[10px] font-semibold">
                      {m.user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleRemoveMember(m.user.id)}
                      className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-white text-red-600 text-[10px] font-bold flex items-center justify-center border border-gray-200"
                      title="Remove member"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  + Add member
                </button>
                <Link
                  to={`/projects/${id}/new-task`}
                  className="text-xs px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
                >
                  + New task
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full flex-col sm:flex-row sm:min-w-max">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.status);
            return (
              <div
                key={col.status}
                data-status={col.status}
                className="w-full sm:w-72 shrink-0 flex flex-col bg-gray-50 rounded-xl border border-gray-200 overflow-hidden"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, col.status)}
              >
                {/* Column Header */}
                <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 bg-white">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`}></span>
                  <span className="text-[13px] font-semibold text-gray-700">{col.label}</span>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium">
                    {colTasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
                  {colTasks.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-xs text-gray-300 border border-dashed border-gray-200 rounded-lg">
                      No tasks
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onUpdate={handleTaskUpdate}
                        onDelete={handleTaskDelete}
                        onOpen={openTask}
                        projectMembers={project?.members}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Join Requests (Admin) */}
      {isAdmin && requests.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl border border-blue-200 shadow-lg p-4 max-w-sm z-40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Join Requests</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">{requests.length}</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {requests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                <div>
                  <p className="text-xs font-medium text-gray-900">{req.user.name}</p>
                  <p className="text-[11px] text-gray-500">{req.user.email}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleApproveRequest(req.user.id, req.user.name)}
                    className="text-xs px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => handleRejectRequest(req.user.id, req.user.name)}
                    className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded font-medium transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddMember && (
        <AddMemberModal
          projectId={id}
          onClose={() => setShowAddMember(false)}
          onAdded={handleMemberAdded}
        />
      )}

      {selectedTask && (
        <TaskCollaborationDrawer
          task={selectedTask}
          projectMembers={project?.members || []}
          comments={taskComments}
          activity={taskActivity}
          commentDraft={commentDraft}
          setCommentDraft={setCommentDraft}
          onClose={closeTaskDrawer}
          onSubmitComment={handleSubmitComment}
          isSubmitting={commentSubmitting}
        />
      )}
    </div>
  );
}
