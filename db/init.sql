-- LaundryFlow Database Initialization Script
-- Automatically creates database and all tables if they don't exist

-- Create Database (if not exists)
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'LaundryFlowDB')
BEGIN
    CREATE DATABASE LaundryFlowDB;
END
GO

-- Use the database
USE LaundryFlowDB;
GO

-- Create Rooms Table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Rooms')
BEGIN
    CREATE TABLE Rooms (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RoomNumber VARCHAR(10) NOT NULL UNIQUE
    );
    PRINT 'Table Rooms created successfully';
END
ELSE
BEGIN
    PRINT 'Table Rooms already exists';
END
GO

-- Create Users Table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users')
BEGIN
    CREATE TABLE Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name VARCHAR(100) NOT NULL,
        Email VARCHAR(100) NOT NULL UNIQUE,
        Phone VARCHAR(20),
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

-- Create Machines Table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Machines')
BEGIN
    CREATE TABLE Machines (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name VARCHAR(50) NOT NULL,
        Type VARCHAR(20) NOT NULL -- washer / dryer
    );
    PRINT 'Table Machines created successfully';
END
ELSE
BEGIN
    PRINT 'Table Machines already exists';
END
GO

-- Create MachineSessions Table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MachineSessions')
BEGIN
    CREATE TABLE MachineSessions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MachineId INT NOT NULL,
        UserId INT NOT NULL,
        StartTime DATETIME NOT NULL,
        EndTime DATETIME NULL, -- NULL = in progress

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

-- Create MachineIssues Table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MachineIssues')
BEGIN
    CREATE TABLE MachineIssues (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MachineId INT NOT NULL,
        Description VARCHAR(255),
        CreatedAt DATETIME DEFAULT GETDATE(),
        IsResolved BIT DEFAULT 0,

        FOREIGN KEY (MachineId) REFERENCES Machines(Id)
    );
    PRINT 'Table MachineIssues created successfully';
END
ELSE
BEGIN
    PRINT 'Table MachineIssues already exists';
END
GO

-- Insert Sample Data (only if tables are empty)
IF NOT EXISTS (SELECT * FROM Rooms)
BEGIN
    INSERT INTO Rooms (RoomNumber) VALUES 
    ('101.1'), ('101.2'), ('315.1'), ('315.2'), ('315.3');
    PRINT 'Sample Rooms data inserted';
END
GO

IF NOT EXISTS (SELECT * FROM Users)
BEGIN
    INSERT INTO Users (Name, Email, Phone, RoomId) VALUES 
    ('John Doe', 'john@email.com', '+33123456789', 1),
    ('Alice Martin', 'alice@email.com', '+33987654321', 2);
    PRINT 'Sample Users data inserted';
END
GO

IF NOT EXISTS (SELECT * FROM Machines)
BEGIN
    INSERT INTO Machines (Name, Type) VALUES 
    ('Machine 1', 'washer'), 
    ('Machine 2', 'washer'), 
    ('Dryer 1', 'dryer'), 
    ('Dryer 2', 'dryer');
    PRINT 'Sample Machines data inserted';
END
GO

PRINT 'LaundryFlow database initialization complete!';
