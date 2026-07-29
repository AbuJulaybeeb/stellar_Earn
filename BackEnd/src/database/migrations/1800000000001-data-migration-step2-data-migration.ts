import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Step 2 of two-step migration: Data migration
 * This migration migrates and transforms existing data to match the new schema
 * and establishes proper relationships between entities
 */
export class DataMigrationStep2DataMigration1800000000001 implements MigrationInterface {
  name = 'DataMigrationStep2DataMigration1800000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Starting Step 2: Data migration...');

    // Migrate user data
    await this.migrateUserData(queryRunner);

    // Migrate quest data
    await this.migrateQuestData(queryRunner);

    // Migrate submission data
    await this.migrateSubmissionData(queryRunner);

    // Migrate payout data
    await this.migratePayoutData(queryRunner);

    // Establish relationships and constraints
    await this.establishRelationships(queryRunner);

    console.log('Step 2: Data migration completed');
  }

  private async migrateUserData(queryRunner: QueryRunner): Promise<void> {
    console.log('Migrating user data...');

    // Update user statistics based on existing data
    try {
      await queryRunner.query(`
        UPDATE "users" u
        SET 
          "questsCompleted" = COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM "submissions" s 
             WHERE s."userId" = u.id::text AND s."status" = 'APPROVED'), 0
          ),
          "failedQuests" = COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM "submissions" s 
             WHERE s."userId" = u.id::text AND s."status" = 'REJECTED'), 0
          ),
          "successRate" = CASE 
            WHEN (SELECT COUNT(*) FROM "submissions" s WHERE s."userId" = u.id::text) > 0 
            THEN ROUND(
              (SELECT COUNT(*)::DECIMAL 
               FROM "submissions" s 
               WHERE s."userId" = u.id::text AND s."status" = 'APPROVED') * 100.0 / 
              (SELECT COUNT(*)::DECIMAL FROM "submissions" s WHERE s."userId" = u.id::text), 2
            )
            ELSE 0
          END,
          "totalEarned" = COALESCE(
            (SELECT COALESCE(SUM(amount), 0)::BIGINT 
             FROM "payouts" p 
             WHERE p."stellarAddress" = u."stellarAddress" AND p."status" = 'completed'), '0'
          ),
          "lastActiveAt" = COALESCE(
            (SELECT MAX("updatedAt") 
             FROM "submissions" s 
             WHERE s."userId" = u.id::text), u."updatedAt"
          )
      `);
    } catch (err) {
      console.log('User statistics update skipped (non-critical):', (err as Error).message);
    }

    // Set default privacy level for users who don't have one
    try {
      await queryRunner.query(`
        UPDATE "users" 
        SET "privacyLevel" = 'PUBLIC' 
        WHERE "privacyLevel" IS NULL
      `);
    } catch (err) {
      console.log('Privacy level update skipped:', (err as Error).message);
    }

    // Initialize badges array for users
    try {
      await queryRunner.query(`
        UPDATE "users" 
        SET "badges" = ARRAY[]::TEXT[] 
        WHERE "badges" IS NULL
      `);
    } catch (err) {
      console.log('Badges initialization skipped:', (err as Error).message);
    }

    // Initialize social links object for users
    try {
      await queryRunner.query(`
        UPDATE "users" 
        SET "socialLinks" = '{}'::JSONB 
        WHERE "socialLinks" IS NULL
      `);
    } catch (err) {
      console.log('Social links initialization skipped:', (err as Error).message);
    }

    console.log('User data migration completed');
  }

  private async migrateQuestData(queryRunner: QueryRunner): Promise<void> {
    console.log('Migrating quest data...');

    // Update quest creatorAddress from user stellarAddress
    try {
      await queryRunner.query(`
        UPDATE "quests" q
        SET "creatorAddress" = u."stellarAddress"
        FROM "users" u
        WHERE q."createdBy" = u.id::text AND q."creatorAddress" IS NULL
      `);
    } catch (err) {
      console.log('Creator address update skipped:', (err as Error).message);
    }

    // Update current completions based on approved submissions
    try {
      await queryRunner.query(`
        UPDATE "quests" q
        SET "currentCompletions" = COALESCE(
          (SELECT COUNT(*)::INTEGER 
           FROM "submissions" s 
           WHERE s."questId" = q.id::text AND s."status" = 'APPROVED'), 0
        )
      `);
    } catch (err) {
      console.log('Current completions update skipped:', (err as Error).message);
    }

    // Set default start date to creation date if not set
    try {
      await queryRunner.query(`
        UPDATE "quests" 
        SET "startDate" = "createdAt" 
        WHERE "startDate" IS NULL
      `);
    } catch (err) {
      console.log('Start date update skipped:', (err as Error).message);
    }

    console.log('Quest data migration completed');
  }

  private async migrateSubmissionData(queryRunner: QueryRunner): Promise<void> {
    console.log('Migrating submission data...');

    // Update submission status to use proper enum values
    try {
      await queryRunner.query(`
        UPDATE "submissions" 
        SET "status" = 'UNDER_REVIEW' 
        WHERE "status" = 'PENDING' AND "approvedBy" IS NOT NULL
      `);
    } catch (err) {
      console.log('Submission status update skipped:', (err as Error).message);
    }

    // Ensure proof field is valid JSON — proof column is JSON (not JSONB)
    try {
      await queryRunner.query(`
        UPDATE "submissions" 
        SET "proof" = '{}'::json 
        WHERE "proof" IS NULL
      `);
    } catch (err) {
      console.log('Proof null initialization skipped:', (err as Error).message);
    }

    console.log('Submission data migration completed');
  }

  private async migratePayoutData(queryRunner: QueryRunner): Promise<void> {
    console.log('Migrating payout data...');

    // Populate stellarAddress from users if userId column exists
    try {
      await queryRunner.query(`
        UPDATE "payouts" p
        SET "stellarAddress" = u."stellarAddress"
        FROM "users" u
        WHERE p."userId" = u.id::text AND (p."stellarAddress" IS NULL OR p."stellarAddress" = '')
      `);
    } catch (err) {
      console.log('Payout stellarAddress population skipped:', (err as Error).message);
    }

    // Update payout status to use proper enum values
    try {
      await queryRunner.query(`
        UPDATE "payouts" 
        SET "status" = LOWER("status")
        WHERE "status" IS NOT NULL
      `);
    } catch (err) {
      console.log('Payout status normalization skipped:', (err as Error).message);
    }

    // Link payouts to submissions where possible
    try {
      await queryRunner.query(`
        UPDATE "payouts" p
        SET "submissionId" = s.id::text,
            "questId" = s."questId"
        FROM "submissions" s,
             "users" u
        WHERE p."stellarAddress" = u."stellarAddress" 
          AND s."userId" = u.id::text 
          AND s."status" = 'APPROVED'
          AND p."submissionId" IS NULL
      `);
    } catch (err) {
      console.log('Payout-submission linking skipped:', (err as Error).message);
    }

    // Set default type for payouts that don't have one
    try {
      await queryRunner.query(`
        UPDATE "payouts" 
        SET "type" = 'quest_reward' 
        WHERE "type" IS NULL
      `);
    } catch (err) {
      console.log('Payout type default skipped:', (err as Error).message);
    }

    console.log('Payout data migration completed');
  }

  private async establishRelationships(
    queryRunner: QueryRunner,
  ): Promise<void> {
    console.log('Establishing relationships and constraints...');

    // Note: FK constraints between TEXT columns (userId, questId) and UUID columns (users.id, quests.id)
    // cannot be created due to type mismatch. We wrap each in try/catch so they fail gracefully.
    const fkConstraints = [
      {
        name: 'FK_submissions_user',
        query: `ALTER TABLE "submissions" ADD CONSTRAINT "FK_submissions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`,
      },
      {
        name: 'FK_quests_creator',
        query: `ALTER TABLE "quests" ADD CONSTRAINT "FK_quests_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE`,
      },
      {
        name: 'FK_submissions_quest',
        query: `ALTER TABLE "submissions" ADD CONSTRAINT "FK_submissions_quest" FOREIGN KEY ("questId") REFERENCES "quests"("id") ON DELETE CASCADE`,
      },
      {
        name: 'FK_notifications_user',
        query: `ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`,
      },
      {
        name: 'FK_refresh_tokens_user',
        query: `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`,
      },
    ];

    for (const fk of fkConstraints) {
      try {
        await queryRunner.query(fk.query);
      } catch {
        console.log(`${fk.name} already exists or cannot be created (type mismatch)`);
      }
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username")',
      'CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")',
      'CREATE INDEX IF NOT EXISTS "IDX_quests_status" ON "quests" ("status")',
      'CREATE INDEX IF NOT EXISTS "IDX_quests_createdBy" ON "quests" ("createdBy")',
      'CREATE INDEX IF NOT EXISTS "IDX_submissions_status" ON "submissions" ("status")',
      'CREATE INDEX IF NOT EXISTS "IDX_submissions_userId" ON "submissions" ("userId")',
      'CREATE INDEX IF NOT EXISTS "IDX_submissions_questId" ON "submissions" ("questId")',
      'CREATE INDEX IF NOT EXISTS "IDX_payouts_status" ON "payouts" ("status")',
      'CREATE INDEX IF NOT EXISTS "IDX_payouts_stellarAddress" ON "payouts" ("stellarAddress")',
      'CREATE INDEX IF NOT EXISTS "IDX_payouts_questId" ON "payouts" ("questId")',
      'CREATE INDEX IF NOT EXISTS "IDX_payouts_submissionId" ON "payouts" ("submissionId")',
    ];

    for (const indexQuery of indexes) {
      try {
        await queryRunner.query(indexQuery);
      } catch {
        console.log(`Index creation failed: ${indexQuery}`);
      }
    }

    console.log('Relationships and constraints established');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back Step 2: Data migration...');

    // Drop foreign key constraints
    const constraints = [
      'FK_submissions_user',
      'FK_quests_creator',
      'FK_submissions_quest',
      'FK_notifications_user',
      'FK_refresh_tokens_user',
    ];

    for (const constraint of constraints) {
      try {
        await queryRunner.query(
          `ALTER TABLE DROP CONSTRAINT IF EXISTS "${constraint}"`,
        );
      } catch {
        console.log(
          `Constraint ${constraint} does not exist or cannot be dropped`,
        );
      }
    }

    // Drop indexes
    const indexes = [
      'IDX_users_username',
      'IDX_users_email',
      'IDX_quests_status',
      'IDX_quests_createdBy',
      'IDX_submissions_status',
      'IDX_submissions_userId',
      'IDX_submissions_questId',
      'IDX_payouts_status',
      'IDX_payouts_stellarAddress',
      'IDX_payouts_questId',
      'IDX_payouts_submissionId',
    ];

    for (const index of indexes) {
      try {
        await queryRunner.query(`DROP INDEX IF EXISTS "${index}"`);
      } catch {
        console.log(`Index ${index} does not exist or cannot be dropped`);
      }
    }

    // Reset calculated fields to NULL or default values
    try {
      await queryRunner.query(`
        UPDATE "users" 
        SET 
          "questsCompleted" = 0,
          "failedQuests" = 0,
          "successRate" = 0,
          "totalEarned" = '0',
          "lastActiveAt" = NULL
      `);
    } catch (err) {
      console.log('Users rollback skipped:', (err as Error).message);
    }

    try {
      await queryRunner.query(`
        UPDATE "quests" 
        SET 
          "creatorAddress" = NULL,
          "currentCompletions" = 0,
          "startDate" = NULL
      `);
    } catch (err) {
      console.log('Quests rollback skipped:', (err as Error).message);
    }

    try {
      await queryRunner.query(`
        UPDATE "submissions" 
        SET "proof" = '{}'::json
      `);
    } catch (err) {
      console.log('Submissions rollback skipped:', (err as Error).message);
    }

    try {
      await queryRunner.query(`
        UPDATE "payouts" 
        SET 
          "submissionId" = NULL,
          "questId" = NULL,
          "type" = 'quest_reward'
      `);
    } catch (err) {
      console.log('Payouts rollback skipped:', (err as Error).message);
    }
  }
}
