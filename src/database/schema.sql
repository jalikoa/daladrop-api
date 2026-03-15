-- ------------------------------------------------------------------
-- NFC Payment System - Consolidated Database Schema
-- Architecture: DDD + Event-Driven + Double-Entry Ledger
-- Database: MySQL 8.0+ (Single Database)
-- ------------------------------------------------------------------


-- ------------------------------------------------------------------
-- 1. Identity Domain
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS identity_users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'MERCHANT', 'CUSTOMER') DEFAULT 'CUSTOMER',
    status ENUM('ACTIVE', 'SUSPENDED', 'DELETED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_identity_users_email (email),
    INDEX idx_identity_users_phone (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 2. Merchant Domain
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS merchant_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    business_email VARCHAR(255),
    business_phone VARCHAR(20),
    logo_url VARCHAR(500),
    paybill_number VARCHAR(20),
    account_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES identity_users(id) ON DELETE CASCADE,
    INDEX idx_merchant_profiles_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS merchant_nfc_tags (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    merchant_id BIGINT NOT NULL,
    tag_uid VARCHAR(100),
    encrypted_payload TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id) ON DELETE CASCADE,
    INDEX idx_merchant_nfc_tags_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS merchant_cards (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    merchant_id BIGINT NOT NULL,
    qr_code_url VARCHAR(500),
    pdf_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id) ON DELETE CASCADE,
    INDEX idx_merchant_cards_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 3. Payments Domain
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_uuid CHAR(36) UNIQUE NOT NULL,
    merchant_id BIGINT NOT NULL,
    customer_phone VARCHAR(20),
    amount DECIMAL(15, 2) NOT NULL,
    status ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    checkout_request_id VARCHAR(100) UNIQUE,
    mpesa_receipt VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id),
    INDEX idx_payment_sessions_checkout (checkout_request_id),
    INDEX idx_payment_sessions_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_callbacks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    checkout_request_id VARCHAR(100) NOT NULL,
    mpesa_receipt_number VARCHAR(50),
    result_code INT,
    result_desc TEXT,
    payload JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_payment_callbacks_checkout (checkout_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 4. Ledger Domain (Double-Entry)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ledger_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    balance DECIMAL(18, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ledger_accounts_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ledger_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_ref VARCHAR(100) NOT NULL,
    account_id BIGINT NOT NULL,
    entry_type ENUM('DEBIT', 'CREDIT') NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    description TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES ledger_accounts(id),
    INDEX idx_ledger_entries_account (account_id),
    INDEX idx_ledger_entries_ref (transaction_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 5. Notifications Domain
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    channel ENUM('SMS', 'EMAIL', 'PUSH') NOT NULL,
    message TEXT,
    status ENUM('QUEUED', 'SENT', 'FAILED') DEFAULT 'QUEUED',
    provider VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES identity_users(id),
    INDEX idx_notifications_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 6. Audit Domain
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(255),
    ip_address VARCHAR(45),
    request_method VARCHAR(10),
    endpoint VARCHAR(255),
    payload JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES identity_users(id),
    INDEX idx_audit_logs_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 7. Webhook Domain
-- ------------------------------------------------------------------


CREATE TABLE IF NOT EXISTS webhook_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source ENUM('MPESA', 'STRIPE', 'PAYPAL', 'INTERNAL', 'THIRD_PARTY') NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(100) DEFAULT NULL,
    status ENUM('RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DUPLICATE', 'IGNORED') DEFAULT 'RECEIVED',
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(255) DEFAULT NULL,
    payload JSON NOT NULL,
    response_sent JSON DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    retry_count INT DEFAULT 0,
    is_duplicate BOOLEAN DEFAULT FALSE,
    idempotency_key VARCHAR(100) DEFAULT NULL UNIQUE,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    processed_at TIMESTAMP DEFAULT NULL,
    
    -- Indexes for performance
    INDEX idx_webhook_logs_source_event (source, event_id),
    INDEX idx_webhook_logs_status (status),
    INDEX idx_webhook_logs_received_at (received_at),
    INDEX idx_webhook_logs_idempotency (idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 8. SEED DATA: Initial Ledger Accounts
-- ------------------------------------------------------------------

INSERT INTO ledger_accounts (code, name, account_type, balance) VALUES
('1001', 'M-Pesa Clearing', 'ASSET', 0.00),
('2001', 'Merchant Wallets', 'LIABILITY', 0.00),
('4001', 'Platform Fees', 'REVENUE', 0.00),
('3001', 'Cash On Hand', 'ASSET', 0.00);