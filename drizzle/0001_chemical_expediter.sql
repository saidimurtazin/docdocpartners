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
