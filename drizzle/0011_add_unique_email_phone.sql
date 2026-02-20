-- Add UNIQUE constraints on agents.email and agents.phone
-- First clean up any empty strings to NULL (UNIQUE allows multiple NULLs but not multiple empty strings)
UPDATE `agents` SET `email` = NULL WHERE `email` = '';
UPDATE `agents` SET `phone` = NULL WHERE `phone` = '';

-- Add unique constraints
ALTER TABLE `agents` ADD CONSTRAINT `agents_email_unique` UNIQUE(`email`);
ALTER TABLE `agents` ADD CONSTRAINT `agents_phone_unique` UNIQUE(`phone`);
