import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateTappayWalletsTable1711200100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tappay_wallets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
            isPrimary: true,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'wallet_number',
            type: 'varchar',
            length: '50',
            isNullable: false,
            isUnique: true,
            comment: 'Formatted wallet number e.g., TAPPAY-0318-1608-2105',
          },
          {
            name: 'balance',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
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
            name: 'pin_hash',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Hashed 4-6 digit PIN for payment authorization',
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
      'tappay_wallets',
      new TableForeignKey({
        name: 'FK_TAPPAY_WALLETS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'tappay_users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'tappay_wallets',
      new TableIndex({
        name: 'IDX_TAPPAY_WALLETS_NUMBER',
        columnNames: ['wallet_number'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tappay_wallets');
  }
}
