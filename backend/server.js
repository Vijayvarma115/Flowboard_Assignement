import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';

import authRoutes from './src/routes/auth.js';
import projectRoutes from './src/routes/projects.js';
import taskRoutes from './src/routes/tasks.js';
import dashboardRoutes from './src/routes/dashboard.js';
import notificationRoutes from './src/routes/notifications.js';

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

const frontendCfg = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function originAllowed(origin) {
  if (!origin) return true; // allow non-browser requests like server-to-server
  if (frontendCfg.includes(origin)) return true;
  // allow values set without protocol (e.g. example.up.railway.app)
  if (frontendCfg.some((u) => origin === `https://${u}` || origin === `http://${u}`)) return true;
  // allow any Railway deployed frontend (conservative)
  if (origin.endsWith('.up.railway.app')) return true;
  return false;
}

const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      const ok = originAllowed(origin);
      callback(null, ok);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
  if (!token) return next(new Error('Unauthorized'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', socket => {
  socket.on('project:join', async ({ projectId }) => {
    if (!projectId || !socket.user?.id) return;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        isDeleted: false,
        OR: [
          socket.user.role === 'ADMIN' ? { id: projectId } : null,
          { members: { some: { userId: socket.user.id } } },
        ].filter(Boolean),
      },
      select: { id: true },
    });

    if (!project) return;
    socket.join(`project:${projectId}`);
    socket.emit('project:joined', { projectId });
  });
});

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const ok = originAllowed(origin);
    if (!ok) {
      return callback(new Error('CORS not allowed for origin: ' + origin), false);
    }
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

server.listen(PORT, () => {
  console.log(`🚀 FlowBoard API running on port ${PORT}`);
});
