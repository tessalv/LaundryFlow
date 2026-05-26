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
        Type VARCHAR(20) NOT NULL, -- washer / dryer
        Brand VARCHAR(80) NULL DEFAULT 'Unknown',
        Reference VARCHAR(40) NULL DEFAULT 'REF-UNKNOWN',
        InstalledAt DATETIME NULL DEFAULT GETDATE()
    );
    PRINT 'Table Machines created successfully';
END
ELSE
BEGIN
    PRINT 'Table Machines already exists';
END
GO

IF COL_LENGTH('Machines', 'Brand') IS NULL
BEGIN
    ALTER TABLE Machines ADD Brand VARCHAR(80) NULL CONSTRAINT DF_Machines_Brand DEFAULT 'Unknown';
    PRINT 'Column Machines.Brand added';
END
GO

IF COL_LENGTH('Machines', 'Reference') IS NULL
BEGIN
    ALTER TABLE Machines ADD Reference VARCHAR(40) NULL CONSTRAINT DF_Machines_Reference DEFAULT 'REF-UNKNOWN';
    PRINT 'Column Machines.Reference added';
END
GO

IF COL_LENGTH('Machines', 'InstalledAt') IS NULL
BEGIN
    ALTER TABLE Machines ADD InstalledAt DATETIME NULL CONSTRAINT DF_Machines_InstalledAt DEFAULT GETDATE();
    PRINT 'Column Machines.InstalledAt added';
END
GO

-- Treat literal 'unknown' or misspelled 'unk' values as missing as well
IF EXISTS (
    SELECT 1 FROM Machines
    WHERE Brand IS NULL OR Reference IS NULL OR InstalledAt IS NULL
       OR LOWER(LTRIM(RTRIM(ISNULL(Brand, '')))) LIKE '%unk%'
       OR LOWER(LTRIM(RTRIM(ISNULL(Reference, '')))) LIKE '%unk%'
)
BEGIN
    ;WITH MachineRowNumbers AS (
        SELECT
            Id,
            Type,
            ROW_NUMBER() OVER (PARTITION BY Type ORDER BY Id) AS TypeRow
        FROM Machines
    )
    UPDATE m
    SET
        -- Simple non-hardcoded backfill: use the machine Id to create stable placeholder values
        Brand = CASE
            WHEN m.Brand IS NULL OR LOWER(LTRIM(RTRIM(ISNULL(m.Brand, '')))) LIKE '%unk%'
                THEN 'Unknown'
            ELSE m.Brand
        END,
        Reference = CASE
            WHEN m.Reference IS NULL OR LOWER(LTRIM(RTRIM(ISNULL(m.Reference, '')))) LIKE '%unk%'
                THEN CONCAT('REF-', m.Id)
            ELSE m.Reference
        END,
        InstalledAt = CASE
            WHEN m.InstalledAt IS NULL
                THEN DATEADD(DAY, -(ABS(CHECKSUM(m.Id)) % 365), GETDATE())
            ELSE m.InstalledAt
        END
    FROM Machines m
    INNER JOIN MachineRowNumbers mrn ON m.Id = mrn.Id;

    PRINT 'Machines metadata backfilled';
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
        ResolvedAt DATETIME NULL,
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

IF COL_LENGTH('MachineIssues', 'ResolvedAt') IS NULL
BEGIN
    ALTER TABLE MachineIssues ADD ResolvedAt DATETIME NULL;
    PRINT 'Column MachineIssues.ResolvedAt added';
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
    INSERT INTO Machines (Name, Type, Brand, Reference, InstalledAt) VALUES 
    ('Machine 1', 'washer', 'LG', 'WSH-1001', DATEADD(DAY, -184, GETDATE())), 
    ('Machine 2', 'washer', 'Samsung', 'WSH-1002', DATEADD(DAY, -236, GETDATE())), 
    ('Dryer 1', 'dryer', 'Bosch', 'DRY-2001', DATEADD(DAY, -198, GETDATE())), 
    ('Dryer 2', 'dryer', 'Siemens', 'DRY-2002', DATEADD(DAY, -273, GETDATE()));
    PRINT 'Sample Machines data inserted';
END
GO

PRINT 'LaundryFlow database initialization complete!';
