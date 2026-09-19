# Task Management Application

A full-stack task management application with:
- JWT authentication and authorization
- User registration/login
- Task CRUD
- Search, filtering, priority and status
- Responsive React UI
- MongoDB persistence
- Optional Socket.IO real-time task events

## Requirements
- Node.js 18+
- MongoDB (local or MongoDB Atlas)

## 1. Backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

On macOS/Linux use `cp .env.example .env`.

Edit `.env`:
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL`

Backend runs at `http://localhost:5000`.

## 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

## API
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- GET `/api/tasks`
- POST `/api/tasks`
- PUT `/api/tasks/:id`
- DELETE `/api/tasks/:id`

All task routes require a valid Bearer JWT.

## Demo flow
1. Register an account.
2. Log in.
3. Add tasks.
4. Change status/priority.
5. Edit or delete tasks.
6. Refresh — tasks remain stored in MongoDB.

