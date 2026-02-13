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
	`bonusPoints` int DEFAULT 0,
	`inn` varchar(12),
	`isSelfEmployed` enum('yes','no','unknown') NOT NULL DEFAULT 'unknown',
	`bankAccount` varchar(20),
	`bankName` varchar(255),
	`bankBik` varchar(9),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_telegramId_unique` UNIQUE(`telegramId`),
	CONSTRAINT `agents_referralCode_unique` UNIQUE(`referralCode`)
);
--> statement-breakpoint
CREATE TABLE `doctors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`specialization` varchar(255) NOT NULL,
	`clinic` varchar(255) NOT NULL,
	`clinicLocation` varchar(255),
	`experience` int,
	`education` text,
	`achievements` text,
	`services` text,
	`phone` varchar(50),
	`email` varchar(320),
	`bio` text,
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `doctors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `otpCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`code` varchar(6) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`used` enum('yes','no') NOT NULL DEFAULT 'no',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otpCodes_id` PRIMARY KEY(`id`)
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
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`sessionToken` varchar(255) NOT NULL,
	`deviceInfo` text,
	`ipAddress` varchar(45),
	`loginMethod` varchar(50) NOT NULL,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`isRevoked` enum('yes','no') NOT NULL DEFAULT 'no',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
