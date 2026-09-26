-- Notification trash is independent from the procurement workflow.
-- Purchase requests and audit logs remain authoritative and are never deleted here.
ALTER TABLE `Notification`
    ADD COLUMN `trashedAt` DATETIME(3) NULL,
    ADD COLUMN `purgeAfter` DATETIME(3) NULL;

CREATE INDEX `Notification_recipientId_trashedAt_purgeAfter_idx`
    ON `Notification`(`recipientId`, `trashedAt`, `purgeAfter`);
