-- Add password authentication fields to agents table
ALTER TABLE agents
ADD COLUMN passwordHash VARCHAR(255),
ADD COLUMN temporaryPassword VARCHAR(32),
ADD COLUMN passwordSetAt TIMESTAMP;
