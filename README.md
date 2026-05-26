# LaundryFlow
Laundry room management system for student residences.  

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Development](#development)

---

## Overview

LaundryFlow provides a backend API to manage:
- **Rooms** — Student accommodation units
- **Users** — Residents linked to their rooms
- **Machines** — Washers and dryers
- **Sessions** — Machine usage tracking
- **Issues** — Maintenance incident reporting

The browser app that users should open is served from `frontend/`. The root Express route in `backend/server.js` points to that folder, so the frontend directory is the source of truth for the web experience.



## Tech Stack

| Layer            | Technology                |
|------------------|---------------------------|
| Runtime          | Node.js 18 LTS            |
| Framework        | Express.js 4.x            |
| Database         | Microsoft SQL Server 2022 |
| Containerization | Docker + Docker Compose   |

---

## Prerequisites

You only need two tools to run this project:

| Tool           | Purpose                    | Download |
|----------------|----------------------------|----------|
| Docker Desktop | Run the entire application | [docker.com](https://www.docker.com/products/docker-desktop) |
| Git            | Clone the repository       | [git-scm.com](https://git-scm.com/) |

**You do not need to install Node.js, SQL Server, or any dependencies manually.**  
Docker handles everything. The database schema is also created automatically on first startup — no manual SQL execution required.

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/laundryflow.git
cd laundryflow-app
```

### 2. Configure environment variables

The application requires a `.env` file inside the `backend/` directory.  
This file contains sensitive information such as database credentials and is **not committed to the repository** for security reasons.

A template is provided. Copy it and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and configure:

```dotenv
NODE_ENV=development
PORT=3000
DB_HOST=mssql
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourPassword123!
DB_NAME=LaundryFlowDB

# Optional: legacy SMS / SMTP notifications
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
NOTIFY_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

> The values above match the default Docker configuration and work out of the box.  
> If you change `DB_PASSWORD`, update it consistently in `docker-compose.yml` as well.

> SMS notifications are optional. If the SMTP/Twilio variables are empty, the app will finish cycles normally but will not send alerts.

### 3. Start the application

```bash
docker compose up --build
```

This single command will:
- Build the Node.js backend image
- Start the SQL Server 2022 instance
- Automatically create the database and all tables
- Insert a small set of sample data to get started
- Start the backend API and connect it to the database

Expected output:
```
mssql-1   | SQL Server is ready!
mssql-1   | Running database initialization script...
mssql-1   | Database initialization completed successfully!
backend-1 | Server running on http://localhost:3000
```

> SQL Server may take up to 60 seconds to initialize on first startup.  
> The backend waits for the database to be fully ready before starting.

### 4. Verify the application is running

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{ "status": "OK", "database": true }
```

The application is fully operational. No additional setup is required.

### 5. Open the public UI

Open this URL in your browser:

```text
http://localhost:3000/
```

If you deploy the backend to a public host, the same UI will be available at that host's URL because Express serves the static files from `frontend/`.

### Folder Roles

- `frontend/` is the canonical browser-facing app.
- `backend/public/` is legacy duplicate content and should no longer be used.
- If you change the UI, update `frontend/` first so the running app stays in sync with what users see.

---

## API Reference

Base URL: `http://localhost:3000`  
All request bodies and responses use JSON.

### Health

| Method | Endpoint  | Description         |
|--------|-----------|---------------------|
| GET    | `/health` | System health check |

---

### Rooms — `/api/rooms`

| Method | Endpoint         | Description    |
|--------|------------------|----------------|
| GET    | `/api/rooms`     | List all rooms |
| GET    | `/api/rooms/:id` | Get a room     |
| POST   | `/api/rooms`     | Create a room  |

**POST body:**
```json
{ "roomNumber": "102.1" }
```

---

### Users — `/api/users`

| Method | Endpoint          | Description    |
|--------|-------------------|----------------|
| GET    | `/api/users`      | List all users |
| GET    | `/api/users/:id`  | Get a user     |
| POST   | `/api/users`      | Create a user  |
| PUT    | `/api/users/:id`  | Update a user  |
| DELETE | `/api/users/:id`  | Delete a user  |

**POST body:**
```json
{
  "name": "John Doe",
  "email": "john@email.com",
  "phone": "+33123456789",
  "roomId": 1
}
```

---

### Machines — `/api/machines`

| Method | Endpoint            | Description       |
|--------|---------------------|-------------------|
| GET    | `/api/machines`     | List all machines |
| GET    | `/api/machines/:id` | Get a machine     |
| POST   | `/api/machines`     | Create a machine  |

**POST body:**
```json
{ "name": "Machine 3", "type": "washer" }
```

`type` accepts `"washer"` or `"dryer"`.

---

### Sessions — `/api/sessions`

| Method | Endpoint                     | Description             |
|--------|------------------------------|-------------------------|
| GET    | `/api/sessions`              | List all sessions       |
| GET    | `/api/sessions/user/:userId` | Get sessions for a user |
| POST   | `/api/sessions`              | Start a session         |
| PUT    | `/api/sessions/:id`          | End a session           |

**POST body:**
```json
{ "machineId": 1, "userId": 1 }
```

---

### Issues — `/api/issues`

| Method | Endpoint                         | Description              |
|--------|----------------------------------|--------------------------|
| GET    | `/api/issues`                    | List all issues          |
| GET    | `/api/issues/machine/:machineId` | Get issues for a machine |
| POST   | `/api/issues`                    | Report an issue          |
| PUT    | `/api/issues/:id`                | Mark as resolved         |

**POST body:**
```json
{ "machineId": 1, "description": "Machine not spinning" }
```

---

## Project Structure

```
laundryflow-app/
├── README.md
├── ARCHITECTURE.md          # Design decisions and schema documentation
├── docker-compose.yml       # Service orchestration
├── db/
│   ├── init.sql             # Creates the database schema on first startup
│   └── entrypoint.sh        # Waits for SQL Server to be ready, then runs init.sql
├── backend/
│   ├── server.js            # Express server and all API routes
│   ├── package.json
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env                 # Local credentials — not committed to Git
│   └── .env.example         # Template to copy for your own .env
└── frontend/                # Static frontend served by Express
    ├── index.html
    ├── app.js
    └── style.css
```

---

## Development

### Common commands

| Action                | Command                                    |
|-----------------------|--------------------------------------------|
| Start containers      | `docker compose up --build`                |
| Stop containers       | `docker compose down`                      |
| View logs             | `docker compose logs -f`                   |
| Restart after changes | `docker compose down && docker compose up` |

> Data is persisted in a Docker volume. Running `docker compose down` does not delete the database.  
> The initialization script uses `IF NOT EXISTS` checks — restarting the containers will never overwrite existing data.
