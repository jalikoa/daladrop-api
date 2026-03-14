import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class InitialSchema1773464660676 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create Schemas
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS identity`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS merchant`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS payments`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS ledger`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS notifications`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS audit`);

    // 2. Identity: Users
    await queryRunner.createTable(
      new Table({
        name: 'users',
        schema: 'identity',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'uuid', type: 'char', length: '36', isUnique: true },
          { name: 'email', type: 'varchar', length: '255', isUnique: true, isNullable: true },
          { name: 'phone_number', type: 'varchar', length: '20', isUnique: true, isNullable: true },
          { name: 'password_hash', type: 'varchar', length: '255' },
          { name: 'role', type: 'enum', enum: ['ADMIN', 'MERCHANT', 'CUSTOMER'], default: 'CUSTOMER' },
          { name: 'status', type: 'enum', enum: ['ACTIVE', 'SUSPENDED', 'DELETED'], default: 'ACTIVE' },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    // ✅ FIXED: createIndex takes (tableName, indexObject) - use 'schema.table' format
    await queryRunner.createIndex(
      'identity.users',
      new TableIndex({ name: 'idx_users_email', columnNames: ['email'] }),
    );
    await queryRunner.createIndex(
      'identity.users',
      new TableIndex({ name: 'idx_users_phone', columnNames: ['phone_number'] }),
    );

    // 3. Merchant: Profiles
    await queryRunner.createTable(
      new Table({
        name: 'merchant_profiles',
        schema: 'merchant',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'user_id', type: 'bigint' },
          { name: 'business_name', type: 'varchar', length: '255' },
          { name: 'business_email', type: 'varchar', length: '255', isNullable: true },
          { name: 'business_phone', type: 'varchar', length: '20', isNullable: true },
          { name: 'logo_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'paybill_number', type: 'varchar', length: '20', isNullable: true },
          { name: 'account_number', type: 'varchar', length: '20', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    // ✅ FIXED: createForeignKey takes (tableName, fkObject) - schema in referencedSchema property
    await queryRunner.createForeignKey(
      'merchant.merchant_profiles',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedSchema: 'identity', // ✅ This stays in the FK object
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 4. Merchant: NFC Tags
    await queryRunner.createTable(
      new Table({
        name: 'nfc_tags',
        schema: 'merchant',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'merchant_id', type: 'bigint' },
          { name: 'tag_uid', type: 'varchar', length: '100', isNullable: true },
          { name: 'encrypted_payload', type: 'text' },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'merchant.nfc_tags',
      new TableForeignKey({
        columnNames: ['merchant_id'],
        referencedTableName: 'merchant_profiles',
        referencedSchema: 'merchant',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 5. Merchant: Cards
    await queryRunner.createTable(
      new Table({
        name: 'merchant_cards',
        schema: 'merchant',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'merchant_id', type: 'bigint' },
          { name: 'qr_code_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'pdf_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'merchant.merchant_cards',
      new TableForeignKey({
        columnNames: ['merchant_id'],
        referencedTableName: 'merchant_profiles',
        referencedSchema: 'merchant',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 6. Payments: Sessions
    await queryRunner.createTable(
      new Table({
        name: 'payment_sessions',
        schema: 'payments',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'session_uuid', type: 'char', length: '36', isUnique: true },
          { name: 'merchant_id', type: 'bigint' },
          { name: 'customer_phone', type: 'varchar', length: '20', isNullable: true },
          { name: 'amount', type: 'decimal', precision: 15, scale: 2 },
          { name: 'status', type: 'enum', enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'], default: 'PENDING' },
          { name: 'checkout_request_id', type: 'varchar', length: '100', isUnique: true, isNullable: true },
          { name: 'mpesa_receipt', type: 'varchar', length: '50', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'completed_at', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'payments.payment_sessions',
      new TableForeignKey({
        columnNames: ['merchant_id'],
        referencedTableName: 'merchant_profiles',
        referencedSchema: 'merchant',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE', // ✅ Added for consistency
      }),
    );

    // 7. Payments: Callbacks
    await queryRunner.createTable(
      new Table({
        name: 'payment_callbacks',
        schema: 'payments',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'checkout_request_id', type: 'varchar', length: '100' },
          { name: 'mpesa_receipt_number', type: 'varchar', length: '50', isNullable: true },
          { name: 'result_code', type: 'int', isNullable: true },
          { name: 'result_desc', type: 'text', isNullable: true },
          { name: 'payload', type: 'json', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    // 8. Ledger: Accounts
    await queryRunner.createTable(
      new Table({
        name: 'ledger_accounts',
        schema: 'ledger',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'code', type: 'varchar', length: '20', isUnique: true },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'account_type', type: 'enum', enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] },
          { name: 'currency', type: 'varchar', length: '3', default: 'KES' },
          { name: 'balance', type: 'decimal', precision: 18, scale: 2, default: 0 },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    // 9. Ledger: Entries
    await queryRunner.createTable(
      new Table({
        name: 'ledger_entries',
        schema: 'ledger',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'transaction_ref', type: 'varchar', length: '100' },
          { name: 'account_id', type: 'bigint' },
          { name: 'entry_type', type: 'enum', enum: ['DEBIT', 'CREDIT'] },
          { name: 'amount', type: 'decimal', precision: 18, scale: 2 },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'metadata', type: 'json', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'ledger.ledger_entries',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedTableName: 'ledger_accounts',
        referencedSchema: 'ledger',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 10. Notifications
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        schema: 'notifications',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'user_id', type: 'bigint', isNullable: true },
          { name: 'channel', type: 'enum', enum: ['SMS', 'EMAIL', 'PUSH'] },
          { name: 'message', type: 'text', isNullable: true },
          { name: 'status', type: 'enum', enum: ['QUEUED', 'SENT', 'FAILED'], default: 'QUEUED' },
          { name: 'provider', type: 'varchar', length: '50', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'notifications.notifications',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedSchema: 'identity',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 11. Audit Logs
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        schema: 'audit',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'user_id', type: 'bigint', isNullable: true },
          { name: 'action', type: 'varchar', length: '255', isNullable: true },
          { name: 'ip_address', type: 'varchar', length: '45', isNullable: true },
          { name: 'request_method', type: 'varchar', length: '10', isNullable: true },
          { name: 'endpoint', type: 'varchar', length: '255', isNullable: true },
          { name: 'payload', type: 'json', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'audit.audit_logs',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedSchema: 'identity',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 12. Seed Ledger Accounts (Critical)
    await queryRunner.query(`
      INSERT INTO ledger.ledger_accounts (code, name, account_type, balance) VALUES
      ('1001', 'M-Pesa Clearing', 'ASSET', 0.00),
      ('2001', 'Merchant Wallets', 'LIABILITY', 0.00),
      ('4001', 'Platform Fees', 'REVENUE', 0.00),
      ('3001', 'Cash On Hand', 'ASSET', 0.00)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ✅ FIXED: dropTable takes 'schema.table' as single string, then optional boolean flags
    await queryRunner.dropTable('audit.audit_logs', true);
    await queryRunner.dropTable('notifications.notifications', true);
    await queryRunner.dropTable('ledger.ledger_entries', true);
    await queryRunner.dropTable('ledger.ledger_accounts', true);
    await queryRunner.dropTable('payments.payment_callbacks', true);
    await queryRunner.dropTable('payments.payment_sessions', true);
    await queryRunner.dropTable('merchant.merchant_cards', true);
    await queryRunner.dropTable('merchant.nfc_tags', true);
    await queryRunner.dropTable('merchant.merchant_profiles', true);
    await queryRunner.dropTable('identity.users', true);

    // Drop Schemas
    await queryRunner.query(`DROP SCHEMA IF EXISTS audit`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS notifications`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS ledger`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS payments`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS merchant`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS identity`);
  }
}