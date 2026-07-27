import {
  Injectable,
  Logger,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QuotaConfig } from './entities/quota-config.entity';
import { QuotaUsage, QuotaResourceType } from './entities/quota-usage.entity';

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    @InjectRepository(QuotaConfig)
    private readonly configRepo: Repository<QuotaConfig>,
    @InjectRepository(QuotaUsage)
    private readonly usageRepo: Repository<QuotaUsage>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /** Returns the quota config for a tenant, or null if none configured. */
  async getConfig(tenantId: string): Promise<QuotaConfig | null> {
    return this.configRepo.findOne({ where: { tenantId } });
  }

  /** Upserts a quota config for a tenant. */
  async setConfig(
    tenantId: string,
    config: Partial<
      Omit<QuotaConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<QuotaConfig> {
    const existing = await this.configRepo.findOne({ where: { tenantId } });
    if (existing) {
      Object.assign(existing, config);
      return this.configRepo.save(existing);
    }
    return this.configRepo.save(
      this.configRepo.create({ tenantId, ...config }),
    );
  }

  /** Computes the start of the current quota period for a given config. */
  getPeriodStart(config: QuotaConfig, now = new Date()): Date {
    const periodMs = config.periodSeconds * 1000;
    const periodStart = new Date(
      Math.floor(now.getTime() / periodMs) * periodMs,
    );
    return periodStart;
  }

  /**
   * Atomically checks and increments the quest creation quota for a tenant.
   *
   * Uses a single atomic UPDATE with a WHERE guard to eliminate the TOCTOU
   * race between the quota check and the increment. If the UPDATE affects 0
   * rows, the quota is exceeded.
   * Throws ForbiddenException if the limit is exceeded.
   */
  async enforceQuestCreationQuota(tenantId: string): Promise<void> {
    const config = await this.getConfig(tenantId);
    if (!config || config.maxQuestsPerPeriod === null) return;

    const periodStart = this.getPeriodStart(config);
    const limit = config.maxQuestsPerPeriod;

    // Ensure the usage row exists.
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(QuotaUsage)
      .values({ tenantId, resourceType: QuotaResourceType.QUEST, periodStart })
      .orIgnore()
      .execute();

    // Atomic increment with guard: only increments if under limit.
    const result = await this.dataSource
      .createQueryBuilder()
      .update(QuotaUsage)
      .set({ questCount: () => '"questCount" + 1' })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('resourceType = :rt', { rt: QuotaResourceType.QUEST })
      .andWhere('periodStart = :ps', { ps: periodStart })
      .andWhere('"questCount" < :limit', { limit })
      .execute();

    if (result.affected === 0) {
      this.logger.warn(
        `Tenant ${tenantId} exceeded quest quota (limit: ${limit})`,
      );
      throw new ForbiddenException(
        `Quest creation quota exceeded (${limit} per period)`,
      );
    }
  }

  /**
   * Atomically checks and increments the payout quota for a tenant.
   *
   * The single-payout check is stateless and runs outside the transaction.
   * The period-total check and increment use a single atomic UPDATE with a
   * WHERE guard, eliminating the TOCTOU race.
   * Throws ForbiddenException if any limit is exceeded.
   */
  async enforcePayoutQuota(tenantId: string, amount: number): Promise<void> {
    const config = await this.getConfig(tenantId);
    if (!config) return;

    if (
      config.maxSinglePayoutAmount !== null &&
      amount > config.maxSinglePayoutAmount
    ) {
      throw new ForbiddenException(
        `Payout amount ${amount} exceeds single payout limit of ${config.maxSinglePayoutAmount}`,
      );
    }

    if (config.maxPayoutAmountPerPeriod === null) return;

    const periodStart = this.getPeriodStart(config);
    const limit = config.maxPayoutAmountPerPeriod;

    // Ensure the usage row exists.
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(QuotaUsage)
      .values({
        tenantId,
        resourceType: QuotaResourceType.PAYOUT,
        periodStart,
      })
      .orIgnore()
      .execute();

    // Atomic increment with guard: only adds amount if under limit.
    const result = await this.dataSource
      .createQueryBuilder()
      .update(QuotaUsage)
      .set({ payoutAmount: () => '"payoutAmount" + :amount' })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('resourceType = :rt', { rt: QuotaResourceType.PAYOUT })
      .andWhere('periodStart = :ps', { ps: periodStart })
      .andWhere('"payoutAmount" + :amount <= :limit', { amount, limit })
      .setParameter('amount', amount)
      .execute();

    if (result.affected === 0) {
      this.logger.warn(
        `Tenant ${tenantId} exceeded payout quota (limit: ${limit})`,
      );
      throw new ForbiddenException(
        `Payout quota exceeded (period limit: ${limit})`,
      );
    }
  }
}
