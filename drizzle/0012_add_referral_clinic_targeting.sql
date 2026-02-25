-- Add clinic targeting and booking fields to referrals
ALTER TABLE `referrals` ADD COLUMN `targetClinicIds` TEXT DEFAULT NULL;
ALTER TABLE `referrals` ADD COLUMN `bookedClinicId` INT DEFAULT NULL;
ALTER TABLE `referrals` ADD COLUMN `bookedByPartner` ENUM('yes', 'no') DEFAULT 'no';
