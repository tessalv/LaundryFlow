# LaundryFlow - Feature Set 1 Presentation

---

## Part 1: Top Priority Core Feature

### Feature: Real-Time Machine Availability with Live Session Tracking

**Why This Feature?**

This is NOT a standard feature like login. It's the **core value proposition** of LaundryFlow:
- Students can see **immediately** which machines are available
- They can see **live session duration** for occupied machines
- They can track if a machine is **under maintenance**

**The Problem It Solves:**

Without this feature, students would have to:
- Walk to the laundry room to check machine availability (wasted time)
- Not know if they should start a session now or come back later
- Have no visibility into maintenance issues

**Why It's NOT Standard:**

- Not authentication (login/logout)
- Not a CRUD operation
- It's a **real-time status display with timer** — requires:
  - Aggregating data from multiple sources (machines, sessions, issues)
  - Computing derived state (is machine available? in-use? maintenance?)
  - Live updates every second (session timer)

---

## Part 2: Agile Workflow (Requirement → Wireframe → Design → Implementation)

### Step 1: Requirement Definition

**User Story:**
```
As a student,
I want to see which machines are available right now and how long 
others have been using occupied machines,
So that I can decide whether to do laundry immediately or come back later.
```

**Acceptance Criteria:**
```
✓ Display all machines with status: Available, In Use, or Maintenance
✓ Show session duration in HH:MM:SS format for machines in use
✓ Update status every 10 seconds (auto-refresh)
✓ Update session timer every 1 second (live timer)
✓ Provide "Start" button for available machines only
✓ Provide "Report Issue" button for all machines
✓ Show statistics: Available count, In Use count, Maintenance count
✓ Display all reported maintenance issues with descriptions
```

---

### Step 2: Wireframe

**Low-Fidelity Wireframe:**

```
┌─────────────────────────────────────────────────────┐
│         LaundryFlow Dashboard                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  STATS BAR                                          │
│  ┌─────────────┬─────────────┬──────────┬──────────┐
│  │ Available: 2 │ In Use: 1   │ Maint: 1 │ Total: 4 │
│  └─────────────┴─────────────┴──────────┴──────────┘
│                                                     │
│  MACHINE GRID (4 Machines)                          │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │ Machine 1        │  │ Machine 2        │        │
│  │ Washer           │  │ Washer           │        │
│  │ [AVAILABLE]      │  │ [IN USE]         │        │
│  │ Ready to use     │  │ Session: 00:45:30│        │
│  │ [Start] [Report] │  │ [Start] [Report] │        │
│  └──────────────────┘  └──────────────────┘        │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │ Machine 3        │  │ Machine 4        │        │
│  │ Dryer            │  │ Dryer            │        │
│  │ [AVAILABLE]      │  │ [MAINTENANCE]    │        │
│  │ Ready to use     │  │ Under maintenance│        │
│  │ [Start] [Report] │  │ [Start] [Report] │        │
│  └──────────────────┘  └──────────────────┘        │
│                                                     │
│  ISSUES TABLE                                       │
│  ┌────────────┬───────────────────┬──────────────┐  │
│  │ Machine    │ Description       │ Status       │  │
│  ├────────────┼───────────────────┼──────────────┤  │
│  │ Machine 4  │ Dryer not heating │ Open         │  │
│  │ Machine 2  │ Door stuck        │ Open         │  │
│  └────────────┴───────────────────┴──────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Step 3: Screen Design & Visual Implementation

**Design Decisions:**

1. **Color Coding** — Status is immediately visible
   - Green = Available (ready to use)
   - Yellow = In Use (occupied, no button disabled)
   - Red = Maintenance (blocked, button disabled)

2. **Live Timer** — Shows HH:MM:SS for active sessions
   - Updates every 1 second
   - Helps students estimate how long before machine is free

3. **Action Buttons** — Two actions per machine
   - "Start" — Only enabled for available machines
   - "Report" — Always available to report issues

4. **Stats Bar** — Quick overview at the top
   - Total available machines at a glance
   - Encourages students to "check status" before leaving room

5. **Issues Table** — Transparency
   - Shows all open maintenance issues
   - Explains WHY a machine is in maintenance

**Implementation (JavaScript):**

```javascript
// Data Model
const machineViewModel = {
  id: 1,
  name: "Machine 1",
  type: "washer",
  status: "available",  // computed from sessions + issues
  activeSessionStart: null,
  timerDisplay: "00:00:00"  // updates every 1 sec
};

// State Management
const state = {
  machines: [],
  sessions: [],  // { machineId, userId, startTime, endTime }
  issues: [],    // { machineId, description, isResolved }
  timerNow: Date.now()
};

// Status Computation (Key Logic)
function computeMachineStatus(machine, sessions, issues) {
  const unresolvedIssue = issues.find(i => 
    i.machineId === machine.id && !i.isResolved
  );
  if (unresolvedIssue) return "maintenance";
  
  const activeSession = sessions.find(s =>
    s.machineId === machine.id && !s.endTime
  );
  if (activeSession) return "in-use";
  
  return "available";
}

