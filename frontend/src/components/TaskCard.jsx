import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import api from '../api/axios';

const STATUS_LABELS = {
  TODO: 'Todo',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

const STATUS_COLORS = {
  TODO: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  IN_REVIEW: 'bg-amber-50 text-amber-700',
  DONE: 'bg-green-50 text-green-700',
};

const PRIORITY_COLORS = {
  LOW: 'text-gray-400',
  MEDIUM: 'text-amber-500',
  HIGH: 'text-red-500',
};

const PRIORITY_DOTS = {
  LOW: '○',
  MEDIUM: '◉',
  HIGH: '●',
};

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

function getDaysOverdue(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

export default function TaskCard({ task, onUpdate, onDelete, onOpen, projectMembers = [] }) {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const touchPos = useRef({ x: 0, y: 0 });

  const isAssignee = task.assigneeId === user?.id;
  const canUpdateStatus = isAdmin || isAssignee;
  const daysOverdue = getDaysOverdue(task.dueDate);
  const isOverdue = daysOverdue !== null && task.status !== 'DONE';

  function handleDragStart(e) {
    if (!canUpdateStatus) return;
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('opacity-50');
  }

  function handleDragEnd(e) {
    e.currentTarget.classList.remove('opacity-50');
  }

  function handleTouchStart(e) {
    if (!canUpdateStatus) return;
    const t = e.touches[0];
    touchPos.current = { x: t.clientX, y: t.clientY };
    e.currentTarget.classList.add('opacity-50');
  }

  function handleTouchMove(e) {
    const t = e.touches[0];
    touchPos.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e) {
    e.currentTarget.classList.remove('opacity-50');
    const { x, y } = touchPos.current;
    if (!x || !y) return;
    const el = document.elementFromPoint(x, y);
    if (!el) return;
    const col = el.closest('[data-status]');
    const newStatus = col?.getAttribute('data-status');
    if (newStatus && newStatus !== task.status) {
      handleStatusChange(newStatus);
    }
  }

  async function handleStatusChange(newStatus) {
    if (!canUpdateStatus) return;
    setUpdating(true);
    try {
      const res = await api.put(`/api/tasks/${task.id}`, { status: newStatus });
      onUpdate && onUpdate(res.data.data);
      addToast('Status updated', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to update status', 'error');
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/api/tasks/${task.id}`);
      onDelete && onDelete(task.id);
      addToast('Task deleted', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete task', 'error');
    }
    setShowMenu(false);
  }

  return (
    <div
      draggable={canUpdateStatus}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => onOpen?.(task)}
      className={`relative bg-white rounded-lg border ${isOverdue ? 'border-red-200' : 'border-gray-200'} p-2 sm:p-3.5 shadow-sm hover:shadow-md transition-shadow group cursor-pointer hover:border-primary-200`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className={`text-xs shrink-0 ${PRIORITY_COLORS[task.priority]}`} title={task.priority}>
            {PRIORITY_DOTS[task.priority]}
          </span>
          <p className="text-[13px] font-semibold text-gray-900 leading-snug truncate">{task.title}</p>
        </div>
        {isAdmin && (
          <div className="relative shrink-0">
            <button
              onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 text-lg leading-none p-0.5 transition-opacity"
            >
              ···
            </button>
            {showMenu && (
              <div className="absolute right-0 top-5 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[110px]">
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(); }}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete task
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-[12px] text-gray-500 mb-2.5 line-clamp-2 leading-relaxed">{task.description}</p>
      )}

      {/* Overdue indicator */}
      {isOverdue && (
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
          <span className="text-[11px] font-medium text-red-600">{daysOverdue}d overdue</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-1.5">
          {task.assignee && (
            <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center" title={task.assignee.name}>
              <span className="text-white text-[9px] font-semibold">
                {task.assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
          )}
          {task.dueDate && !isOverdue && (
            <span className="text-[11px] text-gray-400">
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>

        {canUpdateStatus && (
          <select
            value={task.status}
            onClick={e => e.stopPropagation()}
            onChange={e => handleStatusChange(e.target.value)}
            disabled={updating}
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer focus:ring-1 focus:ring-primary-500 ${STATUS_COLORS[task.status]} disabled:opacity-60`}
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        )}
        {!canUpdateStatus && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
            {STATUS_LABELS[task.status]}
          </span>
        )}
      </div>
    </div>
  );
}
