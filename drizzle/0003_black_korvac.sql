DROP INDEX `agents_email_idx` ON `agents`;--> statement-breakpoint
DROP INDEX `agents_phone_idx` ON `agents`;--> statement-breakpoint
ALTER TABLE `sessions` MODIFY COLUMN `agentId` int;--> statement-breakpoint
ALTER TABLE `sessions` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `agents` ADD CONSTRAINT `agents_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `agents` ADD CONSTRAINT `agents_phone_unique` UNIQUE(`phone`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`userId`);