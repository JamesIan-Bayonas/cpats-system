CREATE TABLE `NotificationPreference` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `notificationEmail` VARCHAR(191) NULL,
  `pendingEmail` VARCHAR(191) NULL,
  `emailVerifiedAt` DATETIME(3) NULL,
  `emailNotificationsEnabled` BOOLEAN NOT NULL DEFAULT false,
  `verificationTokenHash` VARCHAR(191) NULL,
  `verificationExpiresAt` DATETIME(3) NULL,
  `verificationAttempts` INTEGER NOT NULL DEFAULT 0,
  `verificationSentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `NotificationPreference_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Notification` (
  `id` VARCHAR(191) NOT NULL,
  `recipientId` VARCHAR(191) NOT NULL,
  `prId` VARCHAR(191) NOT NULL,
  `sourceAuditLogId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `actionPath` VARCHAR(191) NOT NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Notification_recipientId_sourceAuditLogId_key`(`recipientId`, `sourceAuditLogId`),
  INDEX `Notification_recipientId_readAt_createdAt_idx`(`recipientId`, `readAt`, `createdAt`),
  INDEX `Notification_prId_idx`(`prId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EmailOutbox` (
  `id` VARCHAR(191) NOT NULL,
  `notificationId` VARCHAR(191) NOT NULL,
  `recipientEmail` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) NOT NULL,
  `bodyText` TEXT NOT NULL,
  `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `lastError` TEXT NULL,
  `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `EmailOutbox_notificationId_key`(`notificationId`),
  INDEX `EmailOutbox_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_prId_fkey` FOREIGN KEY (`prId`) REFERENCES `PurchaseRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_sourceAuditLogId_fkey` FOREIGN KEY (`sourceAuditLogId`) REFERENCES `AuditLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EmailOutbox` ADD CONSTRAINT `EmailOutbox_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `Notification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing workflow records become visible immediately after this feature is deployed.
INSERT INTO `Notification` (`id`, `recipientId`, `prId`, `sourceAuditLogId`, `title`, `message`, `actionPath`, `createdAt`)
SELECT
  UUID(),
  u.`id`,
  a.`prId`,
  a.`id`,
  CASE a.`newState`
    WHEN 'Pending_Business_Approval' THEN 'Purchase request awaiting budget review'
    WHEN 'Pending_Admin_Approval' THEN 'Purchase request awaiting administrative approval'
    WHEN 'Approved_Awaiting_PO' THEN 'Approved request ready for PO preparation'
    WHEN 'Awaiting_Check_Issuance' THEN 'Purchase order awaiting check issuance'
    WHEN 'Ready_for_Purchase' THEN 'Purchase ready for receiving'
    WHEN 'Received_and_Closed' THEN 'Procurement transaction completed'
  END,
  CONCAT('PR-', UPPER(LEFT(a.`prId`, 8)), ' from ', d.`name`, ' is now at ', REPLACE(a.`newState`, '_', ' '), '.'),
  CASE a.`newState`
    WHEN 'Pending_Business_Approval' THEN '/dashboard/pr/evaluate-business'
    WHEN 'Pending_Admin_Approval' THEN '/dashboard/pr/approve-admin'
    WHEN 'Approved_Awaiting_PO' THEN '/dashboard/po/new'
    WHEN 'Awaiting_Check_Issuance' THEN '/dashboard/po/release-check'
    WHEN 'Ready_for_Purchase' THEN '/dashboard/receiving/new'
    WHEN 'Received_and_Closed' THEN '/dashboard/audit'
  END,
  a.`createdAt`
FROM `AuditLog` a
JOIN `PurchaseRequest` pr ON pr.`id` = a.`prId`
JOIN `Department` d ON d.`id` = pr.`departmentId`
JOIN `User` u ON u.`role` = CASE a.`newState`
  WHEN 'Pending_Business_Approval' THEN 'Business_Office'
  WHEN 'Pending_Admin_Approval' THEN 'Admin_Office'
  WHEN 'Approved_Awaiting_PO' THEN 'Purchasing_Office'
  WHEN 'Awaiting_Check_Issuance' THEN 'Business_Office'
  WHEN 'Ready_for_Purchase' THEN 'Receiving_Custodian'
  WHEN 'Received_and_Closed' THEN 'Global_Auditor'
END
WHERE a.`newState` IN ('Pending_Business_Approval', 'Pending_Admin_Approval', 'Approved_Awaiting_PO', 'Awaiting_Check_Issuance', 'Ready_for_Purchase', 'Received_and_Closed');
