-- Update referral status enum to new values
ALTER TABLE `referrals` MODIFY COLUMN `status` enum('new','in_progress','contacted','scheduled','visited','paid','duplicate','no_answer','cancelled') NOT NULL DEFAULT 'new';

-- Migrate existing data: pending -> new, completed -> paid
UPDATE `referrals` SET `status` = 'new' WHERE `status` = 'pending';
