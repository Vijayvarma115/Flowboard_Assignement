import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { buildCommentActivity, buildTaskUpdateActivities, emitProjectEvent, extractMentionedUsers } from '../lib/collaboration.js';
import { sendMentionEmail } from '../lib/mailer.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

async function getTaskWithProject(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } },
      project: {
        include: {
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
  });
}

const updateTaskSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  assignee_id: z.string().nullable().optional(),
  due_date: z.string().datetime({ offset: true }).optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
});

router.put('/:id', validate(updateTaskSchema), async (req, res) => {
  try {
    const task = await getTaskWithProject(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found', details: 'Task not found' });

    if (req.user.role === 'MEMBER') {
      if (task.assigneeId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden', details: 'You can only update tasks assigned to you' });
      }
      const allowedKeys = ['status'];
      const forbiddenKeys = Object.keys(req.body).filter(k => !allowedKeys.includes(k));
      if (forbiddenKeys.length > 0) {
        return res.status(403).json({ error: 'Forbidden', details: 'Members can only update the status field' });
      }
    }

    const updateData = {};
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.priority !== undefined) updateData.priority = req.body.priority;
    if (req.body.assignee_id !== undefined) updateData.assigneeId = req.body.assignee_id;
    if (req.body.due_date !== undefined) updateData.dueDate = req.body.due_date ? new Date(req.body.due_date) : null;

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        project: {
          include: {
            members: { include: { user: { select: { id: true, name: true, email: true } } } },
          },
        },
      },
    });

    const activities = buildTaskUpdateActivities(task, updated, req.user.name);
    const createdActivities = [];
    for (const activity of activities) {
      const created = await prisma.activity.create({
        data: {
          type: activity.type,
          description: activity.description,
          taskId: updated.id,
          projectId: updated.projectId,
          userId: req.user.id,
        },
      });
      createdActivities.push(created);
      emitProjectEvent(req.app, updated.projectId, 'task:activity-created', {
        taskId: updated.id,
        projectId: updated.projectId,
        activity: created,
      });
    }

    emitProjectEvent(req.app, updated.projectId, 'task:updated', {
      task: updated,
      activities: createdActivities,
    });

    res.json({ data: updated, message: 'Task updated' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.get('/:id/comments', async (req, res) => {
  try {
    const task = await getTaskWithProject(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found', details: 'Task not found' });

    if (req.user.role !== 'ADMIN') {
      const membership = task.project.members.some(member => member.userId === req.user.id);
      if (!membership) return res.status(403).json({ error: 'Forbidden', details: 'Not a member of this project' });
    }

    const comments = await prisma.comment.findMany({
      where: { taskId: req.params.id },
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ data: comments, message: 'Comments fetched' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000, 'Comment is too long'),
});

router.post('/:id/comments', validate(commentSchema), async (req, res) => {
  try {
    const task = await getTaskWithProject(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found', details: 'Task not found' });

    if (req.user.role !== 'ADMIN') {
      const membership = task.project.members.some(member => member.userId === req.user.id);
      if (!membership) return res.status(403).json({ error: 'Forbidden', details: 'Not a member of this project' });
    }

    const mentionUsers = extractMentionedUsers(req.body.content, task.project.members);
    const comment = await prisma.comment.create({
      data: {
        content: req.body.content,
        taskId: task.id,
        projectId: task.projectId,
        authorId: req.user.id,
        mentionUserIds: mentionUsers.map(user => user.id),
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    const notificationRecipients = mentionUsers.filter(user => user.id !== req.user.id);
    if (notificationRecipients.length > 0) {
      await prisma.notification.createMany({
        data: notificationRecipients.map(user => ({
          type: 'MENTION',
          title: `You were mentioned in ${task.title}`,
          message: `${req.user.name} mentioned you in a comment`,
          taskId: task.id,
          commentId: comment.id,
          userId: user.id,
          link: `/projects/${task.projectId}`,
        })),
      });

      const taskLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/projects/${task.projectId}`;
      await Promise.allSettled(
        notificationRecipients.map(user =>
          sendMentionEmail({
            recipientName: user.name,
            recipientEmail: user.email,
            actorName: req.user.name,
            taskTitle: task.title,
            taskLink,
            commentContent: req.body.content,
          }),
        ),
      );
    }

    const activityPayload = buildCommentActivity(req.user.name, mentionUsers);
    const activity = await prisma.activity.create({
      data: {
        type: activityPayload.type,
        description: activityPayload.description,
        taskId: task.id,
        projectId: task.projectId,
        userId: req.user.id,
      },
    });

    emitProjectEvent(req.app, task.projectId, 'task:comment-created', {
      taskId: task.id,
      projectId: task.projectId,
      comment,
      activity,
    });

    emitProjectEvent(req.app, task.projectId, 'task:activity-created', {
      taskId: task.id,
      projectId: task.projectId,
      activity,
    });

    res.status(201).json({ data: { comment, activity }, message: 'Comment added' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.get('/:id/activity', async (req, res) => {
  try {
    const task = await getTaskWithProject(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found', details: 'Task not found' });

    if (req.user.role !== 'ADMIN') {
      const membership = task.project.members.some(member => member.userId === req.user.id);
      if (!membership) return res.status(403).json({ error: 'Forbidden', details: 'Not a member of this project' });
    }

    const activity = await prisma.activity.findMany({
      where: { taskId: req.params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: activity, message: 'Activity fetched' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const task = await getTaskWithProject(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found', details: 'Task not found' });

    const activity = await prisma.activity.create({
      data: {
        type: 'TASK_DELETED',
        description: `${req.user.name} deleted the task`,
        taskId: task.id,
        projectId: task.projectId,
        userId: req.user.id,
      },
    });

    await prisma.task.delete({ where: { id: req.params.id } });
    emitProjectEvent(req.app, task.projectId, 'task:deleted', {
      taskId: task.id,
      projectId: task.projectId,
      activity,
    });
    res.json({ data: null, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

export default router;
