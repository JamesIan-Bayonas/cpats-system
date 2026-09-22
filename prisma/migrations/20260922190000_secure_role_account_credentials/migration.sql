-- Ensure the six institutional role departments exist without removing operational data.
INSERT INTO `Department` (`id`, `name`, `code`, `createdAt`, `updatedAt`) VALUES
  ('f81d4fae-7dec-11d0-a765-00a0c91e6bf6', 'College of Computer Studies', 'CCS', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('business-finance-dept-xyz', 'Business and Finance Office', 'BFO', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('administration-dept-uuid-hq', 'Office of the Vice President for Administration', 'OVPA', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('purchasing-dept-uuid-wxy', 'Purchasing and Procurement Office', 'PPO', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('asset-management-dept-uuid-000', 'Property and Asset Management Unit', 'PAMU', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('audit-compliance-dept-uuid', 'Internal Audit Office', 'IAO', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `updatedAt` = CURRENT_TIMESTAMP(3);

-- Insert missing role accounts or rotate existing accounts to their distinct scrypt hashes.
INSERT INTO `User` (`id`, `email`, `passwordHash`, `role`, `departmentId`, `createdAt`, `updatedAt`)
SELECT '6a2f7b1e-3c9d-4e5f-a6b7-8c9d0e1f2a3b', 'requester@dmc.edu.ph', 'scrypt$16384$8$1$jR0pj-IVLcorU06wXRALGA$X6bHvUE-B5UNWOgKI8i4f-E29cI2Hwz028QBz1_p1fmv4RHOd1Z4uaeuKHHoS-Mdq7ngSXvNWx1L8_svNWWZRw', 'Requesting_Office', `id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3) FROM `Department` WHERE `code` = 'CCS'
ON DUPLICATE KEY UPDATE `passwordHash` = VALUES(`passwordHash`), `role` = VALUES(`role`), `departmentId` = VALUES(`departmentId`), `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `User` (`id`, `email`, `passwordHash`, `role`, `departmentId`, `createdAt`, `updatedAt`)
SELECT 'business-evaluator-uuid-999', 'finance@dmc.edu.ph', 'scrypt$16384$8$1$YUmTAuZbPXse_30IQMQgGQ$x3giLCgdj1lz3b6zUEyqZRoGLJsInfawJVeqRtAKtN3zwbcQzHIfQMwolmjD7U3M-gnY06LW9ZYM88jkWs4DIA', 'Business_Office', `id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3) FROM `Department` WHERE `code` = 'BFO'
ON DUPLICATE KEY UPDATE `passwordHash` = VALUES(`passwordHash`), `role` = VALUES(`role`), `departmentId` = VALUES(`departmentId`), `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `User` (`id`, `email`, `passwordHash`, `role`, `departmentId`, `createdAt`, `updatedAt`)
SELECT 'admin-approver-uuid-static-789', 'vp-admin@dmc.edu.ph', 'scrypt$16384$8$1$7g1d5V7YC9FMQ3x4X8fgkw$LN41dr3sz8ItaYwM4d6xfhz_05c79nIxWZVohP1MmlJSCc38DvQ8eFAWWk_2wpTfc1KlEcJTxckRtoj3OW6sJw', 'Admin_Office', `id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3) FROM `Department` WHERE `code` = 'OVPA'
ON DUPLICATE KEY UPDATE `passwordHash` = VALUES(`passwordHash`), `role` = VALUES(`role`), `departmentId` = VALUES(`departmentId`), `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `User` (`id`, `email`, `passwordHash`, `role`, `departmentId`, `createdAt`, `updatedAt`)
SELECT 'purchaser-uuid-static-888', 'purchasing@dmc.edu.ph', 'scrypt$16384$8$1$HeESmLlqg9J2lbzmo4ICig$qfiqyyX5h9zMXJIqUNmYm2-WptSNVe3VnWS6RXPbbuWQtRBuAo4d3C1jKkXB6kEOCPTu_rdntfFCfW6e6v8m5w', 'Purchasing_Office', `id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3) FROM `Department` WHERE `code` = 'PPO'
ON DUPLICATE KEY UPDATE `passwordHash` = VALUES(`passwordHash`), `role` = VALUES(`role`), `departmentId` = VALUES(`departmentId`), `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `User` (`id`, `email`, `passwordHash`, `role`, `departmentId`, `createdAt`, `updatedAt`)
SELECT 'custodian-uuid-static-555', 'custodian@dmc.edu.ph', 'scrypt$16384$8$1$_neMgzudIWGnKv22H0XBwg$lXdYvmfpoa_TlTAFrK0H9Jucm5zPjLnrBcULGZqZIcnfMlMu8qRqzLyKlOlJFPGn4tdH-n29wkV9o8tQHjauUA', 'Receiving_Custodian', `id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3) FROM `Department` WHERE `code` = 'PAMU'
ON DUPLICATE KEY UPDATE `passwordHash` = VALUES(`passwordHash`), `role` = VALUES(`role`), `departmentId` = VALUES(`departmentId`), `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `User` (`id`, `email`, `passwordHash`, `role`, `departmentId`, `createdAt`, `updatedAt`)
SELECT 'global-auditor-uuid-007', 'auditor@dmc.edu.ph', 'scrypt$16384$8$1$DGI7XhNIddRKezRDhngPjQ$fVpdoc_A5DOXJIxGFqD7_FQsTewhSRlkugCSBcfA0qEr_7neOWRXOVxmWolLjsnvqo8dNWAj5zjDtl-1p1O7kQ', 'Global_Auditor', `id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3) FROM `Department` WHERE `code` = 'IAO'
ON DUPLICATE KEY UPDATE `passwordHash` = VALUES(`passwordHash`), `role` = VALUES(`role`), `departmentId` = VALUES(`departmentId`), `updatedAt` = CURRENT_TIMESTAMP(3);
