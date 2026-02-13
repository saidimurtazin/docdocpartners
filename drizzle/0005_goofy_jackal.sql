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
