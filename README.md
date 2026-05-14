# CBT School Examination System — Backend

A production-ready Node.js/Express/MongoDB backend for the Computer Based Test platform.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# 3. Seed the admin account (run once)
node scripts/seed.admin.js

# 4. Start development server
npm run dev

# 5. Start production server
npm start
```

---

## 🔑 Default Admin Credentials
```
Email:    admin@school.com
Password: Admin@1234
```
> ⚠️ Change the password immediately after first login.

---

## 📁 Project Structure

```
cbt-backend/
├── server.js                  # Entry point
├── .env.example               # Environment variables template
├── models/
│   ├── User.model.js
│   ├── Class.model.js
│   ├── Subject.model.js
│   ├── Exam.model.js
│   ├── Question.model.js
│   ├── ExamAttempt.model.js
│   └── ViolationLog.model.js
├── controllers/
│   ├── auth.controller.js
│   ├── user.controller.js
│   ├── class.controller.js
│   ├── subject.controller.js
│   ├── exam.controller.js
│   ├── question.controller.js
│   ├── attempt.controller.js
│   ├── result.controller.js
│   └── analytics.controller.js
├── routes/
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── class.routes.js
│   ├── subject.routes.js
│   ├── exam.routes.js
│   ├── question.routes.js
│   ├── attempt.routes.js
│   ├── result.routes.js
│   └── analytics.routes.js
├── middleware/
│   ├── auth.middleware.js
│   └── upload.middleware.js
├── utils/
│   ├── jwt.utils.js
│   └── response.utils.js
└── scripts/
    └── seed.admin.js
```

---

## 📡 API Reference

All endpoints are prefixed with `/api`.
Protected routes require: `Authorization: Bearer <token>`

---

### 🔐 Auth  `/api/auth`

| Method | Endpoint            | Auth | Description              |
|--------|---------------------|------|--------------------------|
| POST   | /register           | No   | Student self-registration |
| POST   | /login              | No   | Login (all roles)         |
| GET    | /me                 | Yes  | Get current user          |
| PUT    | /change-password    | Yes  | Change own password       |

**Register body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "admissionNumber": "STU001"
}
```

**Login body:**
```json
{ "email": "john@example.com", "password": "password123" }
```

---

### 👥 Users  `/api/users`  _(Admin only unless noted)_

| Method | Endpoint                        | Description                  |
|--------|---------------------------------|------------------------------|
| GET    | /                               | List all users (with filters)|
| GET    | /:id                            | Get single user              |
| POST   | /teacher                        | Create teacher account       |
| PATCH  | /:id/approve                    | Approve/reject student       |
| PATCH  | /:id/toggle-status              | Suspend/activate user        |
| PATCH  | /:id/assign-class               | Assign student to class      |
| PATCH  | /:id/assign-subjects            | Assign subjects to teacher   |
| PUT    | /:id                            | Update user profile          |
| DELETE | /:id                            | Delete user                  |

**Query params for GET /:** `role`, `isApproved`, `search`, `page`, `limit`

---

### 🏫 Classes  `/api/classes`

| Method | Endpoint               | Auth    | Description            |
|--------|------------------------|---------|------------------------|
| GET    | /                      | All     | List all classes        |
| POST   | /                      | Admin   | Create class           |
| PUT    | /:id                   | Admin   | Update class           |
| DELETE | /:id                   | Admin   | Soft-delete class      |
| PATCH  | /:id/assign-teacher    | Admin   | Set class teacher       |

---

### 📚 Subjects  `/api/subjects`

| Method | Endpoint  | Auth  | Description      |
|--------|-----------|-------|------------------|
| GET    | /         | All   | List subjects    |
| POST   | /         | Admin | Create subject   |
| PUT    | /:id      | Admin | Update subject   |
| DELETE | /:id      | Admin | Delete subject   |

---

### 📝 Exams  `/api/exams`

| Method | Endpoint            | Auth             | Description              |
|--------|---------------------|------------------|--------------------------|
| GET    | /student            | Student          | Get available exams      |
| GET    | /                   | Teacher, Admin   | List all/own exams       |
| POST   | /                   | Teacher, Admin   | Create exam              |
| GET    | /:id                | All              | Get exam detail          |
| PUT    | /:id                | Teacher, Admin   | Update exam              |
| PATCH  | /:id/publish        | Teacher, Admin   | Toggle publish status    |
| DELETE | /:id                | Teacher, Admin   | Delete exam + questions  |

**Create exam body:**
```json
{
  "title": "Mathematics Term 1 Exam",
  "subject": "<subjectId>",
  "class": "<classId>",
  "duration": 60,
  "instructions": "Answer all questions",
  "startTime": "2024-03-15T08:00:00Z",
  "endTime": "2024-03-15T10:00:00Z",
  "randomizeQuestions": true,
  "showResultsImmediately": true,
  "allowRetake": false,
  "passMark": 50
}
```

