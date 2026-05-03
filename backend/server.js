const express = require('express');
const mssql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// SQL Server configuration
const sqlConfig = {
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || 'YourPassword123!',
    }
  },
  server: process.env.DB_HOST || 'mssql',
  database: process.env.DB_NAME || 'LaundryFlowDB',
  port: parseInt(process.env.DB_PORT || '1433'),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableKeepAlive: true,
    connectionTimeout: 15000,
    requestTimeout: 15000
  }
};

let dbConnected = false;

// Initialize database connection
async function initializeDatabase() {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    dbConnected = true;
    console.log('✓ Connected to SQL Server');
    pool.close();
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    console.log('Retrying in 5 seconds...');
    setTimeout(initializeDatabase, 5000);
  }
}

// ===========================
// HEALTH CHECK
// ===========================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', database: dbConnected });
});

// ===========================
// ROOMS ENDPOINTS
// ===========================

// Get all rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    const result = await pool.request().query('SELECT * FROM Rooms');
    pool.close();
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get room by ID
app.get('/api/rooms/:id', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    const result = await pool.request()
      .input('id', mssql.Int, req.params.id)
      .query('SELECT * FROM Rooms WHERE Id = @id');
    pool.close();
    res.json(result.recordset[0] || { error: 'Room not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const { roomNumber } = req.body;
    if (!roomNumber) {
      return res.status(400).json({ error: 'Room number is required' });
    }
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    await pool.request()
      .input('roomNumber', mssql.VarChar, roomNumber)
      .query('INSERT INTO Rooms (RoomNumber) VALUES (@roomNumber)');
    pool.close();
    res.status(201).json({ message: 'Room created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// USERS ENDPOINTS
// ===========================

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    const result = await pool.request().query('SELECT * FROM Users');
    pool.close();
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    const result = await pool.request()
      .input('id', mssql.Int, req.params.id)
      .query('SELECT * FROM Users WHERE Id = @id');
    pool.close();
    res.json(result.recordset[0] || { error: 'User not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new user
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, phone, roomId } = req.body;
    if (!name || !email || !roomId) {
      return res.status(400).json({ error: 'Name, email, and roomId are required' });
    }
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    await pool.request()
      .input('name', mssql.VarChar, name)
      .input('email', mssql.VarChar, email)
      .input('phone', mssql.VarChar, phone || null)
      .input('roomId', mssql.Int, roomId)
      .query('INSERT INTO Users (Name, Email, Phone, RoomId) VALUES (@name, @email, @phone, @roomId)');
    pool.close();
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, email, phone, roomId } = req.body;
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    await pool.request()
      .input('id', mssql.Int, req.params.id)
      .input('name', mssql.VarChar, name)
      .input('email', mssql.VarChar, email)
      .input('phone', mssql.VarChar, phone || null)
      .input('roomId', mssql.Int, roomId)
      .query('UPDATE Users SET Name = @name, Email = @email, Phone = @phone, RoomId = @roomId WHERE Id = @id');
    pool.close();
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    await pool.request()
      .input('id', mssql.Int, req.params.id)
      .query('DELETE FROM Users WHERE Id = @id');
    pool.close();
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// MACHINES ENDPOINTS
// ===========================

// Get all machines
app.get('/api/machines', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    const result = await pool.request().query('SELECT * FROM Machines');
    pool.close();
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get machine by ID
app.get('/api/machines/:id', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    const result = await pool.request()
      .input('id', mssql.Int, req.params.id)
      .query('SELECT * FROM Machines WHERE Id = @id');
    pool.close();
    res.json(result.recordset[0] || { error: 'Machine not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new machine
app.post('/api/machines', async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    await pool.request()
      .input('name', mssql.VarChar, name)
      .input('type', mssql.VarChar, type)
      .query('INSERT INTO Machines (Name, Type) VALUES (@name, @type)');
    pool.close();
    res.status(201).json({ message: 'Machine created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// MACHINE SESSIONS ENDPOINTS
// ===========================

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    const result = await pool.request().query('SELECT * FROM MachineSessions');
    pool.close();
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sessions for a specific user
app.get('/api/sessions/user/:userId', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    const result = await pool.request()
      .input('userId', mssql.Int, req.params.userId)
      .query('SELECT * FROM MachineSessions WHERE UserId = @userId');
    pool.close();
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start a machine session
app.post('/api/sessions', async (req, res) => {
  try {
    const { machineId, userId } = req.body;
    if (!machineId || !userId) {
      return res.status(400).json({ error: 'Machine ID and User ID are required' });
    }
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    await pool.request()
      .input('machineId', mssql.Int, machineId)
      .input('userId', mssql.Int, userId)
      .query('INSERT INTO MachineSessions (MachineId, UserId, StartTime) VALUES (@machineId, @userId, GETDATE())');
    pool.close();
    res.status(201).json({ message: 'Session started successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// End a machine session
app.put('/api/sessions/:id', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    await pool.request()
      .input('id', mssql.Int, req.params.id)
      .query('UPDATE MachineSessions SET EndTime = GETDATE() WHERE Id = @id');
    pool.close();
    res.json({ message: 'Session ended successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// MACHINE ISSUES ENDPOINTS
// ===========================

// Get all issues
app.get('/api/issues', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    const result = await pool.request().query('SELECT * FROM MachineIssues');
    pool.close();
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get issues for a specific machine
app.get('/api/issues/machine/:machineId', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    const result = await pool.request()
      .input('machineId', mssql.Int, req.params.machineId)
      .query('SELECT * FROM MachineIssues WHERE MachineId = @machineId');
    pool.close();
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Report a machine issue
app.post('/api/issues', async (req, res) => {
  try {
    const { machineId, description } = req.body;
    if (!machineId) {
      return res.status(400).json({ error: 'Machine ID is required' });
    }
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    await pool.request()
      .input('machineId', mssql.Int, machineId)
      .input('description', mssql.VarChar, description || null)
      .query('INSERT INTO MachineIssues (MachineId, Description) VALUES (@machineId, @description)');
    pool.close();
    res.status(201).json({ message: 'Issue reported successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark issue as resolved
app.put('/api/issues/:id', async (req, res) => {
  try {
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    await pool.request()
      .input('id', mssql.Int, req.params.id)
      .query('UPDATE MachineIssues SET IsResolved = 1 WHERE Id = @id');
    pool.close();
    res.json({ message: 'Issue marked as resolved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// TEST ENDPOINT
// ===========================

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// ===========================
// START SERVER
// ===========================

const PORT = process.env.PORT || 3000;

initializeDatabase();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('\n=== Available Endpoints ===\n');
  console.log('HEALTH:');
  console.log('  GET  /health\n');
  console.log('ROOMS:');
  console.log('  GET    /api/rooms');
  console.log('  GET    /api/rooms/:id');
  console.log('  POST   /api/rooms\n');
  console.log('USERS:');
  console.log('  GET    /api/users');
  console.log('  GET    /api/users/:id');
  console.log('  POST   /api/users');
  console.log('  PUT    /api/users/:id');
  console.log('  DELETE /api/users/:id\n');
  console.log('MACHINES:');
  console.log('  GET    /api/machines');
  console.log('  GET    /api/machines/:id');
  console.log('  POST   /api/machines\n');
  console.log('SESSIONS:');
  console.log('  GET    /api/sessions');
  console.log('  GET    /api/sessions/user/:userId');
  console.log('  POST   /api/sessions');
  console.log('  PUT    /api/sessions/:id\n');
  console.log('ISSUES:');
  console.log('  GET    /api/issues');
  console.log('  GET    /api/issues/machine/:machineId');
  console.log('  POST   /api/issues');
  console.log('  PUT    /api/issues/:id\n');
});
