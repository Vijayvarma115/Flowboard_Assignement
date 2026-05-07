import { PrismaClient, Role, TaskStatus, Priority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123', 10);

  const realEmails = [
    '23315a0503@cse.sreenidhi.edu.in',
    'ramkrishnaaa5@gmail.com',
    'stephendakota43@gmail.com'
  ];

  // Delete in correct order due to foreign keys
  await prisma.comment.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  
  // Delete old demo users (keep only the 3 real ones)
  await prisma.user.deleteMany({
    where: {
      email: {
        notIn: realEmails
      }
    }
  });

  const adminUser = await prisma.user.upsert({
    where: { email: '23315a0503@cse.sreenidhi.edu.in' },
    update: {
      name: 'Admin',
      passwordHash,
      role: Role.ADMIN,
    },
    create: {
      name: 'Admin',
      email: '23315a0503@cse.sreenidhi.edu.in',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const member1 = await prisma.user.upsert({
    where: { email: 'ramkrishnaaa5@gmail.com' },
    update: {
      name: 'Ramakrishna',
      passwordHash,
      role: Role.MEMBER,
    },
    create: {
      name: 'Ramakrishna',
      email: 'ramkrishnaaa5@gmail.com',
      passwordHash,
      role: Role.MEMBER,
    },
  });

  const member2 = await prisma.user.upsert({
    where: { email: 'stephendakota43@gmail.com' },
    update: {
      name: 'Stephen Dakota',
      passwordHash,
      role: Role.MEMBER,
    },
    create: {
      name: 'Stephen Dakota',
      email: 'stephendakota43@gmail.com',
      passwordHash,
      role: Role.MEMBER,
    },
  });

  await prisma.projectMember.deleteMany({
    where: { userId: member2.id },
  });

  const project1 = await prisma.project.upsert({
    where: { id: 'seed-project-1' },
    update: {},
    create: {
      id: 'seed-project-1',
      name: 'Platform Redesign',
      description: 'Complete overhaul of the customer-facing dashboard and API layer.',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const project2 = await prisma.project.upsert({
    where: { id: 'seed-project-2' },
    update: {},
    create: {
      id: 'seed-project-2',
      name: 'Mobile App Launch',
      description: 'iOS and Android release for Q1. Includes onboarding, auth, and core features.',
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project1.id, userId: adminUser.id } },
    update: {},
    create: { projectId: project1.id, userId: adminUser.id },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project1.id, userId: member1.id } },
    update: {},
    create: { projectId: project1.id, userId: member1.id },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project2.id, userId: adminUser.id } },
    update: {},
    create: { projectId: project2.id, userId: adminUser.id },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project2.id, userId: member1.id } },
    update: {},
    create: { projectId: project2.id, userId: member1.id },
  });
  const tasksData = [
    {
      id: 'seed-task-1',
      title: 'Redesign navigation architecture',
      description: 'Audit current nav patterns, propose new IA, and implement updated sidebar.',
      status: TaskStatus.DONE,
      priority: Priority.HIGH,
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      projectId: project1.id,
      assigneeId: member1.id,
      creatorId: adminUser.id,
    },
    {
      id: 'seed-task-2',
      title: 'Implement design token system',
      description: 'Set up CSS variables and Tailwind config for consistent theming.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      projectId: project1.id,
      assigneeId: member1.id,
      creatorId: adminUser.id,
    },
    {
      id: 'seed-task-3',
      title: 'API rate limiting strategy',
      description: 'Design and implement rate limiting for all public endpoints.',
      status: TaskStatus.IN_REVIEW,
      priority: Priority.MEDIUM,
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      projectId: project1.id,
      assigneeId: adminUser.id,
      creatorId: adminUser.id,
    },
    {
      id: 'seed-task-4',
      title: 'Onboarding flow wireframes',
      description: 'Create high-fidelity wireframes for the 5-step user onboarding experience.',
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      projectId: project2.id,
      assigneeId: member1.id,
      creatorId: adminUser.id,
    },
    {
      id: 'seed-task-5',
      title: 'Push notification integration',
      description: 'Integrate Firebase Cloud Messaging for iOS and Android push alerts.',
      status: TaskStatus.TODO,
      priority: Priority.LOW,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      projectId: project2.id,
      assigneeId: member1.id,
      creatorId: adminUser.id,
    },
    {
      id: 'seed-task-6',
      title: 'App Store submission prep',
      description: 'Prepare screenshots, descriptions, and metadata for App Store and Play Store.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      projectId: project2.id,
      assigneeId: adminUser.id,
      creatorId: adminUser.id,
    },
  ];

  for (const task of tasksData) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: task,
    });
  }

  console.log('✅ Seed complete');
  console.log('   23315a0503@cse.sreenidhi.edu.in (ADMIN) — Password123');
  console.log('   ramkrishnaaa5@gmail.com              (MEMBER) — Password123');
  console.log('   stephendakota43@gmail.com            (MEMBER) — Password123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
