# Railway Deployment Guide for FlowBoard

## Prerequisites
- Railway account: https://railway.app
- GitHub repository pushed (✅ Done)

---

## Deploy Backend

### 1. Create Railway Project
- Go to https://railway.app/dashboard
- Click **New Project**
- Select **Deploy from GitHub**
- Choose the `Flowboard_Assignement` repository
- Select `backend` folder
- Click **Deploy**

### 2. Add PostgreSQL Database
- In the Railway project dashboard, click **+ Add**
- Select **PostgreSQL**
- Railway will auto-create the database
- **Important:** Railway automatically sets `DATABASE_URL` environment variable

### 3. Set Backend Environment Variables
After PostgreSQL is added, go to the **backend service settings** and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Auto-set by PostgreSQL plugin | ✅ Already configured |
| `JWT_SECRET` | Generate a strong random string | e.g., `your-super-secret-key-here` |
| `PORT` | `3000` | Don't change |
| `FRONTEND_URL` | Your Railway frontend URL | Add AFTER deploying frontend |
| `SMTP_HOST` | `smtp.gmail.com` | Gmail SMTP server |
| `SMTP_PORT` | `587` | TLS port |
| `SMTP_USER` | your-email@gmail.com | Your Gmail address |
| `SMTP_PASS` | Your Gmail App Password | [See Gmail Setup Below](#gmail-app-password-setup) |
| `SMTP_FROM` | FlowBoard \<your-email@gmail.com\> | Sender name and email |
| `SMTP_SECURE` | `false` | Use TLS, not SSL |
| `NODE_ENV` | `production` | For production |

### 4. Deploy Backend
- Railway should auto-deploy
- Check the **Deployments** tab for status
- Once deployed, note the **Railway URL** (shown in service details)
  - Example: `https://flowboard-backend-prod.up.railway.app`

---

## Deploy Frontend

### 1. Add Frontend Service
- In the same Railway project, click **+ Add**
- Select **Deploy from GitHub** again
- Choose the **frontend** folder
- Click **Deploy**

### 2. Set Frontend Environment Variables
Go to the **frontend service settings** and add:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | Your backend Railway URL (e.g., `https://flowboard-backend-prod.up.railway.app`) |
| `NODE_ENV` | `production` |

### 3. Build & Deploy Frontend
- Railway will automatically run: `npm run build`
- Then serve: `npx serve dist -p $PORT`
- Once deployed, note the **frontend URL**
  - Example: `https://flowboard-frontend-prod.up.railway.app`

### 4. Update Backend with Frontend URL
- Go back to **backend service settings**
- Update `FRONTEND_URL` to your frontend Railway URL
- Re-deploy backend (Railway will auto-redeploy on env var change)

---

## Database Seeding on Railway

### Option 1: Seed via Railway Shell (Recommended)

1. In Railway dashboard, open the **backend service**
2. Click the **Terminal** tab (or SSH button)
3. Run:
   ```bash
   npx prisma migrate deploy
   npx tsx prisma/seed.ts
   ```
4. Watch for confirmation:
   ```
   ✅ Seed complete
      23315a0503@cse.sreenidhi.edu.in (ADMIN) — Password123
      ramkrishnaaa5@gmail.com              (MEMBER) — Password123
      stephendakota43@gmail.com            (MEMBER) — Password123
   ```

### Option 2: Auto-seed on Deploy
Backend `railway.json` already includes:
```json
"startCommand": "npx prisma migrate deploy && node server.js"
```
This runs migrations automatically on each deploy. To run seed as well, update `startCommand` to:
```json
"startCommand": "npx prisma migrate deploy && npx tsx prisma/seed.ts && node server.js"
```

---

## Gmail App Password Setup

For email notifications to work:

1. Enable 2-Factor Authentication on your Gmail account
2. Go to: https://myaccount.google.com/apppasswords
3. Select **Mail** and **Windows Computer** (or your device)
4. Google generates a 16-character password
5. Copy that password as `SMTP_PASS` in Railway env vars
6. Use your regular Gmail email as `SMTP_USER`

---

## Test After Deployment

### 1. Login
- Visit your frontend URL
- Sign in with test credentials:
  ```
  Email: 23315a0503@cse.sreenidhi.edu.in
  Password: Password123
  ```

### 2. Test Features
- ✅ Create a project
- ✅ Add members
- ✅ Create tasks
- ✅ Drag tasks between statuses (Kanban)
- ✅ Add comments with @mentions
- ✅ Check email for mention notifications

### 3. Check Logs
- Railway dashboard → **Logs** tab
- Look for:
  - `Server running on port 3000`
  - No database connection errors
  - No SMTP errors

---

## Environment Variables Summary

**Backend:**
```
DATABASE_URL=postgresql://user:pass@host:5432/db (auto-set)
JWT_SECRET=random-string-here
PORT=3000
FRONTEND_URL=https://your-frontend-url.railway.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=FlowBoard <your@gmail.com>
SMTP_SECURE=false
NODE_ENV=production
```

**Frontend:**
```
VITE_API_URL=https://your-backend-url.railway.app
NODE_ENV=production
```

---

## Troubleshooting

### Database Connection Error
- ✅ Check `DATABASE_URL` is set in Railway backend service
- ✅ PostgreSQL plugin is added to project

### Frontend Can't Connect to Backend
- ✅ Check `VITE_API_URL` points to correct backend Railway URL
- ✅ Frontend must rebuild after changing env vars

### Email Not Sending
- ✅ Check `SMTP_USER` and `SMTP_PASS` are correct
- ✅ Gmail 2FA is enabled
- ✅ App password is used (not regular password)
- ✅ Check Railway logs for SMTP errors

### Deploy Fails
- ✅ Check **Deployments** tab → **Logs** for error messages
- ✅ Ensure `package.json` exists in both folders
- ✅ Run `npx prisma generate` locally to ensure schema is valid

---

## Next Steps

1. Push `.env.example` files to GitHub
2. Create Railway project and link GitHub
3. Deploy backend → set env vars → deploy frontend
4. Seed database via Railway shell
5. Test with credentials above
6. Share frontend URL with team!

Good luck! 🚀
