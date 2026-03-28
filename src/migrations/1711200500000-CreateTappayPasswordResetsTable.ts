import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateTappayPasswordResetsTable1711200500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tappay_password_resets',
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
          },
          {
            name: 'otp_token',
            type: 'varchar',
            length: '255',
            isNullable: false,
            isUnique: true,
            comment: 'Short-lived token for password reset (10 min expiry)',
          },
          {
            name: 'is_used',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: false,
          },
          {
            name: 'used_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'created_at',
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
      'tappay_password_resets',
      new TableForeignKey({
        name: 'FK_TAPPAY_PASSWORD_RESETS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'tappay_users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'tappay_password_resets',
      new TableIndex({
        name: 'IDX_TAPPAY_PASSWORD_RESETS_TOKEN',
        columnNames: ['otp_token'],
      }),
    );

    await queryRunner.createIndex(
      'tappay_password_resets',
      new TableIndex({
        name: 'IDX_TAPPAY_PASSWORD_RESETS_EXPIRES_AT',
        columnNames: ['expires_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tappay_password_resets');
  }
}
