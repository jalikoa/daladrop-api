-- ============================================================================
-- Migration: init production schema (regenerated after domain amend)
-- DO NOT apply from automated agents against live databases
-- Operator applies after review: see docs/database/MIGRATION.md
-- Requires PostGIS-capable PostgreSQL
-- ============================================================================

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DELETED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SERVICE', 'ANONYMOUS', 'SYSTEM', 'ADMIN');

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP', 'LOGIN', 'RESET_PASSWORD', 'VERIFY_PHONE', 'VERIFY_EMAIL');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('CUSTOMER', 'RIDER', 'MERCHANT_OWNER', 'MERCHANT_STAFF', 'ORGANIZER', 'ADMIN', 'SUPPORT', 'FINANCE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('RESTAURANT', 'MARKET', 'LIQUOR', 'GAS', 'GENERAL', 'EVENT');

-- CreateEnum
CREATE TYPE "LogisticsServiceType" AS ENUM ('NORMAL_DELIVERY', 'GAS_DELIVERY', 'PARCEL', 'EXPRESS_PARCEL', 'INTER_COUNTY', 'RIDE', 'EVENT');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('BIKE', 'CAR', 'VAN', 'TRUCK', 'OTHER');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProductServiceType" AS ENUM ('STANDARD', 'REFILL', 'EXCHANGE', 'NEW');

-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('FOOD', 'MARKET', 'LIQUOR', 'GAS', 'MERCHANT', 'EVENT', 'PARCEL');

-- CreateEnum
CREATE TYPE "ModuleOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CASH', 'WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MPESA_DARAJA', 'AIRTEL_MONEY', 'STRIPE', 'FLUTTERWAVE', 'PESAPAL', 'PAYPAL', 'VISA', 'MASTERCARD', 'BANK_TRANSFER', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('ORDER', 'RIDE', 'EVENT_BOOKING', 'WALLET_TOP_UP', 'SETTLEMENT', 'REFUND', 'OTHER');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('FIXED', 'PERCENTAGE', 'HYBRID');

-- CreateEnum
CREATE TYPE "SettlementFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialDocumentType" AS ENUM ('INVOICE', 'RECEIPT', 'CREDIT_NOTE', 'DEBIT_NOTE', 'REFUND_NOTE');

-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('VAT', 'WITHHOLDING', 'OTHER');

