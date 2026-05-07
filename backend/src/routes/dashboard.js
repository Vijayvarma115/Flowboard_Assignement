import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';
    const userId = req.user.id;
    const now = new Date();

    if (isAdmin) {
      const [projects, tasks] = await Promise.all([
        prisma.project.findMany({
          where: { isDeleted: false },
          include: { members: true, tasks: { select: { id: true, status: true } } },
        }),
        prisma.task.findMany({
          where: {},
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true } },
          },
        }),
      ]);

      const byStatus = {
        TODO: tasks.filter(t => t.status === 'TODO').length,
        IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        IN_REVIEW: tasks.filter(t => t.status === 'IN_REVIEW').length,
        DONE: tasks.filter(t => t.status === 'DONE').length,
      };

      const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE');
      const myTasks = tasks.filter(t => t.assigneeId === userId);

      return res.json({
        data: {
          totalProjects: projects.length,
          tasksByStatus: byStatus,
          overdueTasks: overdue,
          myTasks,
        },
        message: 'Dashboard data fetched',
      });
    }

    const memberProjects = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = memberProjects.map(p => p.projectId);

    const [projects, myTasks, allProjectTasks] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: projectIds }, isDeleted: false },
        include: { tasks: { select: { id: true, status: true } } },
      }),
      prisma.task.findMany({
        where: { assigneeId: userId },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.task.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true, status: true },
      }),
    ]);

    const byStatus = {
      TODO: allProjectTasks.filter(t => t.status === 'TODO').length,
      IN_PROGRESS: allProjectTasks.filter(t => t.status === 'IN_PROGRESS').length,
      IN_REVIEW: allProjectTasks.filter(t => t.status === 'IN_REVIEW').length,
      DONE: allProjectTasks.filter(t => t.status === 'DONE').length,
    };

    const overdue = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE');

    res.json({
      data: {
        totalProjects: projects.length,
        tasksByStatus: byStatus,
        overdueTasks: overdue,
        myTasks,
      },
      message: 'Dashboard data fetched',
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

export default router;
