import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateTappayRefreshTokensTable1711200600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tappay_refresh_tokens',
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
            name: 'token_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'SHA256 hash of the refresh token',
          },
          {
            name: 'device_info',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'is_revoked',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: false,
            comment: '30 days from issuance',
          },
          {
            name: 'revoked_at',
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
      'tappay_refresh_tokens',
      new TableForeignKey({
        name: 'FK_TAPPAY_REFRESH_TOKENS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'tappay_users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'tappay_refresh_tokens',
      new TableIndex({
        name: 'IDX_TAPPAY_REFRESH_TOKENS_USER',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'tappay_refresh_tokens',
      new TableIndex({
        name: 'IDX_TAPPAY_REFRESH_TOKENS_HASH',
        columnNames: ['token_hash'],
      }),
    );

    await queryRunner.createIndex(
      'tappay_refresh_tokens',
      new TableIndex({
        name: 'IDX_TAPPAY_REFRESH_TOKENS_EXPIRES_AT',
        columnNames: ['expires_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tappay_refresh_tokens');
  }
}
