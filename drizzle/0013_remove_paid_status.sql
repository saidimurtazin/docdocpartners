-- Remove "paid" status: "visited" already implies treatment was completed and paid
-- Step 1: Migrate existing "paid" records to "visited"
UPDATE `referrals` SET `status` = 'visited' WHERE `status` = 'paid';

-- Step 2: Remove "paid" from the enum
ALTER TABLE `referrals` MODIFY COLUMN `status` enum('new','in_progress','contacted','scheduled','visited','duplicate','no_answer','cancelled') NOT NULL DEFAULT 'new';