-- CreateEnum
CREATE TYPE "RideServiceType" AS ENUM ('RIDE', 'PARCEL', 'COURIER', 'INTER_COUNTY', 'MERCHANT');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('PENDING_PAYMENT', 'SEARCHING', 'ASSIGNED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ParcelWeightCategory" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'USED', 'CANCELLED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AgeVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgeVerificationMethod" AS ENUM ('ID_DOCUMENT', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "SavedItemKind" AS ENUM ('RESTAURANT', 'MERCHANT', 'EVENT', 'MARKET', 'PRODUCT');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('STORE', 'PRODUCT', 'MENU_ITEM', 'RIDER', 'EVENT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "WalletOwnerType" AS ENUM ('CUSTOMER', 'MERCHANT', 'RIDER', 'ORGANIZER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT', 'HOLD', 'RELEASE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'FORFEITED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SettlementBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargebackStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'RESTORE', 'SOFT_DELETE', 'ROLE_CHANGE', 'PERMISSION_CHANGE', 'APPROVAL', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "IdempotencyState" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "FeatureFlagStatus" AS ENUM ('DISABLED', 'ENABLED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(32),
    "phone_e164" VARCHAR(20),
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "display_name" VARCHAR(200),
    "photo_url" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_verified_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" VARCHAR(500),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "algorithm" VARCHAR(32) NOT NULL DEFAULT 'bcrypt',
    "password_set_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "raw_profile" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(128) NOT NULL,
    "resource" VARCHAR(64) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "roles_snapshot" TEXT[],
    "ip" VARCHAR(64),
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fingerprint" VARCHAR(128) NOT NULL,
    "platform" VARCHAR(32),
    "model" VARCHAR(100),
    "os_version" VARCHAR(64),
    "app_version" VARCHAR(64),
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "trusted_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "identifier" VARCHAR(255) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failure_reason" VARCHAR(128),
    "ip" VARCHAR(64),
    "user_agent" TEXT,
    "device_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "identifier" VARCHAR(255) NOT NULL,
    "channel" "OtpChannel" NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "signup_token" VARCHAR(128),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_acceptances" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_type" VARCHAR(64) NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "full_name" VARCHAR(200),
    "signature_name" VARCHAR(200),
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(64),
    "user_agent" TEXT,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "age_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "AgeVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "method" "AgeVerificationMethod",
    "document_type" VARCHAR(64),
    "document_image_url" TEXT,
    "date_of_birth" DATE,
    "verified_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "review_notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "age_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_places" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(64),
    "address" TEXT NOT NULL,
    "place_id" VARCHAR(255),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "saved_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "legal_name" VARCHAR(255),
    "status" "MerchantStatus" NOT NULL DEFAULT 'DRAFT',
    "tax_id" VARCHAR(64),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "is_organizer" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" VARCHAR(500),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "store_type" "StoreType" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200),
    "description" TEXT,
    "city" VARCHAR(100),
    "address" TEXT,
    "phone" VARCHAR(32),
    "whatsapp" VARCHAR(32),
    "email" VARCHAR(255),
    "website" TEXT,
    "image_url" TEXT,
    "cover_image_url" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "location" geography(Point,4326),
    "delivery_fee_hint" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "minimum_order_amount" BIGINT,
    "delivery_time_min" INTEGER,
    "delivery_time_max" INTEGER,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "age_restricted" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "navigation_route" VARCHAR(255),
    "navigation_params" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" VARCHAR(500),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_opening_hours" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "open_time" VARCHAR(5),
    "close_time" VARCHAR(5),
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "store_opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "store_id" UUID,
    "module_type" "ModuleType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "icon_key" VARCHAR(64),
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "category_id" UUID,
    "cylinder_type_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "brand" VARCHAR(120),
    "sku" VARCHAR(64),
    "price_amount" BIGINT NOT NULL,
    "original_price" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "discount_percent" INTEGER,
    "image_url" TEXT,
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "age_restricted" BOOLEAN NOT NULL DEFAULT false,
    "size_label" VARCHAR(32),
    "volume_label" VARCHAR(32),
    "abv" DECIMAL(5,2),
    "country" VARCHAR(80),
    "unit_label" VARCHAR(32),
    "weight_kg" DECIMAL(8,3),
    "length_cm" DECIMAL(8,2),
    "width_cm" DECIMAL(8,2),
    "height_cm" DECIMAL(8,2),
    "service_type" "ProductServiceType",
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" VARCHAR(500),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "menu_category_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "price_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "image_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "preparation_time" INTEGER,
    "calories" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_groups" (
    "id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_options" (
    "id" UUID NOT NULL,
    "modifier_group_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "price_delta" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_favourites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_favourites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "SavedItemKind" NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "module_type" "ModuleType" NOT NULL,
    "store_id" UUID,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_id" UUID,
    "menu_item_id" UUID,
    "name_snapshot" VARCHAR(200) NOT NULL,
    "unit_price_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "modifier_option_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "module_type" "ModuleType" NOT NULL,
    "status" "ModuleOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "customer_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "rider_id" UUID,
    "delivery_address" TEXT,
    "delivery_latitude" DECIMAL(10,7),
    "delivery_longitude" DECIMAL(10,7),
    "notes" TEXT,
    "subtotal_amount" BIGINT NOT NULL,
    "delivery_fee_amount" BIGINT NOT NULL DEFAULT 0,
    "service_fee_amount" BIGINT NOT NULL DEFAULT 0,
    "total_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'MOBILE_MONEY',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "distance_km" DECIMAL(8,3),
    "package_weight_kg" DECIMAL(8,3),
    "package_length_cm" DECIMAL(8,2),
    "package_width_cm" DECIMAL(8,2),
    "package_height_cm" DECIMAL(8,2),
    "delivery_pricing_rule_id" UUID,
    "delivery_constraint_id" UUID,
    "rider_pay_amount" BIGINT NOT NULL DEFAULT 0,
    "platform_commission_amount" BIGINT NOT NULL DEFAULT 0,
    "merchant_commission_amount" BIGINT NOT NULL DEFAULT 0,
    "customer_hidden_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "prepared_at" TIMESTAMPTZ(6),
    "ready_at" TIMESTAMPTZ(6),
    "picked_up_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" VARCHAR(500),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID,
    "menu_item_id" UUID,
    "name_snapshot" VARCHAR(200) NOT NULL,
    "unit_price_amount" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "notes" TEXT,
    "modifier_option_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "modifiers_snapshot" JSONB,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "ModuleOrderStatus",
    "to_status" "ModuleOrderStatus" NOT NULL,
    "actor_type" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actor_id" UUID,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT false,
    "current_latitude" DECIMAL(10,7),
    "current_longitude" DECIMAL(10,7),
    "location" geography(Point,4326),
    "vehicle_type" VARCHAR(64),
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_partners" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "brand_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "courier_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inter_county_routes" (
    "id" UUID NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "quoted_fare_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "default_pickup" TEXT,
    "default_dropoff" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "inter_county_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rides" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "rider_id" UUID,
    "service_type" "RideServiceType" NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "vehicle_type" VARCHAR(64),
    "pickup_address" TEXT,
    "pickup_latitude" DECIMAL(10,7) NOT NULL,
    "pickup_longitude" DECIMAL(10,7) NOT NULL,
    "dropoff_address" TEXT,
    "dropoff_latitude" DECIMAL(10,7) NOT NULL,
    "dropoff_longitude" DECIMAL(10,7) NOT NULL,
    "pickup_location" geography(Point,4326),
    "dropoff_location" geography(Point,4326),
    "fare_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "distance_km" DECIMAL(8,3),
    "polyline" TEXT,
    "delivery_pricing_rule_id" UUID,
    "rider_pay_amount" BIGINT NOT NULL DEFAULT 0,
    "platform_commission_amount" BIGINT NOT NULL DEFAULT 0,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "item_description" TEXT,
    "receiver_phone" VARCHAR(32),
    "weight_category" "ParcelWeightCategory",
    "parcel_size" VARCHAR(64),
    "package_weight_kg" DECIMAL(8,3),
    "package_length_cm" DECIMAL(8,2),
    "package_width_cm" DECIMAL(8,2),
    "package_height_cm" DECIMAL(8,2),
    "parcel_pricing_profile_id" UUID,
    "courier_partner_id" UUID,
    "inter_county_route_id" UUID,
    "share_token" VARCHAR(64),
    "customer_hidden_at" TIMESTAMPTZ(6),
    "assigned_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" VARCHAR(500),

    CONSTRAINT "rides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_status_history" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "from_status" "RideStatus",
    "to_status" "RideStatus" NOT NULL,
    "actor_type" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actor_id" UUID,
    "reason" VARCHAR(500),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_organizers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "org_name" VARCHAR(200),
    "phone" VARCHAR(32),
    "whatsapp" VARCHAR(32),
    "email" VARCHAR(255),
    "website" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_organizers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "icon_key" VARCHAR(64),
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "organizer_id" UUID,
    "category_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "venue" VARCHAR(255),
    "address" TEXT,
    "city" VARCHAR(100),
    "banner_url" TEXT,
    "cover_image_url" TEXT,
    "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "location" geography(Point,4326),
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "navigation_route" VARCHAR(255),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" VARCHAR(500),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_ticket_types" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "product_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "price_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "total_qty" INTEGER NOT NULL,
    "sold_qty" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_bookings" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_id" UUID,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "phone" VARCHAR(20),
    "message" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tickets" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "qr_code" VARCHAR(255) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "target_type" "ReviewTargetType" NOT NULL,
    "store_id" UUID,
    "product_id" UUID,
    "menu_item_id" UUID,
    "rider_id" UUID,
    "event_id" UUID,
    "order_id" UUID,
    "ride_id" UUID,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cylinder_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "weight_kg" DECIMAL(8,3) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cylinder_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_constraints" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "service_type" "LogisticsServiceType" NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL DEFAULT 'BIKE',
    "max_distance_km" DECIMAL(8,3) NOT NULL,
    "max_weight_kg" DECIMAL(8,3) NOT NULL,
    "max_length_cm" DECIMAL(8,2) NOT NULL,
    "max_width_cm" DECIMAL(8,2) NOT NULL,
    "max_height_cm" DECIMAL(8,2) NOT NULL,
    "overflow_service_type" "LogisticsServiceType",
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_pricing_rules" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120),
    "service_type" "LogisticsServiceType" NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL DEFAULT 'BIKE',
    "distance_min_km" DECIMAL(8,3) NOT NULL,
    "distance_max_km" DECIMAL(8,3) NOT NULL,
    "weight_min_kg" DECIMAL(8,3),
    "weight_max_kg" DECIMAL(8,3),
    "product_id" UUID,
    "cylinder_type_id" UUID,
    "customer_charge" BIGINT NOT NULL,
    "rider_pay" BIGINT NOT NULL,
    "platform_commission" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcel_pricing_profiles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "service_type" "LogisticsServiceType" NOT NULL,
    "distance_rule" JSONB NOT NULL,
    "weight_rule" JSONB NOT NULL,
    "volume_rule" JSONB,
    "insurance_rule" JSONB,
    "express_charge" BIGINT NOT NULL DEFAULT 0,
    "fragile_surcharge" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parcel_pricing_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_contracts" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "service_type" "LogisticsServiceType" NOT NULL,
    "module_type" "ModuleType",
    "name" VARCHAR(120) NOT NULL,
    "commission_type" "CommissionType" NOT NULL,
    "fixed_amount" BIGINT NOT NULL DEFAULT 0,
    "percentage_bps" INTEGER NOT NULL DEFAULT 0,
    "minimum_charge" BIGINT NOT NULL DEFAULT 0,
    "maximum_charge" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "merchant_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cylinder_exchanges" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "old_cylinder_type_id" UUID,
    "new_cylinder_type_id" UUID,
    "old_cylinder_received" BOOLEAN NOT NULL DEFAULT false,
    "new_cylinder_delivered" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" UUID,
    "notes" TEXT,
    "exchanged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cylinder_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_policies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "beneficiary_type" "WalletOwnerType" NOT NULL,
    "frequency" "SettlementFrequency" NOT NULL,
    "cutoff_day" SMALLINT,
    "cutoff_time" VARCHAR(8) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Nairobi',
    "minimum_amount" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "auto_settlement" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settlement_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charts_of_accounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "charts_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "chart_of_accounts_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "normal_balance" "NormalBalance" NOT NULL,
    "parent_id" UUID,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" UUID NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balances" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "accounting_period_id" UUID NOT NULL,
    "debit_total" BIGINT NOT NULL DEFAULT 0,
    "credit_total" BIGINT NOT NULL DEFAULT 0,
    "closing_balance" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "account_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "entry_number" VARCHAR(64) NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "value_date" TIMESTAMPTZ(6) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "accounting_period_id" UUID,
    "external_ref" VARCHAR(128),
    "internal_ref" VARCHAR(128),
    "payment_id" UUID,
    "posted_at" TIMESTAMPTZ(6),
    "posted_by" UUID,
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" VARCHAR(500),
    "reverses_entry_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" UUID NOT NULL,
    "journal_entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "debit_amount" BIGINT NOT NULL DEFAULT 0,
    "credit_amount" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "base_debit_amount" BIGINT NOT NULL DEFAULT 0,
    "base_credit_amount" BIGINT NOT NULL DEFAULT 0,
    "memo" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "owner_type" "WalletOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "user_id" UUID,
    "merchant_id" UUID,
    "rider_id" UUID,
    "organizer_id" UUID,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "balance_amount" BIGINT NOT NULL DEFAULT 0,
    "hold_amount" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "debit_amount" BIGINT NOT NULL DEFAULT 0,
    "credit_amount" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "balance_after" BIGINT NOT NULL,
    "reference" VARCHAR(128),
    "journal_entry_id" UUID,
    "payment_id" UUID,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod" NOT NULL DEFAULT 'MOBILE_MONEY',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MPESA_DARAJA',
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "reference" VARCHAR(128),
    "customer_id" UUID,
    "order_id" UUID,
    "ride_id" UUID,
    "event_booking_id" UUID,
    "idempotency_key" VARCHAR(128),
    "internal_ref" VARCHAR(128),
    "failure_code" VARCHAR(64),
    "failure_message" TEXT,
    "initiated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_provider_transactions" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_reference" VARCHAR(128),
    "checkout_request_id" VARCHAR(128),
    "merchant_request_id" VARCHAR(128),
    "payer_identifier" VARCHAR(64),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "request_payload" JSONB,
    "response_payload" JSONB,
    "callback_payload" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_provider_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "label" VARCHAR(64) NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "account_code_hint" VARCHAR(32),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_holds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "order_id" UUID,
    "ride_id" UUID,
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "beneficiary_type" "WalletOwnerType" NOT NULL,
    "beneficiary_id" UUID,
    "held_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(6),
    "journal_entry_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "escrow_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_batches" (
    "id" UUID NOT NULL,
    "batch_number" VARCHAR(64) NOT NULL,
    "settlement_policy_id" UUID,
    "status" "SettlementBatchStatus" NOT NULL DEFAULT 'PENDING',
    "beneficiary_type" "WalletOwnerType" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "total_amount" BIGINT NOT NULL DEFAULT 0,
    "scheduled_for" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),
    "external_ref" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_items" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "reference" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "batch_id" UUID,
    "settlement_policy_id" UUID,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "payout_provider" "PaymentProvider",
    "payout_reference" VARCHAR(128),
    "journal_entry_id" UUID,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "reason" VARCHAR(500),
    "provider_ref" VARCHAR(128),
    "journal_entry_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chargebacks" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "status" "ChargebackStatus" NOT NULL DEFAULT 'OPEN',
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "reason_code" VARCHAR(64),
    "provider_ref" VARCHAR(128),
    "journal_entry_id" UUID,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chargebacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_documents" (
    "id" UUID NOT NULL,
    "document_type" "FinancialDocumentType" NOT NULL,
    "document_number" VARCHAR(64) NOT NULL,
    "order_id" UUID,
    "payment_id" UUID,
    "party_type" VARCHAR(32),
    "party_id" UUID,
    "amount" BIGINT NOT NULL,
    "tax_amount" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_ledger" (
    "id" UUID NOT NULL,
    "financial_document_id" UUID,
    "tax_type" "TaxType" NOT NULL,
    "taxable_amount" BIGINT NOT NULL,
    "tax_amount" BIGINT NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "base_currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "exchange_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_runs" (
    "id" UUID NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "matched_count" INTEGER NOT NULL DEFAULT 0,
    "unmatched_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_exceptions" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "external_ref" VARCHAR(128),
    "payment_id" UUID,
    "amount" BIGINT,
    "currency" CHAR(3),
    "detail" JSONB,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "platform" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "ride_id" UUID,
    "order_id" UUID,
    "booking_id" UUID,
    "data" JSONB,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_pricing_configs" (
    "id" UUID NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "payload" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "app_pricing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_sections" (
    "id" UUID NOT NULL,
    "section_key" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" VARCHAR(255),
    "icon_key" VARCHAR(64),
    "icon_color" VARCHAR(32),
    "carousel" BOOLEAN NOT NULL DEFAULT true,
    "recommendation_reason" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "discovery_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_section_items" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "item_type" VARCHAR(32) NOT NULL,
    "target_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_section_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "status" "FeatureFlagStatus" NOT NULL DEFAULT 'DISABLED',
    "percentage" SMALLINT,
    "description" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_windows" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "maintenance_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notes" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "entity_table" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "assigned_to" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_records" (
    "id" UUID NOT NULL,
    "table_name" VARCHAR(64) NOT NULL,
    "record_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actor_id" UUID,
    "actor_type" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "before_data" JSONB,
    "after_data" JSONB,
    "changed_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" VARCHAR(500),
    "trace_id" VARCHAR(64),
    "correlation_id" VARCHAR(64),
    "ip_address" VARCHAR(64),
    "device" VARCHAR(128),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(80) NOT NULL,
    "aggregate_id" VARCHAR(80) NOT NULL,
    "event_name" VARCHAR(128) NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "metadata" JSONB,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "tenant_id" VARCHAR(64),
    "principal_id" UUID,
    "method" VARCHAR(16) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "state" "IdempotencyState" NOT NULL DEFAULT 'IN_PROGRESS',
    "response_code" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery_logs" (
    "id" UUID NOT NULL,
    "destination" VARCHAR(255) NOT NULL,
    "event_name" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "status_code" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_clients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "client_id" VARCHAR(64) NOT NULL,
    "client_secret_hash" CHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "key_prefix" VARCHAR(16) NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "user_credentials_user_id_key" ON "user_credentials"("user_id");

-- CreateIndex
CREATE INDEX "password_history_user_id_created_at_idx" ON "password_history"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "social_identities_user_id_idx" ON "social_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_identities_provider_provider_user_id_key" ON "social_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "devices_user_id_deleted_at_idx" ON "devices"("user_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_fingerprint_key" ON "devices"("user_id", "fingerprint");

-- CreateIndex
CREATE INDEX "login_attempts_identifier_created_at_idx" ON "login_attempts"("identifier", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_user_id_created_at_idx" ON "login_attempts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_ip_created_at_idx" ON "login_attempts"("ip", "created_at");

-- CreateIndex
CREATE INDEX "otp_challenges_identifier_purpose_created_at_idx" ON "otp_challenges"("identifier", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "legal_acceptances_user_id_document_type_idx" ON "legal_acceptances"("user_id", "document_type");

-- CreateIndex
CREATE INDEX "age_verifications_user_id_status_idx" ON "age_verifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "saved_places_user_id_deleted_at_idx" ON "saved_places"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "merchants_owner_user_id_status_idx" ON "merchants"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "merchants_status_featured_idx" ON "merchants"("status", "featured");

-- CreateIndex
CREATE INDEX "merchants_deleted_at_idx" ON "merchants"("deleted_at");

-- CreateIndex
CREATE INDEX "stores_merchant_id_store_type_idx" ON "stores"("merchant_id", "store_type");

-- CreateIndex
CREATE INDEX "stores_store_type_is_active_is_open_idx" ON "stores"("store_type", "is_active", "is_open");

-- CreateIndex
CREATE INDEX "stores_city_store_type_idx" ON "stores"("city", "store_type");

-- CreateIndex
CREATE INDEX "stores_rating_avg_idx" ON "stores"("rating_avg");

-- CreateIndex
CREATE INDEX "stores_deleted_at_idx" ON "stores"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "store_opening_hours_store_id_day_key" ON "store_opening_hours"("store_id", "day");

-- CreateIndex
CREATE INDEX "categories_module_type_is_active_sort_order_idx" ON "categories"("module_type", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "categories_module_type_slug_store_id_key" ON "categories"("module_type", "slug", "store_id");

-- CreateIndex
CREATE INDEX "products_store_id_is_active_in_stock_idx" ON "products"("store_id", "is_active", "in_stock");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_cylinder_type_id_idx" ON "products"("cylinder_type_id");

-- CreateIndex
CREATE INDEX "products_brand_idx" ON "products"("brand");

-- CreateIndex
CREATE INDEX "products_price_amount_idx" ON "products"("price_amount");

-- CreateIndex
CREATE INDEX "products_deleted_at_idx" ON "products"("deleted_at");

-- CreateIndex
CREATE INDEX "menu_categories_store_id_sort_order_idx" ON "menu_categories"("store_id", "sort_order");

-- CreateIndex
CREATE INDEX "menu_items_store_id_is_available_idx" ON "menu_items"("store_id", "is_available");

-- CreateIndex
CREATE INDEX "menu_items_menu_category_id_sort_order_idx" ON "menu_items"("menu_category_id", "sort_order");

-- CreateIndex
CREATE INDEX "menu_items_deleted_at_idx" ON "menu_items"("deleted_at");

-- CreateIndex
CREATE INDEX "modifier_groups_menu_item_id_sort_order_idx" ON "modifier_groups"("menu_item_id", "sort_order");

-- CreateIndex
CREATE INDEX "modifier_options_modifier_group_id_sort_order_idx" ON "modifier_options"("modifier_group_id", "sort_order");

-- CreateIndex
CREATE INDEX "menu_favourites_menu_item_id_idx" ON "menu_favourites"("menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_favourites_user_id_menu_item_id_key" ON "menu_favourites"("user_id", "menu_item_id");

-- CreateIndex
CREATE INDEX "saved_items_kind_target_id_idx" ON "saved_items"("kind", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_items_user_id_kind_target_id_key" ON "saved_items"("user_id", "kind", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_module_type_store_id_key" ON "carts"("user_id", "module_type", "store_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_module_type_created_at_idx" ON "orders"("customer_id", "module_type", "created_at");

-- CreateIndex
CREATE INDEX "orders_store_id_status_created_at_idx" ON "orders"("store_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_payment_status_created_at_idx" ON "orders"("status", "payment_status", "created_at");

-- CreateIndex
CREATE INDEX "orders_rider_id_status_idx" ON "orders"("rider_id", "status");

-- CreateIndex
CREATE INDEX "orders_customer_hidden_at_idx" ON "orders"("customer_hidden_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "riders_user_id_key" ON "riders"("user_id");

-- CreateIndex
CREATE INDEX "riders_is_available_idx" ON "riders"("is_available");

-- CreateIndex
CREATE UNIQUE INDEX "rides_share_token_key" ON "rides"("share_token");

-- CreateIndex
CREATE INDEX "rides_customer_id_created_at_idx" ON "rides"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "rides_rider_id_status_idx" ON "rides"("rider_id", "status");

-- CreateIndex
CREATE INDEX "rides_status_payment_status_created_at_idx" ON "rides"("status", "payment_status", "created_at");

-- CreateIndex
CREATE INDEX "rides_service_type_status_idx" ON "rides"("service_type", "status");

-- CreateIndex
CREATE INDEX "rides_customer_hidden_at_idx" ON "rides"("customer_hidden_at");

-- CreateIndex
CREATE INDEX "ride_status_history_ride_id_created_at_idx" ON "ride_status_history"("ride_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_organizers_user_id_key" ON "event_organizers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_categories_slug_key" ON "event_categories"("slug");

-- CreateIndex
CREATE INDEX "event_categories_is_active_sort_order_idx" ON "event_categories"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "events_merchant_id_status_idx" ON "events"("merchant_id", "status");

-- CreateIndex
CREATE INDEX "events_status_start_at_idx" ON "events"("status", "start_at");

-- CreateIndex
CREATE INDEX "events_city_start_at_idx" ON "events"("city", "start_at");

-- CreateIndex
CREATE INDEX "events_category_id_status_idx" ON "events"("category_id", "status");

-- CreateIndex
CREATE INDEX "events_is_featured_start_at_idx" ON "events"("is_featured", "start_at");

-- CreateIndex
CREATE INDEX "events_deleted_at_idx" ON "events"("deleted_at");

-- CreateIndex
CREATE INDEX "event_ticket_types_event_id_is_active_idx" ON "event_ticket_types"("event_id", "is_active");

-- CreateIndex
CREATE INDEX "event_ticket_types_product_id_idx" ON "event_ticket_types"("product_id");

-- CreateIndex
CREATE INDEX "event_bookings_customer_id_created_at_idx" ON "event_bookings"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "event_bookings_event_id_status_idx" ON "event_bookings"("event_id", "status");

-- CreateIndex
CREATE INDEX "event_bookings_order_id_idx" ON "event_bookings"("order_id");

-- CreateIndex
CREATE INDEX "event_bookings_status_payment_status_idx" ON "event_bookings"("status", "payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "event_tickets_qr_code_key" ON "event_tickets"("qr_code");

-- CreateIndex
CREATE INDEX "event_tickets_booking_id_idx" ON "event_tickets"("booking_id");

-- CreateIndex
CREATE INDEX "event_tickets_status_idx" ON "event_tickets"("status");

-- CreateIndex
CREATE INDEX "reviews_target_type_store_id_idx" ON "reviews"("target_type", "store_id");

-- CreateIndex
CREATE INDEX "reviews_author_id_created_at_idx" ON "reviews"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_order_id_idx" ON "reviews"("order_id");

-- CreateIndex
CREATE INDEX "reviews_ride_id_idx" ON "reviews"("ride_id");

-- CreateIndex
CREATE UNIQUE INDEX "cylinder_types_code_key" ON "cylinder_types"("code");

-- CreateIndex
CREATE INDEX "delivery_constraints_service_type_vehicle_type_enabled_idx" ON "delivery_constraints"("service_type", "vehicle_type", "enabled");

-- CreateIndex
CREATE INDEX "delivery_constraints_effective_from_effective_to_idx" ON "delivery_constraints"("effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "delivery_pricing_rules_service_type_vehicle_type_enabled_pr_idx" ON "delivery_pricing_rules"("service_type", "vehicle_type", "enabled", "priority");

-- CreateIndex
CREATE INDEX "delivery_pricing_rules_cylinder_type_id_enabled_idx" ON "delivery_pricing_rules"("cylinder_type_id", "enabled");

-- CreateIndex
CREATE INDEX "delivery_pricing_rules_effective_from_effective_to_idx" ON "delivery_pricing_rules"("effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "parcel_pricing_profiles_service_type_enabled_idx" ON "parcel_pricing_profiles"("service_type", "enabled");

-- CreateIndex
CREATE INDEX "parcel_pricing_profiles_effective_from_effective_to_idx" ON "parcel_pricing_profiles"("effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "merchant_contracts_merchant_id_enabled_idx" ON "merchant_contracts"("merchant_id", "enabled");

-- CreateIndex
CREATE INDEX "merchant_contracts_service_type_module_type_idx" ON "merchant_contracts"("service_type", "module_type");

-- CreateIndex
CREATE INDEX "merchant_contracts_effective_from_effective_to_idx" ON "merchant_contracts"("effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "cylinder_exchanges_order_id_idx" ON "cylinder_exchanges"("order_id");

-- CreateIndex
CREATE INDEX "settlement_policies_beneficiary_type_enabled_idx" ON "settlement_policies"("beneficiary_type", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "charts_of_accounts_code_key" ON "charts_of_accounts"("code");

-- CreateIndex
CREATE INDEX "accounts_account_type_is_active_idx" ON "accounts"("account_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_chart_of_accounts_id_code_key" ON "accounts"("chart_of_accounts_id", "code");

-- CreateIndex
CREATE INDEX "fiscal_periods_starts_at_ends_at_idx" ON "fiscal_periods"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "accounting_periods_fiscal_period_id_starts_at_idx" ON "accounting_periods"("fiscal_period_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "account_balances_account_id_accounting_period_id_key" ON "account_balances"("account_id", "accounting_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_entry_number_key" ON "journal_entries"("entry_number");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_payment_id_key" ON "journal_entries"("payment_id");

-- CreateIndex
CREATE INDEX "journal_entries_status_value_date_idx" ON "journal_entries"("status", "value_date");

-- CreateIndex
CREATE INDEX "journal_entries_external_ref_idx" ON "journal_entries"("external_ref");

-- CreateIndex
CREATE INDEX "journal_entries_internal_ref_idx" ON "journal_entries"("internal_ref");

-- CreateIndex
CREATE INDEX "journal_lines_account_id_created_at_idx" ON "journal_lines"("account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "journal_lines_journal_entry_id_line_no_key" ON "journal_lines"("journal_entry_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_merchant_id_key" ON "wallets"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_rider_id_key" ON "wallets"("rider_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_organizer_id_key" ON "wallets"("organizer_id");

-- CreateIndex
CREATE INDEX "wallets_owner_type_owner_id_idx" ON "wallets"("owner_type", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_owner_type_owner_id_currency_key" ON "wallets"("owner_type", "owner_id", "currency");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_journal_entry_id_idx" ON "wallet_transactions"("journal_entry_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_payment_id_idx" ON "wallet_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_idx" ON "wallet_transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_provider_status_idx" ON "payments"("provider", "status");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_ride_id_idx" ON "payments"("ride_id");

-- CreateIndex
CREATE INDEX "payments_event_booking_id_idx" ON "payments"("event_booking_id");

-- CreateIndex
CREATE INDEX "payments_customer_id_created_at_idx" ON "payments"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_provider_transactions_payment_id_created_at_idx" ON "payment_provider_transactions"("payment_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_provider_transactions_provider_provider_reference_idx" ON "payment_provider_transactions"("provider", "provider_reference");

-- CreateIndex
CREATE INDEX "payment_provider_transactions_checkout_request_id_idx" ON "payment_provider_transactions"("checkout_request_id");

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "escrow_holds_status_held_at_idx" ON "escrow_holds"("status", "held_at");

-- CreateIndex
CREATE INDEX "escrow_holds_order_id_idx" ON "escrow_holds"("order_id");

-- CreateIndex
CREATE INDEX "escrow_holds_ride_id_idx" ON "escrow_holds"("ride_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_batches_batch_number_key" ON "settlement_batches"("batch_number");

-- CreateIndex
CREATE INDEX "settlement_batches_status_scheduled_for_idx" ON "settlement_batches"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "settlement_items_batch_id_idx" ON "settlement_items"("batch_id");

-- CreateIndex
CREATE INDEX "settlement_items_wallet_id_idx" ON "settlement_items"("wallet_id");

-- CreateIndex
CREATE INDEX "settlements_wallet_id_status_idx" ON "settlements"("wallet_id", "status");

-- CreateIndex
CREATE INDEX "settlements_status_created_at_idx" ON "settlements"("status", "created_at");

-- CreateIndex
CREATE INDEX "refunds_payment_id_status_idx" ON "refunds"("payment_id", "status");

-- CreateIndex
CREATE INDEX "chargebacks_payment_id_status_idx" ON "chargebacks"("payment_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "financial_documents_document_number_key" ON "financial_documents"("document_number");

-- CreateIndex
CREATE INDEX "financial_documents_document_type_issued_at_idx" ON "financial_documents"("document_type", "issued_at");

-- CreateIndex
CREATE INDEX "financial_documents_order_id_idx" ON "financial_documents"("order_id");

-- CreateIndex
CREATE INDEX "financial_documents_payment_id_idx" ON "financial_documents"("payment_id");

-- CreateIndex
CREATE INDEX "tax_ledger_tax_type_created_at_idx" ON "tax_ledger"("tax_type", "created_at");

-- CreateIndex
CREATE INDEX "reconciliation_runs_source_period_start_idx" ON "reconciliation_runs"("source", "period_start");

-- CreateIndex
CREATE INDEX "reconciliation_exceptions_run_id_idx" ON "reconciliation_exceptions"("run_id");

-- CreateIndex
CREATE INDEX "push_tokens_token_idx" ON "push_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_user_id_token_key" ON "push_tokens"("user_id", "token");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_deleted_at_idx" ON "notifications"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_pricing_configs_version_key" ON "app_pricing_configs"("version");

-- CreateIndex
CREATE INDEX "app_pricing_configs_is_active_idx" ON "app_pricing_configs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_sections_section_key_key" ON "discovery_sections"("section_key");

-- CreateIndex
CREATE INDEX "discovery_sections_is_active_sort_order_idx" ON "discovery_sections"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "discovery_section_items_section_id_sort_order_idx" ON "discovery_section_items"("section_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "maintenance_windows_is_active_starts_at_ends_at_idx" ON "maintenance_windows"("is_active", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "admin_notes_entity_table_entity_id_idx" ON "admin_notes"("entity_table", "entity_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_created_at_idx" ON "support_tickets"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_requester_id_idx" ON "support_tickets"("requester_id");

-- CreateIndex
CREATE INDEX "audit_records_table_name_record_id_created_at_idx" ON "audit_records"("table_name", "record_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_records_actor_id_created_at_idx" ON "audit_records"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_records_action_created_at_idx" ON "audit_records"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_records_correlation_id_idx" ON "audit_records"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_id_idx" ON "outbox_events"("aggregate_id");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_key_tenant_id_principal_id_key" ON "idempotency_records"("key", "tenant_id", "principal_id");

-- CreateIndex
CREATE INDEX "webhook_delivery_logs_destination_created_at_idx" ON "webhook_delivery_logs"("destination", "created_at");

-- CreateIndex
CREATE INDEX "webhook_delivery_logs_event_name_created_at_idx" ON "webhook_delivery_logs"("event_name", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_clients_client_id_key" ON "api_clients"("client_id");

-- CreateIndex
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");

-- CreateIndex
CREATE INDEX "api_keys_client_id_idx" ON "api_keys"("client_id");

-- AddForeignKey
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_identities" ADD CONSTRAINT "social_identities_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "age_verifications" ADD CONSTRAINT "age_verifications_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_owner_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_merchant_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_opening_hours" ADD CONSTRAINT "store_opening_hours_store_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_store_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_cylinder_type_fkey" FOREIGN KEY ("cylinder_type_id") REFERENCES "cylinder_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_store_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_fkey" FOREIGN KEY ("menu_category_id") REFERENCES "menu_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_store_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_item_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_group_fkey" FOREIGN KEY ("modifier_group_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_favourites" ADD CONSTRAINT "menu_favourites_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_favourites" ADD CONSTRAINT "menu_favourites_item_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_menu_item_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_rider_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pricing_rule_fkey" FOREIGN KEY ("delivery_pricing_rule_id") REFERENCES "delivery_pricing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_constraint_fkey" FOREIGN KEY ("delivery_constraint_id") REFERENCES "delivery_constraints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riders" ADD CONSTRAINT "riders_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_customer_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_rider_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_courier_fkey" FOREIGN KEY ("courier_partner_id") REFERENCES "courier_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_route_fkey" FOREIGN KEY ("inter_county_route_id") REFERENCES "inter_county_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_pricing_rule_fkey" FOREIGN KEY ("delivery_pricing_rule_id") REFERENCES "delivery_pricing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_parcel_profile_fkey" FOREIGN KEY ("parcel_pricing_profile_id") REFERENCES "parcel_pricing_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_status_history" ADD CONSTRAINT "ride_status_history_ride_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_merchant_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_fkey" FOREIGN KEY ("organizer_id") REFERENCES "event_organizers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_category_fkey" FOREIGN KEY ("category_id") REFERENCES "event_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_ticket_types" ADD CONSTRAINT "event_ticket_types_event_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_ticket_types" ADD CONSTRAINT "event_ticket_types_product_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_event_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_ticket_type_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "event_ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_customer_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_booking_fkey" FOREIGN KEY ("booking_id") REFERENCES "event_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_type_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "event_ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_store_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_menu_item_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rider_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_event_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_ride_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_pricing_rules" ADD CONSTRAINT "delivery_pricing_rules_product_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_pricing_rules" ADD CONSTRAINT "delivery_pricing_rules_cylinder_fkey" FOREIGN KEY ("cylinder_type_id") REFERENCES "cylinder_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_contracts" ADD CONSTRAINT "merchant_contracts_merchant_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinder_exchanges" ADD CONSTRAINT "cylinder_exchanges_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinder_exchanges" ADD CONSTRAINT "cylinder_exchanges_old_fkey" FOREIGN KEY ("old_cylinder_type_id") REFERENCES "cylinder_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinder_exchanges" ADD CONSTRAINT "cylinder_exchanges_new_fkey" FOREIGN KEY ("new_cylinder_type_id") REFERENCES "cylinder_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_chart_fkey" FOREIGN KEY ("chart_of_accounts_id") REFERENCES "charts_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_fiscal_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_account_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_period_fkey" FOREIGN KEY ("accounting_period_id") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_period_fkey" FOREIGN KEY ("accounting_period_id") REFERENCES "accounting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reverses_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_merchant_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_rider_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_organizer_fkey" FOREIGN KEY ("organizer_id") REFERENCES "event_organizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_ride_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_fkey" FOREIGN KEY ("event_booking_id") REFERENCES "event_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_transactions" ADD CONSTRAINT "payment_provider_tx_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_ride_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_policy_fkey" FOREIGN KEY ("settlement_policy_id") REFERENCES "settlement_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_batch_fkey" FOREIGN KEY ("batch_id") REFERENCES "settlement_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_wallet_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_batch_fkey" FOREIGN KEY ("batch_id") REFERENCES "settlement_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_policy_fkey" FOREIGN KEY ("settlement_policy_id") REFERENCES "settlement_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_payment_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_ledger" ADD CONSTRAINT "tax_ledger_document_fkey" FOREIGN KEY ("financial_document_id") REFERENCES "financial_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_run_fkey" FOREIGN KEY ("run_id") REFERENCES "reconciliation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_section_items" ADD CONSTRAINT "discovery_section_items_section_fkey" FOREIGN KEY ("section_id") REFERENCES "discovery_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_author_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_client_fkey" FOREIGN KEY ("client_id") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

