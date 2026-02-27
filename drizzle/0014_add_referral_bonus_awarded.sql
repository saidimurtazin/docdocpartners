-- Add referralBonusAwarded flag to agents table
-- true = bonus already credited to the referrer when this agent got their first visited referral
ALTER TABLE `agents` ADD COLUMN `referralBonusAwarded` boolean DEFAULT false;

-- For existing agents that have referredBy and already got bonus credited on registration,
-- mark them as awarded so they don't get double bonus
UPDATE `agents` SET `referralBonusAwarded` = true WHERE `referredBy` IS NOT NULL;