---

### ❓ Questions  `/api/questions`

| Method | Endpoint                    | Auth           | Description         |
|--------|-----------------------------|----------------|---------------------|
| POST   | /exam/:examId               | Teacher, Admin | Add single question |
| POST   | /exam/:examId/bulk          | Teacher, Admin | Bulk add questions  |
| GET    | /exam/:examId               | Teacher, Admin | List questions      |
| PUT    | /:id                        | Teacher, Admin | Update question     |
| DELETE | /:id                        | Teacher, Admin | Delete question     |

**Single question body (multipart/form-data):**
```json
{
  "questionText": "What is 2 + 2?",
  "options": [
    { "label": "A", "text": "3" },
    { "label": "B", "text": "4" },
    { "label": "C", "text": "5" },
    { "label": "D", "text": "6" }
  ],
  "correctAnswer": "B",
  "marks": 2,
  "explanation": "Basic addition",
  "image": "<file upload optional>"
}
```

**Bulk questions body:**
```json
{
  "questions": [
    {
      "questionText": "...",
      "options": [...],
      "correctAnswer": "A",
      "marks": 1
    }
  ]
}
```

---

### 🖥️ Exam Attempts  `/api/attempts`

| Method | Endpoint                   | Auth    | Description               |
|--------|----------------------------|---------|---------------------------|
| POST   | /start/:examId             | Student | Start or resume exam      |
| PATCH  | /:attemptId/answer         | Student | Save a single answer      |
| POST   | /:attemptId/submit         | Student | Submit exam               |
| POST   | /violation                 | Student | Log anti-cheat violation  |
| GET    | /my                        | Student | Get own attempt history   |
| GET    | /:id                       | All     | Get attempt detail        |

**Save answer body:**
```json
{ "questionId": "<id>", "selected": "B" }
```

**Submit body:**
```json
{ "autoSubmit": false }
```

**Log violation body:**
```json
{
  "attemptId": "<id>",
  "type": "tab_switch",
  "details": "Switched to another tab at 14:32:01"
}
```

Violation types: `tab_switch` | `copy_attempt` | `fullscreen_exit` | `right_click` | `window_blur`

> ⚠️ After **3 violations** the exam is automatically submitted and graded.

---

### 📊 Results  `/api/results`

| Method | Endpoint                        | Auth           | Description           |
|--------|---------------------------------|----------------|-----------------------|
| GET    | /me                             | Student        | Own results           |
| GET    | /exam/:examId                   | Teacher, Admin | All results for exam  |
| GET    | /class/:classId                 | Teacher, Admin | Results for class     |
| GET    | /exam/:examId/violations        | Teacher, Admin | Violation logs        |
| GET    | /exam/:examId/rankings          | All            | Exam leaderboard      |

---

### 📈 Analytics  `/api/analytics`

| Method | Endpoint  | Auth    | Description                    |
|--------|-----------|---------|--------------------------------|
| GET    | /admin    | Admin   | Global platform stats          |
| GET    | /teacher  | Teacher | Stats for teacher's own exams  |
| GET    | /student  | Student | Student personal performance   |

---

## 🛡️ Security Features

- **JWT authentication** with 7-day expiry
- **Role-based access control** (student / teacher / admin)
- **Student approval gate** — students can't access exams until admin approves
- **Rate limiting** — 100 req/15min globally, 20 req/15min on auth routes
- **Helmet.js** HTTP security headers
- **mongo-sanitize** prevents NoSQL injection
- **bcrypt** password hashing (12 rounds)
- **Anti-cheat**: tab switch, copy disable, fullscreen exit detection + auto-submit on 3 violations
- **Input validation** via Mongoose schema validators

---

## ☁️ Deployment

### Render (Backend)
1. Connect GitHub repo
2. Build command: `npm install`
3. Start command: `node server.js`
4. Add environment variables from `.env`

### MongoDB Atlas
1. Create free M0 cluster
2. Whitelist `0.0.0.0/0` for Render
3. Copy connection string to `MONGO_URI`

---

## 🔄 Exam Flow

```
Student Login → Dashboard (available exams)
  → Start Exam  → Backend creates ExamAttempt
  → Questions load (randomized)
  → Timer begins (duration from DB)
  → Student answers → PATCH /attempts/:id/answer (auto-save)
  → Violations logged → POST /attempts/violation
  → Submit → POST /attempts/:id/submit
  → Backend grades automatically
  → Score/percentage/pass status returned
  → Results stored in ExamAttempt
```
