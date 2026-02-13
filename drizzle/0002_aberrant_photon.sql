CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramId` varchar(64) NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`role` varchar(100),
	`city` varchar(100),
	`specialization` varchar(255),
	`status` enum('pending','active','rejected','blocked') NOT NULL DEFAULT 'pending',
	`referralCode` varchar(50),
	`referredBy` int,
	`totalEarnings` int DEFAULT 0,
	`totalReferrals` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_telegramId_unique` UNIQUE(`telegramId`),
	CONSTRAINT `agents_referralCode_unique` UNIQUE(`referralCode`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`amount` int NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`method` varchar(50),
	`transactionId` varchar(255),
	`notes` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`patientFullName` varchar(255) NOT NULL,
	`patientBirthdate` varchar(50) NOT NULL,
	`patientCity` varchar(100),
	`patientPhone` varchar(50),
	`patientEmail` varchar(320),
	`clinic` varchar(255),
	`status` enum('pending','contacted','scheduled','completed','cancelled') NOT NULL DEFAULT 'pending',
	`treatmentAmount` int DEFAULT 0,
	`commissionAmount` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`)
);
