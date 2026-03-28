import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateTappayTransactionsTable1711200200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tappay_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
            isPrimary: true,
          },
          {
            name: 'wallet_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['debit', 'credit'],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'completed', 'failed'],
            default: 'pending',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: 'KES',
            isNullable: false,
          },
          {
            name: 'category',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'merchant_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'recipient_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'recipient_phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'reference',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment: 'Transaction reference number',
          },
          {
            name: 'note',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'send, topup, qr, etc.',
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'Dialog, Mobitel, Airtel, Hutch for topups',
          },
          {
            name: 'qr_data',
            type: 'text',
            isNullable: true,
            comment: 'Raw QR code data for QR payments',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'tappay_transactions',
      new TableForeignKey({
        name: 'FK_TAPPAY_TRANSACTIONS_WALLET',
        columnNames: ['wallet_id'],
        referencedTableName: 'tappay_wallets',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'tappay_transactions',
      new TableIndex({
        name: 'IDX_TAPPAY_TRANSACTIONS_WALLET',
        columnNames: ['wallet_id'],
      }),
    );

    await queryRunner.createIndex(
      'tappay_transactions',
      new TableIndex({
        name: 'IDX_TAPPAY_TRANSACTIONS_TYPE',
        columnNames: ['type'],
      }),
    );

    await queryRunner.createIndex(
      'tappay_transactions',
      new TableIndex({
        name: 'IDX_TAPPAY_TRANSACTIONS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'tappay_transactions',
      new TableIndex({
        name: 'IDX_TAPPAY_TRANSACTIONS_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'tappay_transactions',
      new TableIndex({
        name: 'IDX_TAPPAY_TRANSACTIONS_REFERENCE',
        columnNames: ['reference'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tappay_transactions');
  }
}
