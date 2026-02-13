ALTER TABLE `agents` ADD `bonusPoints` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `agents` ADD `inn` varchar(12);--> statement-breakpoint
ALTER TABLE `agents` ADD `isSelfEmployed` enum('yes','no','unknown') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `bankAccount` varchar(20);--> statement-breakpoint
ALTER TABLE `agents` ADD `bankName` varchar(255);--> statement-breakpoint
ALTER TABLE `agents` ADD `bankBik` varchar(9);