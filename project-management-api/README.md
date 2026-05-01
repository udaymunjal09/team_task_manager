# Project Management API

A RESTful API for project management with role-based access control, task tracking, and team collaboration features.

## Features

- **Authentication**: Signup/Login with JWT tokens
- **Project Management**: Create, update, delete projects with team members
- **Task Management**: Create, assign, and track tasks with status updates
- **Role-Based Access Control**: Admin and Member roles at both system and project levels
- **Dashboard**: Overview of tasks, statuses, overdue items, and progress tracking

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: express-validator

## API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/signup` | Register new user | Public |
| POST | `/api/auth/login` | Login user | Public |
| GET | `/api/auth/me` | Get current user | Private |
| PUT | `/api/auth/updateprofile` | Update profile | Private |

### Projects
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/projects` | Create project | Private |
| GET | `/api/projects` | Get all user's projects | Private |
| GET | `/api/projects/:id` | Get single project | Project Member |
| PUT | `/api/projects/:id` | Update project | Project Admin |
| DELETE | `/api/projects/:id` | Delete project | Project Owner |
| POST | `/api/projects/:id/members` | Add member | Project Admin |
| PUT | `/api/projects/:id/members/:memberId` | Update member role | Project Admin |
| DELETE | `/api/projects/:id/members/:memberId` | Remove member | Project Admin |

### Tasks
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/tasks` | Create task | Project Member |
| GET | `/api/tasks` | Get all tasks | Private |
| GET | `/api/tasks/project/:projectId` | Get project tasks | Project Member |
| GET | `/api/tasks/:id` | Get single task | Project Member |
| PUT | `/api/tasks/:id` | Update task | Task Assignee/Creator/Admin |
| DELETE | `/api/tasks/:id` | Delete task | Task Creator/Project Admin |

### Dashboard
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/dashboard` | Get user dashboard | Private |
| GET | `/api/dashboard/project/:projectId` | Get project dashboard | Project Member |

## Data Models

### User
- name, email, password, role (admin/member)

### Project
- name, description, owner, members (with roles), status, dates

### Task
- title, description, project, assignedTo, createdBy, status, priority, dueDate

## Role-Based Access Control

### System Roles
- **Admin**: Can manage all resources
- **Member**: Standard user access

### Project Roles
- **Owner**: Full control over project, can delete
- **Admin**: Can manage project settings, members, and all tasks
- **Member**: Can view project, create tasks, update assigned tasks

## Environment Variables

```env
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/projectmanagement
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
```

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file with required variables
4. Start development server:
   ```bash
   npm run dev
   ```

## Deploy to Railway

1. Create a new project on [Railway](https://railway.app)
2. Add MongoDB plugin or connect to MongoDB Atlas
3. Set environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A secure random string
   - `JWT_EXPIRE`: Token expiration (e.g., "7d")
4. Deploy from GitHub or use Railway CLI

## API Usage Examples

### Register a new user
```bash
curl -X POST https://your-app.railway.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "password123"}'
```

### Login
```bash
curl -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "password123"}'
```

### Create a project
```bash
curl -X POST https://your-app.railway.app/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "My Project", "description": "A sample project"}'
```

### Create a task
```bash
curl -X POST https://your-app.railway.app/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "First Task", "project": "PROJECT_ID", "priority": "high"}'
```

### Get dashboard
```bash
curl https://your-app.railway.app/api/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## License

MIT
