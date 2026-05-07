# FlowBoard — Team Task Manager

A production-ready collaborative project management tool with role-based access control, Kanban boards, and a real-time dashboard.

## Test Credentials (after seeding)

| Role   | Email                  | Password    |
|--------|------------------------|-------------|
| Admin  | 23315a0503@cse.sreenidhi.edu.in | Password123 |
| Member | ramkrishnaaa5@gmail.com         | Password123 |
| Member | stephendakota43@gmail.com       | Password123 |

---

## Local Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 14+ running locally (or use Docker)

### 1. Clone & install

```bash
git clone <your-repo>
cd flowboard
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET
npm install
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations (creates tables)
npm run db:seed          # Seed test data
npm run dev              # Start on port 3000
```

Backend `.env`:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/flowboard"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3000
FRONTEND_URL="http://localhost:5173"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-gmail@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="FlowBoard <your-gmail@gmail.com>"
SMTP_SECURE=false
```

### 3. Frontend setup

```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev              # Start on port 5173
```

Frontend `.env`:
```
VITE_API_URL=http://localhost:3000
```

### 4. Open the app

Visit [http://localhost:5173](http://localhost:5173) and sign in with the test credentials above.

---

## Using Docker for PostgreSQL (optional)

```bash
docker run --name flowboard-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=flowboard \
  -p 5432:5432 \
  -d postgres:16
```

---

## Railway Deployment

### Deploy Backend

1. Create a new Railway project
2. Add a **PostgreSQL** plugin
3. Deploy the `/backend` folder
4. Set environment variables:
   - `DATABASE_URL` → auto-set by Railway plugin
   - `JWT_SECRET` → any strong random string
   - `FRONTEND_URL` → your frontend Railway URL
5. Railway will run: `npx prisma migrate deploy && node server.js`

### Deploy Frontend

1. Add a second service in same Railway project
2. Deploy the `/frontend` folder
3. Set environment variables:
   - `VITE_API_URL` → your backend Railway URL
4. Railway will run: `npm run build` then `npx serve dist -p $PORT`

### Seed data on Railway

After first deploy, open the Railway backend shell and run:
```bash
npx tsx prisma/seed.ts
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |

### Projects (JWT required)
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/projects` | All users (own projects) |
| GET | `/api/projects/discover/all` | All users (browse all projects) |
| POST | `/api/projects` | Admin only |
| PUT | `/api/projects/:id` | Admin only |
| DELETE | `/api/projects/:id` | Admin only |
| POST | `/api/projects/:id/members` | Admin only (add by email) |
| DELETE | `/api/projects/:id/members/:userId` | Admin only (remove member) |
| POST | `/api/projects/:id/join` | Authenticated users (request to join) |
| GET | `/api/projects/:id/requests` | Admin only (list pending requests) |
| POST | `/api/projects/:id/requests/:userId/approve` | Admin only (approve request) |
| POST | `/api/projects/:id/requests/:userId/reject` | Admin only (reject request) |
| GET | `/api/projects/:id/tasks` | Project members |
| POST | `/api/projects/:id/tasks` | Admin only |

### Tasks (JWT required)
| Method | Endpoint | Access |
|--------|----------|--------|
| PUT | `/api/tasks/:id` | Admin (all fields); Member (status only, own tasks) |
| DELETE | `/api/tasks/:id` | Admin only |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Metrics, overdue tasks, my tasks |

### Health
| Method | Endpoint |
|--------|----------|
| GET | `/api/health` |

---

## Features

- **RBAC**: Admins have full CRUD; Members can only update status of their assigned tasks
- **Member Management**: Admins add members directly or approve/reject join requests
- **Join Requests**: Members browse and request to join projects; Admins approve with a floating panel
- **Kanban Board**: Drag-through-status-select across Todo → In Progress → In Review → Done
- **Progress Rings**: Circular SVG progress indicator on each project card
- **Overdue Detection**: Red flame indicator with days-overdue count on task cards
- **Role Badge**: Indigo pill for ADMIN, gray for MEMBER in sidebar
- **JWT Auth**: 7-day tokens, auto-redirect on expiry
- **Soft Delete**: Projects are archived, not hard-deleted
- **Dashboard Polling**: Auto-refreshes every 30 seconds
- **Project Discovery**: Members browse all projects and request to join via /discover

---

## Workflow: Join Requests

### For Members
1. Navigate to **Discover** tab
2. Browse all available projects
3. Click **Request** to request membership
4. Status changes to "Pending approval"
5. Wait for admin to approve (optional: check project directly if already added)

### For Admins
1. Admins see a **floating panel** in the bottom-right of project boards showing pending requests
2. Click ✓ to **approve** (user is added as project member)
3. Click ✕ to **reject** (request is declined)
