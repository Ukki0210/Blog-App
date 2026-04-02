# 🌿 Lifestyle Blog — Setup Guide

A full-stack blog platform: React TypeScript frontend + .NET 8 C# backend + Supabase Auth + PostgreSQL + Llama chatbot.

---

## 📁 Project Structure

```
lifestyle-blog/
├── backend/
│   └── LifestyleBlog/          ← C# .NET 8 API
│       ├── Controllers/
│       ├── Services/
│       ├── Models/
│       ├── DTOs/
│       ├── Program.cs
│       └── appsettings.json    ← PUT YOUR KEYS HERE
└── frontend/
    ├── src/
    │   ├── pages/
    │   ├── components/
    │   ├── lib/
    │   └── types/
    ├── .env.local              ← PUT YOUR KEYS HERE
    └── package.json
```

---

## STEP 1 — Prerequisites

Install these if you haven't already:

| Tool | Install |
|------|---------|
| Node.js 18+ | https://nodejs.org |
| .NET 8 SDK | https://dotnet.microsoft.com/download/dotnet/8.0 |
| Ollama | https://ollama.com |

---

## STEP 2 — Create Your Supabase Project

1. Go to **https://supabase.com** → Sign up / Sign in
2. Click **"New project"**
3. Name it `lifestyle-blog`, set a strong password, choose a region
4. Wait for it to provision (~1 minute)

### Get your credentials:

**From Project Settings → API:**
- Copy `Project URL` → this is your `SUPABASE_URL`
- Copy `anon public` key → this is your `SUPABASE_ANON_KEY`

**From Project Settings → API → JWT Settings:**
- Copy `JWT Secret` → this is your `SUPABASE_JWT_SECRET`

**From Project Settings → Database → Connection string → URI:**
- It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres`
- Convert it to the format below for .NET:
  ```
  Host=db.xxxx.supabase.co;Database=postgres;Username=postgres;Password=YOUR_PASSWORD;SSL Mode=Require;Trust Server Certificate=true
  ```

### Enable Auth Providers (optional, for Google/GitHub login):

**For Google:**
1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Create OAuth credentials at https://console.cloud.google.com
3. Paste Client ID and Secret into Supabase

**For GitHub:**
1. Supabase Dashboard → Authentication → Providers → GitHub → Enable
2. Create OAuth App at https://github.com/settings/developers
3. Paste Client ID and Secret into Supabase

---

## STEP 3 — Configure Backend

Open `backend/LifestyleBlog/appsettings.json` and fill in:

```json
{
  "ConnectionStrings": {
    "Supabase": "Host=db.YOUR_PROJECT_ID.supabase.co;Database=postgres;Username=postgres;Password=YOUR_DB_PASSWORD;SSL Mode=Require;Trust Server Certificate=true"
  },
  "Supabase": {
    "Url": "https://YOUR_PROJECT_ID.supabase.co",
    "AnonKey": "YOUR_ANON_KEY",
    "JwtSecret": "YOUR_JWT_SECRET"
  },
  "Ollama": {
    "BaseUrl": "http://localhost:11434",
    "Model": "llama3.2"
  },
  "AllowedOrigins": [ "http://localhost:5173" ]
}
```

---

## STEP 4 — Configure Frontend

Open `frontend/.env.local` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
VITE_API_URL=http://localhost:5000
```

---

## STEP 5 — Install & Run Llama (for chatbot)

```bash
# Pull the llama3.2 model (~2GB)
ollama pull llama3.2

# Start Ollama (it runs in background automatically after install)
ollama serve
```

> **Note:** The chatbot requires Ollama running locally. If you skip this, everything else still works — just the chat widget will show an error message.

---

## STEP 6 — Run the Backend

Open a terminal and run:

```bash
cd lifestyle-blog/backend/LifestyleBlog

# Restore packages and run
dotnet run
```

You should see:
```
Building...
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5000
```

The backend automatically creates all database tables in Supabase on first run.

### Verify it's working:
Open http://localhost:5000/swagger — you'll see the Swagger API explorer.

---

## STEP 7 — Run the Frontend

Open a **second terminal** and run:

