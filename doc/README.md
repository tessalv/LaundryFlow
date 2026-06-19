# LaundryFlow

A real-time laundry machine management system built with Express.js, SQL Server, and a responsive frontend. Track machine availability, manage sessions, report issues, and monitor energy consumption across your laundry facility.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Frontend Features](#frontend-features)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)

---

## Overview

LaundryFlow is a comprehensive laundry machine management platform designed for residential and commercial laundry facilities. It provides real-time monitoring of machine status, session tracking, predictive cycle duration estimation, and detailed consumption analytics.

The system consists of:
- **Backend API**: Express.js server with SQL Server database
- **Frontend Dashboard**: Interactive React-style vanilla JavaScript interface
- **Prediction Engine**: ML-based cycle duration estimation (via `prediction.js`)
- **Analytics**: Usage statistics and power consumption tracking

---

## Features

### Machine Management
- **Real-time Status Tracking**: View machine availability (Available, In Use, Waiting for Collection, Maintenance)
- **Add/Delete Machines**: Create new machines with moderator code authentication
- **Machine Details**: Brand, reference, installation date, and cycle history
- **Issue Reporting**: Report and track maintenance issues per machine

### Session Management
- **Start Sessions**: Users fill a form with personal info and apartment/room details
- **Automated Duration Prediction**: Uses `prediction.js` to estimate cycle duration based on machine type
- **Live Progress Tracking**: Display countdown timer and progress bar during operation
- **Session History**: Complete record of all laundry sessions with timestamps

### Analytics & Statistics
- **Usage Statistics**: Hourly/weekly/monthly usage charts
- **Power Consumption**: Wattage tracking per time period
- **Apartment Consumption**: View which apartments consume most energy
- **Customizable Ranges**: 7-day, monthly, or yearly views

### Moderator Controls
- **4-Digit Code Protection**: Secure actions require moderator authentication
- **Machine Repair**: Mark machines as repaired to restore availability
- **Machine Deletion**: Remove machines and their associated data
- **Stop Override**: Force stop active sessions with moderator approval

### User Interface
- **Dashboard**: Quick summary of machine counts (Available, In Use, Maintenance, Total)
- **Machine Grid**: Visual cards showing real-time status and session info
- **Modal Forms**: Clean, accessible interfaces for all user actions
- **Toast Notifications**: Feedback for successful/failed actions
- **Responsive Design**: Works on desktop and mobile devices

---

## Architecture

### Database
- **Rooms**: Apartment/room definitions
- **Users**: Resident information and room assignments
- **Machines**: Laundry equipment with type (washer/dryer)
- **MachineSessions**: Session records with start/end times
- **MachineIssues**: Maintenance issue tracking

---

## Frontend Features

### Dashboard Overview
The main dashboard displays:
- **Stat Cards**: Quick counts of machine status
- **Machine Grid**: Visual cards for each machine with:
  - Status indicator and label
  - Brand, reference, installation date
  - Live session info (user, start time, countdown)
  - Action buttons (Start, Stop, Report Issue, etc.)

### Machine Status States

1. **Available**
   - No active session
   - No maintenance issues
   - Action: "Start Session"

2. **In Use**
   - Active session running
   - Shows countdown timer and progress bar
   - Action: "Stop"

3. **Waiting for Collection**
   - Cycle complete but not yet collected
   - Shows apartment and room number
   - Action: "Stuff Collected"

4. **Maintenance**
   - Reported issue (unresolved)
   - Action: "Machine Repaired"

### Forms & Modals

#### Start Session Form
- First Name, Last Name (required)
- Email (required, validated)
- Country Code + Phone Number (required, validated)
- Apartment Number (required)
- Room Number (required)
- **Automatic**: Cycle duration estimated via `prediction.js`

#### Report Issue Form
- Machine selection
- Issue description (text area)
- Attachment: Submit report

#### Stop Session Form
- Confirm apartment number
- Confirm room number
- Moderator override option

#### Add Machine Form
- Requires 4-digit moderator code first
- Machine Type (Washer/Dryer)
- Brand, Reference, Installation Date
- Auto-generates machine name

#### Repair Machine Form
- Requires 4-digit moderator code
- Marks machine as repaired

### Statistics Tab

Click "+ Statistics" button to view:

**Usage by Time Period**
- 7-day, Monthly, or Yearly view
- Hours used per time bucket
- Total, Peak, and Average metrics

**Power Consumption**
- Wattage charts matching time period
- Real-time consumption estimates per session

**Consumption by Apartment**
- Sorted list of apartments by watts used
- Quick identification of heavy users

### Session Tracking

The app tracks sessions in LocalStorage with:
- Start timestamp
- Predicted end timestamp
- Progress percentage
- User first name
- Apartment/room number

---

## Database Schema

### Rooms
```sql
Id (INT, PK)
RoomNumber (VARCHAR, UNIQUE)
```

### Users
```sql
Id (INT, PK)
Name (VARCHAR)
Email (VARCHAR, UNIQUE)
Phone (VARCHAR)
RoomId (INT, FK → Rooms)
```

### Machines
```sql
Id (INT, PK)
Name (VARCHAR)
Type (VARCHAR) -- 'washer' or 'dryer'
Brand (VARCHAR)
Reference (VARCHAR)
InstalledAt (DATETIME)
```

### MachineSessions
```sql
Id (INT, PK)
MachineId (INT, FK → Machines)
UserId (INT, FK → Users)
StartTime (DATETIME)
EndTime (DATETIME, nullable)
```

### MachineIssues
```sql
Id (INT, PK)
MachineId (INT, FK → Machines)
Description (VARCHAR)
CreatedAt (DATETIME)
ResolvedAt (DATETIME, nullable)
IsResolved (BIT)
```

---

## Project Structure

```
laundryflow-app/
├── backend/
│   ├── Dockerfile           # Node.js 18 Alpine image
│   ├── server.js            # Express API (all endpoints)
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── index.html           # Main HTML file (dashboard)
│   ├── app.js               # Main application logic
│   ├── style.css            # Responsive styling
│   ├── prediction.js        # Cycle duration ML estimation
│   └── wattage-functions.js # Power consumption calculations
├── db/
│   ├── init.sql             # Database initialization & seed data
│   └── entrypoint.sh        # Database startup script
├── docker-compose.yml       # Services orchestration
├── .env                     # Environment variables
├── .dockerignore
├── .gitignore
└── README.md                # This file
```

---

## Moderator Code

Default moderator code: `0000`

Required for:
- Adding new machines
- Deleting machines
- Repairing machines
- Force-stopping sessions

Change in `backend/server.js`:
```javascript
const MODERATOR_CODE = process.env.MODERATOR_CODE || '0000';
```

---

## Troubleshooting

### Services Won't Start
```bash
# Check logs
docker compose logs

# Verify SQL Server is healthy
docker compose ps

# Reset everything
docker compose down --volumes
docker compose up --build
```

### Machines Not Loading
- Check backend is running: `docker compose logs backend`
- Verify database connection: Look for "Connected to SQL Server" in logs
- Check API: `curl http://localhost:3000/api/machines`

### Form Validation Errors
- Ensure phone number format: `+33 2 97 26 58 41`
- Email must contain `@` and valid domain
- All required fields must be filled
- Check browser console (F12) for validation details

### Session Duration Not Showing
- Ensure `prediction.js` is loaded (check DevTools → Network)
- Check that machine type is set (washer/dryer)
- Verify no JavaScript errors in console

### Statistics Not Updating
- Clear browser cache: Ctrl+Shift+Delete
- Clear LocalStorage: DevTools → Application → Local Storage → Clear All
- Restart backend: `docker compose restart backend`
- Refresh page: F5

---

## Performance Notes

- Frontend refreshes dashboard every 10 seconds
- Session countdown updates every 1 second
- Each user action creates new database connection (no connection pooling overhead)
- LocalStorage persists session metadata for instant UI updates
- Prediction.js generates synthetic power profiles (~100ms per calculation)

---

## Security Considerations

- **Moderator Code**: Stored in environment variable (not hardcoded)
- **Database Access**: SQL Server credentials in `.env` (not in version control)
- **CORS**: Enabled (adjust if deploying to production)
- **Input Validation**: Email, phone, and date validation on frontend and backend
- **SQL Injection**: Parameterized queries via mssql driver

---

## Future Enhancements
- Real sensor integration for actual power consumption
- User authentication and login
- Email notifications for session completion
