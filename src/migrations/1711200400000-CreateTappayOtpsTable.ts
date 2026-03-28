import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateTappayOtpsTable1711200400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tappay_otps',
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
            isNullable: true,
            comment: 'Null for forgot-password OTPs before user is identified',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'code',
            type: 'varchar',
            length: '6',
            isNullable: false,
            comment: '6-digit OTP code',
          },
          {
            name: 'purpose',
            type: 'enum',
            enum: ['signup', 'login', 'forgot', 'payment'],
            isNullable: false,
          },
          {
            name: 'is_used',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'attempts',
            type: 'int',
            default: 0,
            isNullable: false,
            comment: 'Number of verification attempts',
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: false,
            comment: 'OTP expires after 60 seconds',
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
      'tappay_otps',
      new TableForeignKey({
        name: 'FK_TAPPAY_OTPS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'tappay_users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'tappay_otps',
      new TableIndex({
        name: 'IDX_TAPPAY_OTPS_EMAIL',
        columnNames: ['email'],
      }),
    );

    await queryRunner.createIndex(
      'tappay_otps',
      new TableIndex({
        name: 'IDX_TAPPAY_OTPS_CODE',
        columnNames: ['code'],
      }),
    );

    await queryRunner.createIndex(
      'tappay_otps',
      new TableIndex({
        name: 'IDX_TAPPAY_OTPS_EXPIRES_AT',
        columnNames: ['expires_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tappay_otps');
  }
}
