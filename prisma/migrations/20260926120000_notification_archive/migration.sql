ALTER TABLE `Notification` ADD COLUMN `archivedAt` DATETIME(3) NULL;

CREATE INDEX `Notification_recipientId_archivedAt_createdAt_idx`
  ON `Notification`(`recipientId`, `archivedAt`, `createdAt`);