```bash
cd lifestyle-blog/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser. 🎉

---

## STEP 8 — First-Time Setup

### Create your admin account:
1. Go to http://localhost:5173/auth
2. Click "Sign up" and create an account with your email
3. Check your email and click the verification link

### Promote yourself to admin:
1. After signing in, open Supabase Dashboard → Table Editor → `profiles` table
2. Find your row
3. Change the `role` column from `reader` to `admin`
4. Save

Now you have full admin access — go to http://localhost:5173/admin

### Give write access to others:
From the Admin Dashboard → Users tab, you can assign roles:
- **reader** — can comment and like (default)
- **author** — can write and publish posts
- **editor** — can edit anyone's posts
- **admin** — full access including user management

---

## STEP 9 — Publish Your First Post

1. Click **Write** in the header (you need author/editor/admin role)
2. Add a title, cover image URL, and write your content
3. Select a category
4. Click **Publish** — done!

---

## 🛠 Common Issues

### "Network error" / API calls failing
- Make sure backend is running on port 5000
- Check `VITE_API_URL` in `.env.local` is correct
- Check CORS — `AllowedOrigins` in `appsettings.json` must include `http://localhost:5173`

### "JWT validation failed" 
- Double check your `JwtSecret` in `appsettings.json` matches Supabase's JWT secret exactly

### Database connection error
- Check the connection string format carefully
- Make sure `SSL Mode=Require;Trust Server Certificate=true` is included
- Verify your Supabase project password

### Chatbot not responding
- Make sure Ollama is running: `ollama serve`
- Make sure the model is downloaded: `ollama pull llama3.2`
- Check Ollama is on port 11434: `curl http://localhost:11434`

### "Port already in use" for backend
```bash
# Run backend on different port
dotnet run --urls="http://localhost:5001"
# Then update VITE_API_URL=http://localhost:5001 in .env.local
```

---

## 📋 API Endpoints Reference

```
GET    /api/posts                    — List published posts (with filters)
GET    /api/posts/:slug              — Get single post
GET    /api/posts/admin/all          — All posts (requires auth)
POST   /api/posts                    — Create post (requires auth)
PUT    /api/posts/:id                — Update post (requires auth)
DELETE /api/posts/:id                — Delete post (requires auth)
POST   /api/posts/:id/like           — Toggle like (requires auth)
GET    /api/posts/stats              — Dashboard stats

GET    /api/comments/:postId         — Get post comments
POST   /api/comments                 — Create comment (requires auth)
DELETE /api/comments/:id             — Delete comment (requires auth)
POST   /api/comments/:id/like        — Toggle comment like (requires auth)

GET    /api/users/me                 — Get my profile (requires auth)
PUT    /api/users/me                 — Update my profile (requires auth)
GET    /api/users/:id                — Get user profile
GET    /api/users/admin/all          — All users (admin only)
PUT    /api/users/:id/role           — Update user role (admin only)
POST   /api/users/newsletter         — Subscribe to newsletter

POST   /api/chat/stream              — Chat with Llama (streaming SSE)
```

---

## 🎨 Features Implemented

- ✅ Supabase Auth (email/password + Google + GitHub)
- ✅ Role-based access (admin / editor / author / reader)  
- ✅ Rich text editor (TipTap with formatting toolbar)
- ✅ Draft & publish system with auto-save
- ✅ Post categories and tags
- ✅ Featured posts
- ✅ Like system for posts and comments
- ✅ Nested comments with replies
- ✅ Llama AI chatbot (streaming responses)
- ✅ Newsletter subscription
- ✅ Dark / light mode
- ✅ Full-text search
- ✅ Related posts
- ✅ Admin dashboard with stats
- ✅ User management with role assignment
- ✅ Reading time calculation
- ✅ View counter
- ✅ Responsive design

---

## 🚀 Production Deployment

**Frontend** → Deploy to Vercel:
```bash
cd frontend
npm run build
# Deploy the dist/ folder to Vercel
```

**Backend** → Deploy to Railway / Azure / any .NET host:
```bash
cd backend/LifestyleBlog
dotnet publish -c Release
```

Update `VITE_API_URL` to your production backend URL.
Update `AllowedOrigins` in `appsettings.json` to your production frontend URL.