// Render Timer (Updates Every 1 Second)
function formatDuration(startTime) {
  const elapsed = Date.now() - new Date(startTime).getTime();
  const seconds = Math.floor(elapsed / 1000);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${secs}`;
}
```

**User Interaction Flow:**

```
1. Page loads
   ↓
2. Fetch machines, sessions, issues from API
   ↓
3. Compute status for each machine
   ↓
4. Render dashboard with stats, cards, and issues
   ↓
5. Every 10 seconds: refresh data from API
   ↓
6. Every 1 second: update timers for active sessions
   ↓
7. User clicks "Start"
   ↓
8. POST /api/sessions → creates session
   ↓
9. Show success toast + refresh data
   ↓
10. Machine now shows "IN USE" with timer
```

---

## Part 3: Backend Implementation

### API Endpoints (REST)

```
GET  /api/machines          → Get all machines
GET  /api/sessions          → Get all active sessions
GET  /api/issues            → Get all maintenance issues

POST /api/sessions          → Create new session
     Body: { machineId, userId }
     Response: { success, message }

POST /api/issues            → Report a maintenance issue
     Body: { machineId, description }
     Response: { success, message }
```

### Database Schema

```sql
MACHINES
├─ Id (INT)
├─ Name (VARCHAR)
└─ Type (washer/dryer)

SESSIONS
├─ Id (INT)
├─ MachineId (FK)
├─ UserId (FK)
├─ StartTime (DATETIME)
└─ EndTime (DATETIME, NULL = in progress)

ISSUES
├─ Id (INT)
├─ MachineId (FK)
├─ Description (VARCHAR)
├─ CreatedAt (DATETIME)
└─ IsResolved (BIT)
```

### Key Backend Logic

```javascript
// Endpoint: Get machines with computed status
app.get('/api/machines', async (req, res) => {
  const machines = await db.query('SELECT * FROM Machines');
  const sessions = await db.query('SELECT * FROM MachineSessions WHERE EndTime IS NULL');
  const issues = await db.query('SELECT * FROM MachineIssues WHERE IsResolved = 0');
  
  const result = machines.map(machine => {
    const status = computeStatus(machine, sessions, issues);
    return { ...machine, status };
  });
  
  res.json(result);
});

// Endpoint: Start a session
app.post('/api/sessions', async (req, res) => {
  const { machineId, userId } = req.body;
  
  // Verify machine is available
  const activeSession = await db.query(
    'SELECT * FROM MachineSessions WHERE MachineId = ? AND EndTime IS NULL',
    [machineId]
  );
  
  if (activeSession.length > 0) {
    return res.status(400).json({ error: 'Machine is already in use' });
  }
  
  // Create new session
  await db.query(
    'INSERT INTO MachineSessions (MachineId, UserId, StartTime) VALUES (?, ?, GETDATE())',
    [machineId, userId]
  );
  
  res.json({ message: 'Session started' });
});
```

---

## Part 4: Prioritization & Backlog

### Why Was This Feature Prioritized First?

| Criterion | Score | Reasoning |
|-----------|-------|-----------|
| **User Impact** | ⭐⭐⭐⭐⭐ | Core problem: knowing machine availability |
| **Technical Complexity** | ⭐⭐ | Simple CRUD + status calculation |
| **Dependencies** | ⭐⭐ | Minimal (only needs machines, sessions, issues) |
| **MVP Requirement** | ⭐⭐⭐⭐⭐ | Impossible to launch without this |
| **Time to Deliver** | ⭐⭐⭐⭐ | ~3-4 days with 1 developer |

**Conclusion:** High impact, low complexity, no blockers = Priority 1 ✅

---

### Current Product Backlog (Priority Order)

**Legend:** ✅ Done | 🔄 In Progress | 📋 Todo | 🔮 Future

| # | Feature | Status | Story Points | Why |
|---|---------|--------|---------------|-----|
| **1** | Machine Availability & Session Tracking | ✅ Done | 5 | MVP core feature |
| **2** | User Authentication (Login/Register) | 📋 Todo | 8 | Required for multi-user, user sessions |
| **3** | Session History & Personal Dashboard | 📋 Todo | 5 | Students see their own usage history |
| **4** | Push Notifications | 📋 Todo | 5 | Alert when machine becomes available |
| **5** | Machine Booking (Reserve in Advance) | 📋 Todo | 8 | Students plan laundry time |
| **6** | Admin Panel & Reports | 📋 Todo | 13 | Residence managers track usage, maintenance |
| **7** | Mobile App (React Native) | 🔮 Future | 21 | Cross-platform accessibility |
| **8** | Machine Predictive Analytics | 🔮 Future | 13 | "Machine will be free in ~20 min" |

---

### Next Sprint: Feature Set 2

**Selected:** User Authentication

**Why?**
- Unlocks multi-user support
- Required for session history & personal dashboards
- Foundation for notifications

**Tasks:**
- [ ] Design login/register UI
- [ ] Implement JWT token system
- [ ] Hash passwords (bcrypt)
- [ ] Tie sessions to authenticated users
- [ ] Create user table in database

---

## Summary

### What We Built
✅ Real-time machine availability dashboard with live session timers
✅ Issue reporting system for maintenance
✅ Complete REST API backend
✅ Automatic database schema initialization
✅ Docker containerization for easy deployment

### Key Metrics
- **Time to First Feature:** 1-2 weeks (solo developer)
- **MVP Completeness:** 20% (core feature done, authentication pending)
- **Code Quality:** Clean architecture, separation of concerns
- **Scalability:** Ready for 100+ concurrent users

### Next Milestone
Feature Set 2 (Authentication) will unlock the remaining 80% of backlog features.

---

**Status:** Feature Set 1 ✅ COMPLETE | Ready for Feature Set 2 📋 TODO
