-- =========================================================
-- LaundryFlow Database Initialization Script
-- =========================================================
-- Purpose:
-- - Create the LaundryFlowDB database if it doesn't exist
-- - Create all required tables for the LaundryFlow application
-- =========================================================

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'LaundryFlowDB')
BEGIN
    CREATE DATABASE LaundryFlowDB;
    PRINT 'Database LaundryFlowDB created successfully';
END
ELSE
BEGIN
    PRINT 'Database LaundryFlowDB already exists';
END
GO

-- Switch to the LaundryFlowDB database
USE LaundryFlowDB;
GO

-- =========================================================
-- TABLE: Rooms
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Rooms')
BEGIN
    CREATE TABLE Rooms (
        Id INT PRIMARY KEY IDENTITY(1,1),
        RoomNumber NVARCHAR(50) NOT NULL UNIQUE
    );
    PRINT 'Table Rooms created successfully';
END
ELSE
BEGIN
    PRINT 'Table Rooms already exists';
END
GO

-- =========================================================
-- TABLE: Users
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(255) NOT NULL,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        Phone NVARCHAR(50) NULL,
        RoomId INT NOT NULL,
        FOREIGN KEY (RoomId) REFERENCES Rooms(Id)
    );
    PRINT 'Table Users created successfully';
END
ELSE
BEGIN
    PRINT 'Table Users already exists';
END
GO

-- =========================================================
-- TABLE: Machines
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Machines')
BEGIN
    CREATE TABLE Machines (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(255) NOT NULL,
        Type NVARCHAR(50) NOT NULL,
        Brand NVARCHAR(100) NOT NULL,
        Reference NVARCHAR(100) NOT NULL,
        InstalledAt DATETIME NOT NULL
    );
    PRINT 'Table Machines created successfully';
END
ELSE
BEGIN
    PRINT 'Table Machines already exists';
END
GO

-- =========================================================
-- TABLE: MachineSessions
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MachineSessions')
BEGIN
    CREATE TABLE MachineSessions (
        Id INT PRIMARY KEY IDENTITY(1,1),
        MachineId INT NOT NULL,
        UserId INT NOT NULL,
        StartTime DATETIME NOT NULL,
        EndTime DATETIME NULL,
        FOREIGN KEY (MachineId) REFERENCES Machines(Id),
        FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
    PRINT 'Table MachineSessions created successfully';
END
ELSE
BEGIN
    PRINT 'Table MachineSessions already exists';
END
GO

-- =========================================================
-- TABLE: MachineIssues
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MachineIssues')
BEGIN
    CREATE TABLE MachineIssues (
        Id INT PRIMARY KEY IDENTITY(1,1),
        MachineId INT NOT NULL,
        Description NVARCHAR(MAX) NULL,
        IsResolved BIT DEFAULT 0,
        ReportedAt DATETIME DEFAULT GETDATE(),
        ResolvedAt DATETIME NULL,
        FOREIGN KEY (MachineId) REFERENCES Machines(Id)
    );
    PRINT 'Table MachineIssues created successfully';
END
ELSE
BEGIN
    PRINT 'Table MachineIssues already exists';
END
GO

-- =========================================================
-- DEMO DATA
-- ---------------------------------------------------------
-- This block seeds realistic data for local development and
-- demo presentations. It is safe to re-run because each
-- insert checks whether the row already exists first.
-- =========================================================

-- Demo rooms
IF NOT EXISTS (SELECT 1 FROM Rooms WHERE RoomNumber = 'A-101')
BEGIN
    INSERT INTO Rooms (RoomNumber) VALUES ('A-101');
END

IF NOT EXISTS (SELECT 1 FROM Rooms WHERE RoomNumber = 'A-102')
BEGIN
    INSERT INTO Rooms (RoomNumber) VALUES ('A-102');
END

IF NOT EXISTS (SELECT 1 FROM Rooms WHERE RoomNumber = 'B-203')
BEGIN
    INSERT INTO Rooms (RoomNumber) VALUES ('B-203');
END
GO

-- Demo users
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'emma.dupont@laundryflow.demo')
BEGIN
    INSERT INTO Users (Name, Email, Phone, RoomId)
    SELECT 'Emma Dupont', 'emma.dupont@laundryflow.demo', '+33 6 12 34 56 78', Id
    FROM Rooms
    WHERE RoomNumber = 'A-101';
END

IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'lucas.martin@laundryflow.demo')
BEGIN
    INSERT INTO Users (Name, Email, Phone, RoomId)
    SELECT 'Lucas Martin', 'lucas.martin@laundryflow.demo', '+33 6 87 65 43 21', Id
    FROM Rooms
    WHERE RoomNumber = 'A-102';
END

IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'sara.lefebvre@laundryflow.demo')
BEGIN
    INSERT INTO Users (Name, Email, Phone, RoomId)
    SELECT 'Sara Lefebvre', 'sara.lefebvre@laundryflow.demo', '+33 6 11 22 33 44', Id
    FROM Rooms
    WHERE RoomNumber = 'B-203';
END
GO

-- Demo machines (washer + dryer)
IF NOT EXISTS (SELECT 1 FROM Machines WHERE Reference = 'WH-A101-01')
BEGIN
    INSERT INTO Machines (Name, Type, Brand, Reference, InstalledAt)
    VALUES ('Washer A101-01', 'washer', 'Electrolux Professional', 'WH-A101-01', '2024-02-15T09:00:00');
END

IF NOT EXISTS (SELECT 1 FROM Machines WHERE Reference = 'DR-A101-01')
BEGIN
    INSERT INTO Machines (Name, Type, Brand, Reference, InstalledAt)
    VALUES ('Dryer A101-01', 'dryer', 'Miele Professional', 'DR-A101-01', '2024-02-15T09:30:00');
END

IF NOT EXISTS (SELECT 1 FROM Machines WHERE Reference = 'WH-B203-01')
BEGIN
    INSERT INTO Machines (Name, Type, Brand, Reference, InstalledAt)
    VALUES ('Washer B203-01', 'washer', 'LG Commercial', 'WH-B203-01', '2024-03-10T10:00:00');
END

IF NOT EXISTS (SELECT 1 FROM Machines WHERE Reference = 'DR-B203-01')
BEGIN
    INSERT INTO Machines (Name, Type, Brand, Reference, InstalledAt)
    VALUES ('Dryer B203-01', 'dryer', 'Samsung Commercial', 'DR-B203-01', '2024-03-10T10:30:00');
END

IF NOT EXISTS (SELECT 1 FROM Machines WHERE Reference = 'WH-MAINT-01')
BEGIN
    INSERT INTO Machines (Name, Type, Brand, Reference, InstalledAt)
    VALUES ('Washer Maintenance Demo', 'washer', 'Speed Queen', 'WH-MAINT-01', '2024-01-20T08:15:00');
END
GO

PRINT 'Database initialization completed successfully!';
GO
