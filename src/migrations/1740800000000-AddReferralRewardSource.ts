import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralRewardSource1740800000000 implements MigrationInterface {
  name = 'AddReferralRewardSource1740800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE reward_source_type_enum AS ENUM ('task_completion', 'referral');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Add sourceType column
    const hasSourceType = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'reward_transactions' AND column_name = 'sourceType'
    `);
    if (hasSourceType.length === 0) {
      await queryRunner.query(`
        ALTER TABLE reward_transactions
        ADD COLUMN "sourceType" reward_source_type_enum NOT NULL DEFAULT 'task_completion'
      `);
    }

    // 3. Add referralRecordId column
    const hasReferralRecordId = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'reward_transactions' AND column_name = 'referralRecordId'
    `);
    if (hasReferralRecordId.length === 0) {
      await queryRunner.query(`
        ALTER TABLE reward_transactions
        ADD COLUMN "referralRecordId" UUID NULL
      `);
    }

    // 4. Add FK constraint for referralRecordId
    const hasFk = await queryRunner.query(`
      SELECT conname FROM pg_constraint
      WHERE conname = 'FK_reward_transactions_referral_record'
    `);
    if (hasFk.length === 0) {
      await queryRunner.query(`
        ALTER TABLE reward_transactions
        ADD CONSTRAINT FK_reward_transactions_referral_record
        FOREIGN KEY ("referralRecordId") REFERENCES referral_records(id)
        ON DELETE SET NULL
      `);
    }

    // 5. Add unique index on referral_records.referred_id
    const hasUniqueIndex = await queryRunner.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'referral_records' AND indexname = 'UQ_referral_records_referred_id'
    `);
    if (hasUniqueIndex.length === 0) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX UQ_referral_records_referred_id
        ON referral_records (referred_id)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE reward_transactions DROP CONSTRAINT IF EXISTS FK_reward_transactions_referral_record`
    );
    await queryRunner.query(
      `ALTER TABLE reward_transactions DROP COLUMN IF EXISTS "referralRecordId"`
    );
    await queryRunner.query(
      `ALTER TABLE reward_transactions DROP COLUMN IF EXISTS "sourceType"`
    );
    await queryRunner.query(`DROP TYPE IF EXISTS reward_source_type_enum`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS UQ_referral_records_referred_id`
    );
  }
}
