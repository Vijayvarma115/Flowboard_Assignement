import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { emitProjectEvent } from '../lib/collaboration.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

const projectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  description: z.string().optional(),
  deadline: z.string().datetime({ offset: true }).optional().or(z.literal('')).transform(v => v || undefined),
});

const addMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
});

router.post('/', requireAdmin, validate(projectSchema), async (req, res) => {
  try {
    const { name, description, deadline } = req.body;
    const project = await prisma.project.create({
      data: {
        name,
        description,
        deadline: deadline ? new Date(deadline) : undefined,
        members: { create: { userId: req.user.id } },
      },
      include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    // Notify connected clients so lists stay in sync
    try {
      const io = req.app.get('io');
      if (io) io.emit('projects:changed', { action: 'created', project });
    } catch (e) {
      console.error('Failed to emit project created event', e?.message || e);
    }
    res.status(201).json({ data: project, message: 'Project created' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const where =
      req.user.role === 'ADMIN'
        ? { isDeleted: false }
        : { isDeleted: false, members: { some: { userId: req.user.id } } };

    const projects = await prisma.project.findMany({
      where,
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        tasks: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: projects, message: 'Projects fetched' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Discover all projects (members can see all and join ones they're not in)
router.get('/discover/all', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { isDeleted: false },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        tasks: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: projects, message: 'All projects fetched' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.put('/:id', requireAdmin, validate(projectSchema), async (req, res) => {
  try {
    const { name, description, deadline } = req.body;
    const project = await prisma.project.findFirst({ where: { id: req.params.id, isDeleted: false } });
    if (!project) return res.status(404).json({ error: 'Not found', details: 'Project not found' });

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: { name, description, deadline: deadline ? new Date(deadline) : null },
      include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    try {
      const io = req.app.get('io');
      if (io) io.emit('projects:changed', { action: 'updated', project: updated });
    } catch (e) {
      console.error('Failed to emit project updated event', e?.message || e);
    }
    res.json({ data: updated, message: 'Project updated' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, isDeleted: false } });
    if (!project) return res.status(404).json({ error: 'Not found', details: 'Project not found' });

    await prisma.project.update({ where: { id: req.params.id }, data: { isDeleted: true } });
    try {
      const io = req.app.get('io');
      if (io) io.emit('projects:changed', { action: 'deleted', projectId: req.params.id });
    } catch (e) {
      console.error('Failed to emit project deleted event', e?.message || e);
    }
    res.json({ data: null, message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.post('/:id/members', requireAdmin, validate(addMemberSchema), async (req, res) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, isDeleted: false } });
    if (!project) return res.status(404).json({ error: 'Not found', details: 'Project not found' });

    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) return res.status(404).json({ error: 'Not found', details: 'User not found' });

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: user.id } },
    });
    if (existing) return res.status(409).json({ error: 'Conflict', details: 'User already a member' });

    const member = await prisma.projectMember.create({
      data: { projectId: req.params.id, userId: user.id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    res.status(201).json({ data: member, message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.get('/:id/tasks', authenticate, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, isDeleted: false } });
    if (!project) return res.status(404).json({ error: 'Not found', details: 'Project not found' });

    if (req.user.role !== 'ADMIN') {
      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: req.params.id, userId: req.user.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Forbidden', details: 'Not a member of this project' });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId: req.params.id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: tasks, message: 'Tasks fetched' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

const taskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(120, 'Title must be at most 120 characters'),
  description: z.string().optional(),
  assignee_id: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  due_date: z.string().datetime({ offset: true }).optional().or(z.literal('')).transform(v => v || undefined),
});

router.post('/:id/tasks', requireAdmin, validate(taskSchema), async (req, res) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, isDeleted: false } });
    if (!project) return res.status(404).json({ error: 'Not found', details: 'Project not found' });

    const task = await prisma.task.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        dueDate: req.body.due_date ? new Date(req.body.due_date) : undefined,
        projectId: req.params.id,
        assigneeId: req.body.assignee_id || undefined,
        creatorId: req.user.id,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    const activity = await prisma.activity.create({
      data: {
        type: 'TASK_CREATED',
        description: `${req.user.name} created the task`,
        taskId: task.id,
        projectId: req.params.id,
        userId: req.user.id,
      },
    });

    emitProjectEvent(req.app, req.params.id, 'task:created', {
      task,
      projectId: req.params.id,
      activity,
    });
    res.status(201).json({ data: task, message: 'Task created' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Remove a member from a project (admin only)
router.delete('/:id/members/:userId', requireAdmin, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, isDeleted: false } });
    if (!project) return res.status(404).json({ error: 'Not found', details: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
    });
    if (!membership) return res.status(404).json({ error: 'Not found', details: 'Member not found on project' });

    await prisma.projectMember.delete({ where: { id: membership.id } });
    res.json({ data: null, message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Allow authenticated users to request to join a project
router.post('/:id/join', authenticate, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, isDeleted: false } });
    if (!project) return res.status(404).json({ error: 'Not found', details: 'Project not found' });

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.user.id } },
    });
    if (existing) return res.status(409).json({ error: 'Conflict', details: 'Already a member' });

    const existingRequest = await prisma.projectMemberRequest.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.user.id } },
    });
    if (existingRequest && existingRequest.status === 'PENDING') {
      return res.status(409).json({ error: 'Conflict', details: 'Request already pending' });
    }

    const request = await prisma.projectMemberRequest.create({
      data: { projectId: req.params.id, userId: req.user.id, status: 'PENDING' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json({ data: request, message: 'Join request sent' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get pending requests for a project (admin only)
router.get('/:id/requests', requireAdmin, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, isDeleted: false } });
    if (!project) return res.status(404).json({ error: 'Not found', details: 'Project not found' });

    const requests = await prisma.projectMemberRequest.findMany({
      where: { projectId: req.params.id, status: 'PENDING' },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: requests, message: 'Requests fetched' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Approve a join request (admin only)
router.post('/:id/requests/:userId/approve', requireAdmin, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, isDeleted: false } });
    if (!project) return res.status(404).json({ error: 'Not found', details: 'Project not found' });

    const request = await prisma.projectMemberRequest.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
    });
    if (!request) return res.status(404).json({ error: 'Not found', details: 'Request not found' });

    await prisma.projectMemberRequest.update({
      where: { id: request.id },
      data: { status: 'APPROVED' },
    });

    const member = await prisma.projectMember.create({
      data: { projectId: req.params.id, userId: req.params.userId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    res.json({ data: member, message: 'Request approved' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Reject a join request (admin only)
router.post('/:id/requests/:userId/reject', requireAdmin, async (req, res) => {
  try {
    const request = await prisma.projectMemberRequest.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
    });
    if (!request) return res.status(404).json({ error: 'Not found', details: 'Request not found' });

    await prisma.projectMemberRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED' },
    });
    res.json({ data: null, message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

export default router;
