const STATUS_LABELS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

const PRIORITY_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

function normalizeToken(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toDisplayDate(date) {
  if (!date) return 'no due date';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function emitProjectEvent(app, projectId, event, payload) {
  const io = app.get('io');
  if (!io) return;
  io.to(`project:${projectId}`).emit(event, payload);
}

export function extractMentionedUsers(content, projectMembers = []) {
  const mentionTokens = [...(content || '').matchAll(/@([a-zA-Z0-9._-]+)/g)].map(match => normalizeToken(match[1]));
  if (!mentionTokens.length) return [];

  const users = projectMembers
    .map(member => member.user)
    .filter(Boolean)
    .filter(user => {
      const variants = [
        user.name,
        user.email,
        user.email?.split('@')[0],
        user.name?.split(' ')[0],
        user.name?.split(' ').join(''),
      ]
        .filter(Boolean)
        .map(normalizeToken);
      return mentionTokens.some(token => variants.includes(token));
    });

  return users.filter((user, index, list) => list.findIndex(item => item.id === user.id) === index);
}

export function buildTaskUpdateActivities(beforeTask, updatedTask, actorName) {
  const activities = [];
  const beforeTitle = beforeTask.title;
  const afterTitle = updatedTask.title;

  if (beforeTitle !== afterTitle) {
    activities.push({
      type: 'TASK_UPDATED',
      description: `${actorName} renamed the task from “${beforeTitle}” to “${afterTitle}”`,
    });
  }

  if (beforeTask.description !== updatedTask.description) {
    activities.push({
      type: 'TASK_UPDATED',
      description: `${actorName} updated the task description`,
    });
  }

  if (beforeTask.status !== updatedTask.status) {
    activities.push({
      type: 'TASK_UPDATED',
      description: `${actorName} moved the task from ${STATUS_LABELS[beforeTask.status]} to ${STATUS_LABELS[updatedTask.status]}`,
    });
  }

  if (beforeTask.priority !== updatedTask.priority) {
    activities.push({
      type: 'TASK_UPDATED',
      description: `${actorName} changed priority from ${PRIORITY_LABELS[beforeTask.priority]} to ${PRIORITY_LABELS[updatedTask.priority]}`,
    });
  }

  if (beforeTask.assigneeId !== updatedTask.assigneeId) {
    const assignedTo = updatedTask.assignee?.name || 'unassigned';
    activities.push({
      type: 'TASK_UPDATED',
      description: `${actorName} assigned the task to ${assignedTo}`,
    });
  }

  const beforeDue = beforeTask.dueDate ? new Date(beforeTask.dueDate).toISOString() : null;
  const afterDue = updatedTask.dueDate ? new Date(updatedTask.dueDate).toISOString() : null;
  if (beforeDue !== afterDue) {
    activities.push({
      type: 'TASK_UPDATED',
      description: `${actorName} changed the due date to ${toDisplayDate(updatedTask.dueDate)}`,
    });
  }

  return activities;
}

export function buildCommentActivity(actorName, mentionUsers = []) {
  const mentionNames = mentionUsers.map(user => user.name).join(', ');
  return {
    type: mentionUsers.length ? 'COMMENT_MENTIONED' : 'TASK_COMMENTED',
    description: mentionUsers.length
      ? `${actorName} commented and mentioned ${mentionNames}`
      : `${actorName} added a comment`,
  };
}
