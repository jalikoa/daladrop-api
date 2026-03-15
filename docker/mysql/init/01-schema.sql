-- docker/mysql/init/01-schema.sql
-- Runs automatically on first `docker compose up` when the mysql container
-- initialises. Mirrors the MariaDB dump you already have in the repo.
-- Add to docker-compose.yml: volumes: ./docker/mysql/init:/docker-entrypoint-initdb.d:ro

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

CREATE DATABASE IF NOT EXISTS `nfc_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `nfc_db`;

-- identity_users
CREATE TABLE IF NOT EXISTS `identity_users` (
  `id`            bigint(20)    NOT NULL AUTO_INCREMENT,
  `uuid`          char(36)      NOT NULL,
  `email`         varchar(255)  DEFAULT NULL,
  `phone_number`  varchar(20)   DEFAULT NULL,
  `password_hash` varchar(255)  NOT NULL,
  `role`          enum('ADMIN','MERCHANT','CUSTOMER') DEFAULT 'CUSTOMER',
  `status`        enum('ACTIVE','SUSPENDED','DELETED') DEFAULT 'ACTIVE',
  `is_active`     tinyint(1)    DEFAULT 1,
  `created_at`    timestamp     NULL DEFAULT current_timestamp(),
  `updated_at`    timestamp     NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone_number` (`phone_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- merchant_profiles
CREATE TABLE IF NOT EXISTS `merchant_profiles` (
  `id`                   bigint(20)   NOT NULL AUTO_INCREMENT,
  `user_id`              bigint(20)   NOT NULL,
  `business_name`        varchar(255) NOT NULL,
  `business_email`       varchar(255) DEFAULT NULL,
  `business_phone`       varchar(20)  DEFAULT NULL,
  `logo_url`             varchar(500) DEFAULT NULL,
  `paybill_number`       varchar(20)  DEFAULT NULL,
  `account_number`       varchar(20)  DEFAULT NULL,
  `status`               enum('PENDING','ACTIVE','SUSPENDED','DEACTIVATED') DEFAULT 'PENDING',
  `verification_status`  enum('UNVERIFIED','PENDING','VERIFIED','REJECTED')  DEFAULT 'UNVERIFIED',
  `metadata`             longtext     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at`           timestamp    NULL DEFAULT current_timestamp(),
  `updated_at`           timestamp    NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_merchant_profiles_user` (`user_id`),
  CONSTRAINT `merchant_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `identity_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- merchant_nfc_tags  (note: renamed from entity's 'nfc_tags' — see schema diff)
CREATE TABLE IF NOT EXISTS `merchant_nfc_tags` (
  `id`                bigint(20) NOT NULL AUTO_INCREMENT,
  `merchant_id`       bigint(20) NOT NULL,
  `tag_uid`           varchar(100) DEFAULT NULL,
  `encrypted_payload` text NOT NULL,
  `is_active`         tinyint(1)  DEFAULT 1,
  `description`       varchar(255) DEFAULT NULL,
  `metadata`          longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at`        timestamp   NULL DEFAULT current_timestamp(),
  `updated_at`        timestamp   NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `tag_uid` (`tag_uid`),
  KEY `idx_merchant_nfc_tags_merchant` (`merchant_id`),
  CONSTRAINT `merchant_nfc_tags_ibfk_1` FOREIGN KEY (`merchant_id`) REFERENCES `merchant_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- merchant_cards
CREATE TABLE IF NOT EXISTS `merchant_cards` (
  `id`          bigint(20)   NOT NULL AUTO_INCREMENT,
  `merchant_id` bigint(20)   NOT NULL,
  `qr_code_url` varchar(500) DEFAULT NULL,
  `pdf_url`     varchar(500) DEFAULT NULL,
  `created_at`  timestamp    NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_merchant_cards_merchant` (`merchant_id`),
  CONSTRAINT `merchant_cards_ibfk_1` FOREIGN KEY (`merchant_id`) REFERENCES `merchant_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payment_sessions
CREATE TABLE IF NOT EXISTS `payment_sessions` (
  `id`                   bigint(20)    NOT NULL AUTO_INCREMENT,
  `session_uuid`         char(36)      NOT NULL,
  `merchant_id`          bigint(20)    NOT NULL,
  `customer_phone`       varchar(20)   DEFAULT NULL,
  `amount`               decimal(15,2) NOT NULL,
  `currency`             varchar(3)    NOT NULL DEFAULT 'KES',
  `status`               enum('PENDING','INITIATED','COMPLETED','FAILED','CANCELLED','REFUNDED') DEFAULT 'PENDING',
  `payment_type`         enum('NFC_TAP','QR_SCAN','MANUAL') NOT NULL DEFAULT 'NFC_TAP',
  `checkout_request_id`  varchar(100)  DEFAULT NULL,
  `merchant_request_id`  varchar(100)  DEFAULT NULL,
  `mpesa_receipt`        varchar(50)   DEFAULT NULL,
  `daraja_result_code`   varchar(50)   DEFAULT NULL,
  `daraja_result_desc`   text          DEFAULT NULL,
  `failure_reason`       text          DEFAULT NULL,
  `description`          text          DEFAULT NULL,
  `metadata`             longtext      CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at`           timestamp     NULL DEFAULT current_timestamp(),
  `updated_at`           timestamp     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `completed_at`         timestamp     NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_uuid` (`session_uuid`),
  UNIQUE KEY `checkout_request_id` (`checkout_request_id`),
  UNIQUE KEY `mpesa_receipt` (`mpesa_receipt`),
  KEY `idx_payment_sessions_merchant` (`merchant_id`),
  CONSTRAINT `payment_sessions_ibfk_1` FOREIGN KEY (`merchant_id`) REFERENCES `merchant_profiles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payment_callbacks
CREATE TABLE IF NOT EXISTS `payment_callbacks` (
  `id`                    bigint(20)  NOT NULL AUTO_INCREMENT,
  `checkout_request_id`   varchar(100) NOT NULL,
  `mpesa_receipt_number`  varchar(50)  DEFAULT NULL,
  `result_code`           int(11)      DEFAULT NULL,
  `result_desc`           text         DEFAULT NULL,
  `ip_address`            varchar(45)  DEFAULT NULL,
  `payload`               longtext     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload`)),
  `created_at`            timestamp    NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_payment_callbacks_checkout` (`checkout_request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ledger_accounts
CREATE TABLE IF NOT EXISTS `ledger_accounts` (
  `id`           bigint(20)    NOT NULL AUTO_INCREMENT,
  `code`         varchar(20)   NOT NULL,
  `name`         varchar(255)  NOT NULL,
  `account_type` enum('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE') NOT NULL,
  `currency`     varchar(3)    DEFAULT 'KES',
  `balance`      decimal(18,2) DEFAULT 0.00,
  `created_at`   timestamp     NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ledger_entries
CREATE TABLE IF NOT EXISTS `ledger_entries` (
  `id`              bigint(20)    NOT NULL AUTO_INCREMENT,
  `transaction_ref` varchar(100)  NOT NULL,
  `account_id`      bigint(20)    NOT NULL,
  `entry_type`      enum('DEBIT','CREDIT') NOT NULL,
  `amount`          decimal(18,2) NOT NULL,
  `description`     text          DEFAULT NULL,
  `metadata`        longtext      CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at`      timestamp     NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ledger_entries_account` (`account_id`),
  KEY `idx_ledger_entries_ref` (`transaction_ref`),
  CONSTRAINT `ledger_entries_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `ledger_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`                  bigint(20)   NOT NULL AUTO_INCREMENT,
  `user_id`             bigint(20)   DEFAULT NULL,
  `channel`             enum('SMS','EMAIL','PUSH') NOT NULL,
  `recipient`           varchar(255) DEFAULT NULL,
  `message`             text         NOT NULL,
  `subject`             varchar(255) DEFAULT NULL,
  `status`              enum('QUEUED','SENDING','SENT','DELIVERED','FAILED','CANCELLED') DEFAULT 'QUEUED',
  `priority`            enum('LOW','NORMAL','HIGH','CRITICAL') DEFAULT 'NORMAL',
  `provider`            varchar(50)  DEFAULT NULL,
  `provider_message_id` varchar(100) DEFAULT NULL,
  `error_message`       text         DEFAULT NULL,
  `retry_count`         int(11)      DEFAULT 0,
  `meta`                longtext     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `template_data`       longtext     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`template_data`)),
  `template_name`       varchar(100) DEFAULT NULL,
  `created_at`          timestamp    NULL DEFAULT current_timestamp(),
  `updated_at`          timestamp    NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `sent_at`             timestamp    NULL DEFAULT NULL,
  `delivered_at`        timestamp    NULL DEFAULT NULL,
  `failed_at`           timestamp    NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `identity_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- audit_logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`              bigint(20)   NOT NULL AUTO_INCREMENT,
  `user_id`         bigint(20)   DEFAULT NULL,
  `action`          varchar(255) DEFAULT NULL,
  `ip_address`      varchar(45)  DEFAULT NULL,
  `request_method`  varchar(10)  DEFAULT NULL,
  `endpoint`        varchar(255) DEFAULT NULL,
  `user_agent`      text         DEFAULT NULL,
  `payload`         longtext     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `response_status` int(11)      DEFAULT NULL,
  `created_at`      timestamp    NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_user` (`user_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `identity_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- webhook_logs
CREATE TABLE IF NOT EXISTS `webhook_logs` (
  `id`               bigint(20)   NOT NULL AUTO_INCREMENT,
  `source`           enum('DARAJA','AFRICASTALKING','FIREBASE','STRIPE','PAYPAL','INTERNAL','THIRD_PARTY') NOT NULL,
  `event_type`       varchar(100) NOT NULL,
  `event_id`         varchar(100) DEFAULT NULL,
  `status`           enum('RECEIVED','VALIDATED','PROCESSING','COMPLETED','FAILED','DUPLICATE','IGNORED') DEFAULT 'RECEIVED',
  `ip_address`       varchar(45)  NOT NULL,
  `user_agent`       varchar(255) DEFAULT NULL,
  `payload`          longtext     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload`)),
  `response_sent`    longtext     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`response_sent`)),
  `error_message`    text         DEFAULT NULL,
  `retry_count`      int(11)      DEFAULT 0,
  `is_duplicate`     tinyint(1)   DEFAULT 0,
  `idempotency_key`  varchar(100) DEFAULT NULL,
  `received_at`      timestamp    NULL DEFAULT current_timestamp(),
  `updated_at`       timestamp    NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `processed_at`     timestamp    NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idempotency_key` (`idempotency_key`),
  KEY `idx_webhook_logs_source_event` (`source`,`event_id`),
  KEY `idx_webhook_logs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default ledger accounts
INSERT IGNORE INTO `ledger_accounts` (`code`,`name`,`account_type`,`currency`,`balance`) VALUES
  ('1001','M-Pesa Clearing','ASSET','KES',0.00),
  ('2001','Merchant Wallets','LIABILITY','KES',0.00),
  ('4001','Platform Fees','REVENUE','KES',0.00),
  ('3001','Cash On Hand','ASSET','KES',0.00);

SET foreign_key_checks = 1;