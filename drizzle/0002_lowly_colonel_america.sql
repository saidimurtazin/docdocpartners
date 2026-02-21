CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `clinic_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralId` int,
	`clinicId` int,
	`emailFrom` varchar(320) NOT NULL,
	`emailSubject` varchar(500),
	`emailMessageId` varchar(500) NOT NULL,
	`emailReceivedAt` timestamp,
	`emailBodyRaw` text,
	`patientName` varchar(255),
	`visitDate` varchar(50),
	`treatmentAmount` int DEFAULT 0,
	`services` text,
	`clinicName` varchar(255),
	`status` enum('pending_review','auto_matched','approved','rejected') NOT NULL DEFAULT 'pending_review',
	`aiConfidence` int DEFAULT 0,
	`matchConfidence` int DEFAULT 0,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clinic_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `clinic_reports_emailMessageId_unique` UNIQUE(`emailMessageId`)
);
--> statement-breakpoint
CREATE TABLE `clinics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(100),
	`ownership` varchar(100),
	`city` varchar(100),
	`address` text,
	`phone` varchar(50),
	`email` varchar(320),
	`website` varchar(500),
	`specializations` text,
	`certifications` text,
	`description` text,
	`commissionRate` int DEFAULT 10,
	`commissionTiers` text,
	`averageCheck` int DEFAULT 0,
	`foundedYear` int,
	`languages` varchar(255) DEFAULT 'Русский',
	`imageUrl` varchar(500),
	`reportEmails` text,
	`latitude` double,
	`longitude` double,
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clinics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_acts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` int NOT NULL,
	`agentId` int NOT NULL,
	`actNumber` varchar(50) NOT NULL,
	`actDate` timestamp NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`totalAmount` int NOT NULL,
	`pdfStorageKey` varchar(500),
	`pdfUrl` varchar(1000),
	`status` enum('generated','sent_for_signing','signed','cancelled') NOT NULL DEFAULT 'generated',
	`otpCode` varchar(6),
	`otpExpiresAt` timestamp,
	`otpAttempts` int DEFAULT 0,
	`otpSentVia` varchar(20),
	`signedAt` timestamp,
	`signedIp` varchar(45),
	`signedUserAgent` text,
	`agentFullNameSnapshot` varchar(255) NOT NULL,
	`agentInnSnapshot` varchar(12) NOT NULL,
	`agentBankNameSnapshot` varchar(255) NOT NULL,
	`agentBankAccountSnapshot` varchar(20) NOT NULL,
	`agentBankBikSnapshot` varchar(9) NOT NULL,
	`referralIds` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_acts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_acts_actNumber_unique` UNIQUE(`actNumber`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(50) NOT NULL,
	`title` varchar(500) NOT NULL,
	`referralId` int,
	`agentId` int,
	`assignedTo` int,
	`status` enum('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`dueDate` timestamp,
	`completedAt` timestamp,
	`completedBy` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agents` MODIFY COLUMN `telegramId` varchar(64);--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `status` enum('pending','act_generated','sent_for_signing','signed','ready_for_payment','processing','completed','failed') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `referrals` MODIFY COLUMN `status` enum('new','in_progress','contacted','scheduled','visited','paid','duplicate','no_answer','cancelled') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','support','accountant') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `agents` ADD `jumpContractorId` int;--> statement-breakpoint
ALTER TABLE `agents` ADD `payoutMethod` enum('card','sbp','bank_account') DEFAULT 'card' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `cardNumber` varchar(19);--> statement-breakpoint
ALTER TABLE `agents` ADD `jumpRequisiteId` int;--> statement-breakpoint
ALTER TABLE `agents` ADD `jumpIdentified` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `agents` ADD `excludedClinics` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `commissionOverride` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `grossAmount` int;--> statement-breakpoint
ALTER TABLE `payments` ADD `netAmount` int;--> statement-breakpoint
ALTER TABLE `payments` ADD `taxAmount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `payments` ADD `socialContributions` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `payments` ADD `isSelfEmployedSnapshot` enum('yes','no');--> statement-breakpoint
ALTER TABLE `payments` ADD `payoutVia` enum('manual','jump') DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `jumpPaymentId` varchar(50);--> statement-breakpoint
ALTER TABLE `payments` ADD `jumpStatus` int;--> statement-breakpoint
ALTER TABLE `payments` ADD `jumpStatusText` varchar(50);--> statement-breakpoint
ALTER TABLE `payments` ADD `jumpAmountPaid` int;--> statement-breakpoint
ALTER TABLE `payments` ADD `jumpCommission` int;--> statement-breakpoint
ALTER TABLE `referrals` ADD `treatmentMonth` varchar(7);--> statement-breakpoint
ALTER TABLE `referrals` ADD `contactConsent` boolean;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(50);--> statement-breakpoint
CREATE INDEX `clinic_reports_referral_id_idx` ON `clinic_reports` (`referralId`);--> statement-breakpoint
CREATE INDEX `clinic_reports_clinic_id_idx` ON `clinic_reports` (`clinicId`);--> statement-breakpoint
CREATE INDEX `clinic_reports_status_idx` ON `clinic_reports` (`status`);--> statement-breakpoint
CREATE INDEX `payment_acts_payment_id_idx` ON `payment_acts` (`paymentId`);--> statement-breakpoint
CREATE INDEX `payment_acts_agent_id_idx` ON `payment_acts` (`agentId`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_referral_id_idx` ON `tasks` (`referralId`);--> statement-breakpoint
CREATE INDEX `tasks_assigned_to_idx` ON `tasks` (`assignedTo`);--> statement-breakpoint
CREATE INDEX `agents_email_idx` ON `agents` (`email`);--> statement-breakpoint
CREATE INDEX `agents_phone_idx` ON `agents` (`phone`);--> statement-breakpoint
CREATE INDEX `agents_status_idx` ON `agents` (`status`);--> statement-breakpoint
CREATE INDEX `agents_referred_by_idx` ON `agents` (`referredBy`);--> statement-breakpoint
CREATE INDEX `otp_codes_email_idx` ON `otpCodes` (`email`);--> statement-breakpoint
CREATE INDEX `otp_codes_email_used_idx` ON `otpCodes` (`email`,`used`);--> statement-breakpoint
CREATE INDEX `payments_agent_id_idx` ON `payments` (`agentId`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE INDEX `payments_agent_status_idx` ON `payments` (`agentId`,`status`);--> statement-breakpoint
CREATE INDEX `referrals_agent_id_idx` ON `referrals` (`agentId`);--> statement-breakpoint
CREATE INDEX `referrals_status_idx` ON `referrals` (`status`);--> statement-breakpoint
CREATE INDEX `referrals_treatment_month_idx` ON `referrals` (`treatmentMonth`);--> statement-breakpoint
CREATE INDEX `referrals_agent_status_idx` ON `referrals` (`agentId`,`status`);--> statement-breakpoint
CREATE INDEX `sessions_agent_id_idx` ON `sessions` (`agentId`);