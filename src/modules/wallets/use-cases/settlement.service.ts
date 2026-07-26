import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  AuditAction,
  PaymentProvider,
  Prisma,
  SettlementBatchStatus,
  SettlementStatus,
  type Settlement,
  type SettlementBatch,
  type SettlementItem,
  type SettlementPolicy,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kesFromBigInt } from '../../../shared/money';
import { PostingEngineService } from '../../accounting/use-cases/posting-engine.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import {
  selectEligibleWallets,
  sumSettlementAmount,
} from '../domain/settlement-batch-assembly';
import { isPastCutoff, nextScheduledFor } from '../domain/settlement-policy';
import { WalletService } from './wallet.service';

const APPROVAL_TAG_PREFIX = 'approved:';
const IDEMPOTENCY_REF_PREFIX = 'idem:settle:';

export interface CreateBatchFromPolicyOptions {
  readonly actorId: string;
  readonly idempotencyKey?: string;
  readonly scheduledFor?: Date;
  readonly force?: boolean;
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
    private readonly postingEngine: PostingEngineService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  public async listPolicies() {
    const rows = await this.prisma.settlementPolicy.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return { success: true as const, items: rows.map((row) => this.policyView(row)) };
  }

  public async getPolicy(id: string) {
    const row = await this.prisma.settlementPolicy.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Settlement policy not found');
    return { success: true as const, policy: this.policyView(row) };
  }

  /**
   * Creates a PENDING batch from an enabled policy: finds wallets of the
   * policy's beneficiary type/currency at/above the minimum amount, and
   * snapshots one SettlementItem per eligible wallet.
   */
  public async createBatchFromPolicy(
    policyId: string,
    opts: CreateBatchFromPolicyOptions,
  ) {
    const policy = await this.prisma.settlementPolicy.findUnique({
      where: { id: policyId },
    });
    if (!policy) throw new NotFoundException('Settlement policy not found');
    if (!policy.enabled) {
      throw new BadRequestException(`Settlement policy "${policy.name}" is disabled`);
    }

    const key = opts.idempotencyKey?.trim();
    const externalRef = key ? `${IDEMPOTENCY_REF_PREFIX}${key}` : null;
    if (externalRef) {
      const existing = await this.prisma.settlementBatch.findFirst({
        where: { externalRef },
        include: { items: true },
      });
      if (existing) {
        return {
          success: true as const,
          idempotent: true as const,
          batch: this.batchView(existing),
        };
      }
    }

    if (!opts.force && !isPastCutoff(policy, new Date())) {
      throw new BadRequestException(
        `Settlement policy "${policy.name}" has not reached its cutoff yet ` +
          `(next scheduled ${nextScheduledFor(policy, new Date()).toISOString()})`,
      );
    }

    const wallets = await this.prisma.wallet.findMany({
      where: {
        ownerType: policy.beneficiaryType,
        currency: policy.currency,
        balanceAmount: { gte: policy.minimumAmount },
      },
    });
    const selections = selectEligibleWallets(
      wallets.map((wallet) => ({
        id: wallet.id,
        balanceAmount: wallet.balanceAmount,
        currency: wallet.currency,
      })),
      policy.minimumAmount,
    );
    if (selections.length === 0) {
      throw new ConflictException(
        `No ${policy.beneficiaryType} wallets meet the settlement policy minimum amount`,
      );
    }

    const totalAmount = sumSettlementAmount(selections);
    const batchNumber = this.generateBatchNumber();

    const created = await this.prisma.settlementBatch.create({
      data: {
        batchNumber,
        settlementPolicyId: policy.id,
        status: SettlementBatchStatus.PENDING,
        beneficiaryType: policy.beneficiaryType,
        currency: policy.currency,
        totalAmount,
        scheduledFor: opts.scheduledFor ?? new Date(),
        externalRef,
        items: {
          create: selections.map((selection) => ({
            walletId: selection.walletId,
            amount: selection.amount,
            currency: policy.currency,
          })),
        },
      },
      include: { items: true },
    });

    await this.audit.record({
      tableName: 'settlement_batches',
      recordId: created.id,
      action: AuditAction.INSERT,
      actorId: opts.actorId,
      actorType: ActorType.ADMIN,
      afterData: {
        batchNumber: created.batchNumber,
        totalAmount: created.totalAmount.toString(),
        items: created.items.length,
      },
      reason: `settlement batch created from policy "${policy.name}"`,
    });

    this.events.emit('wallets.SettlementBatchCreated', {
      batchId: created.id,
      policyId: policy.id,
      totalAmount: created.totalAmount.toString(),
      itemCount: created.items.length,
      at: new Date().toISOString(),
    });

    return {
      success: true as const,
      idempotent: false as const,
      batch: this.batchView(created),
    };
  }

  /**
   * Marks a PENDING batch approved. No-op (returns idempotent) if the
   * policy does not require approval, or the batch was already approved.
   * Approval is tracked via `SettlementBatch.externalRef` since
   * `SettlementBatchStatus` has no APPROVED state.
   */
  public async approveBatch(batchId: string, actorId: string) {
    const batch = await this.required(batchId);
    if (batch.status !== SettlementBatchStatus.PENDING) {
      throw new ConflictException(
        `Only PENDING batches can be approved (status=${batch.status})`,
      );
    }
    if (this.isApproved(batch.externalRef)) {
      return {
        success: true as const,
        idempotent: true as const,
        batch: this.batchView(await this.withItems(batch)),
      };
    }

    const updated = await this.prisma.settlementBatch.update({
      where: { id: batchId },
      data: { externalRef: this.mergeApproval(batch.externalRef, actorId) },
      include: { items: true },
    });

    await this.audit.record({
      tableName: 'settlement_batches',
      recordId: batchId,
      action: AuditAction.APPROVAL,
      actorId,
      actorType: ActorType.ADMIN,
      afterData: { approvedBy: actorId },
      reason: 'settlement batch approved',
    });

    return {
      success: true as const,
      idempotent: false as const,
      batch: this.batchView(updated),
    };
  }

  /**
   * Processes every item in a batch: debits the wallet, posts a settlement
   * payout journal, and marks the Settlement COMPLETED. Stops and marks the
   * batch FAILED on the first item failure (best-effort re-entry: already
   * COMPLETED settlements are skipped on retry).
   */
  public async processBatch(batchId: string, actorId: string, idempotencyKey?: string) {
    const batch = await this.required(batchId);
    if (batch.status === SettlementBatchStatus.COMPLETED) {
      return {
        success: true as const,
        idempotent: true as const,
        batch: this.batchView(await this.withItems(batch)),
      };
    }
    if (
      batch.status !== SettlementBatchStatus.PENDING &&
      batch.status !== SettlementBatchStatus.PROCESSING
    ) {
      throw new ConflictException(`Cannot process batch in status ${batch.status}`);
    }

    const policy = batch.settlementPolicyId
      ? await this.prisma.settlementPolicy.findUnique({
          where: { id: batch.settlementPolicyId },
        })
      : null;
    if (policy?.requiresApproval && !this.isApproved(batch.externalRef)) {
      throw new ConflictException(
        'Settlement batch requires approval before it can be processed',
      );
    }

    if (batch.status === SettlementBatchStatus.PENDING) {
      await this.prisma.settlementBatch.update({
        where: { id: batchId },
        data: { status: SettlementBatchStatus.PROCESSING },
      });
    }

    const items = await this.prisma.settlementItem.findMany({ where: { batchId } });
    let failed = false;
    for (const item of items) {
      try {
        await this.processItem(batch, item, actorId);
      } catch (error) {
        failed = true;
        this.logger.error(
          `Settlement item ${item.id} (wallet ${item.walletId}) failed: ${(error as Error).message}`,
          (error as Error).stack,
        );
        break;
      }
    }

    const finalStatus = failed ? SettlementBatchStatus.FAILED : SettlementBatchStatus.COMPLETED;
    const updated = await this.prisma.settlementBatch.update({
      where: { id: batchId },
      data: {
        status: finalStatus,
        processedAt: failed ? null : new Date(),
      },
      include: { items: true },
    });

    await this.audit.record({
      tableName: 'settlement_batches',
      recordId: batchId,
      action: AuditAction.STATUS_CHANGE,
      actorId,
      actorType: ActorType.ADMIN,
      afterData: { status: finalStatus },
      reason: failed ? 'settlement batch processing failed' : 'settlement batch processed',
      correlationId: idempotencyKey,
    });

    if (!failed) {
      this.events.emit('wallets.SettlementBatchCompleted', {
        batchId,
        at: new Date().toISOString(),
      });
    }

    return {
      success: true as const,
      idempotent: false as const,
      batch: this.batchView(updated),
    };
  }

  public async cancelBatch(batchId: string, actorId: string) {
    const batch = await this.required(batchId);
    if (batch.status !== SettlementBatchStatus.PENDING) {
      throw new ConflictException(
        `Only PENDING batches can be cancelled (status=${batch.status})`,
      );
    }
    const updated = await this.prisma.settlementBatch.update({
      where: { id: batchId },
      data: { status: SettlementBatchStatus.CANCELLED },
      include: { items: true },
    });

    await this.audit.record({
      tableName: 'settlement_batches',
      recordId: batchId,
      action: AuditAction.STATUS_CHANGE,
      actorId,
      actorType: ActorType.ADMIN,
      afterData: { status: SettlementBatchStatus.CANCELLED },
      reason: 'settlement batch cancelled',
    });

    return { success: true as const, batch: this.batchView(updated) };
  }

  public async listBatches(query: {
    status?: SettlementBatchStatus;
    beneficiaryType?: SettlementBatch['beneficiaryType'];
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.SettlementBatchWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.beneficiaryType) where.beneficiaryType = query.beneficiaryType;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.settlementBatch.count({ where }),
      this.prisma.settlementBatch.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true as const,
      items: rows.map((row) => this.batchView(row)),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  public async getBatch(id: string) {
    const row = await this.prisma.settlementBatch.findUnique({
      where: { id },
      include: { items: true, payouts: true },
    });
    if (!row) throw new NotFoundException('Settlement batch not found');
    return {
      success: true as const,
      batch: {
        ...this.batchView(row),
        payouts: row.payouts.map((payout) => this.settlementView(payout)),
      },
    };
  }

  private async processItem(
    batch: SettlementBatch,
    item: SettlementItem,
    actorId: string,
  ): Promise<Settlement> {
    let settlement = await this.prisma.settlement.findFirst({
      where: { batchId: batch.id, walletId: item.walletId },
    });
    if (!settlement) {
      settlement = await this.prisma.settlement.create({
        data: {
          walletId: item.walletId,
          batchId: batch.id,
          settlementPolicyId: batch.settlementPolicyId,
          amount: item.amount,
          currency: item.currency,
          status: SettlementStatus.PENDING,
        },
      });
    }

    if (settlement.status === SettlementStatus.COMPLETED) {
      return settlement;
    }
    // Allow PROCESSING retries (idempotent debit + journal) after mid-flight failure.
    if (
      settlement.status === SettlementStatus.FAILED ||
      settlement.status === SettlementStatus.CANCELLED
    ) {
      throw new ConflictException(`Settlement ${settlement.id} is ${settlement.status}`);
    }

    try {
      if (settlement.status === SettlementStatus.PENDING) {
        // Conditional claim — concurrent processors cannot both enter PROCESSING.
        const claimed = await this.prisma.settlement.updateMany({
          where: { id: settlement.id, status: SettlementStatus.PENDING },
          data: { status: SettlementStatus.PROCESSING },
        });
        if (claimed.count === 0) {
          const current = await this.prisma.settlement.findUnique({
            where: { id: settlement.id },
          });
          if (current?.status === SettlementStatus.COMPLETED) return current;
          throw new ConflictException(
            `Settlement ${settlement.id} is already being processed`,
          );
        }
        settlement = await this.prisma.settlement.findUniqueOrThrow({
          where: { id: settlement.id },
        });
      }

      // Debit is idempotent via reference — safe to retry PROCESSING items.
      await this.wallets.debit(item.walletId, kesFromBigInt(item.amount), {
        actorId,
        actorType: ActorType.SYSTEM,
        reference: `settlement:${settlement.id}`,
        description: `Settlement payout ${batch.batchNumber}`,
        idempotencyKey: `settlement:${settlement.id}`,
      });

      await this.postingEngine.postSettlementPayout({
        settlementId: settlement.id,
        beneficiaryType: batch.beneficiaryType,
        amount: item.amount,
        currency: item.currency,
        description: `Settlement payout ${batch.batchNumber} — ${batch.beneficiaryType}`,
      });

      return await this.prisma.settlement.update({
        where: { id: settlement.id },
        data: {
          status: SettlementStatus.COMPLETED,
          payoutProvider: PaymentProvider.MANUAL,
          payoutReference: `manual:${settlement.id}`,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      // Never mark FAILED after a debit may have succeeded — leave PROCESSING
      // so a safe idempotent retry can finish the journal + COMPLETED transition.
      throw error;
    }
  }

  private async required(id: string): Promise<SettlementBatch> {
    const row = await this.prisma.settlementBatch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Settlement batch not found');
    return row;
  }

  private async withItems(
    batch: SettlementBatch,
  ): Promise<SettlementBatch & { items: SettlementItem[] }> {
    const items = await this.prisma.settlementItem.findMany({
      where: { batchId: batch.id },
    });
    return { ...batch, items };
  }

  private mergeApproval(existingRef: string | null, actorId: string): string {
    const tag = `${APPROVAL_TAG_PREFIX}${actorId}`;
    if (!existingRef) return tag;
    if (existingRef.includes(APPROVAL_TAG_PREFIX)) return existingRef;
    return `${existingRef}|${tag}`;
  }

  private isApproved(externalRef: string | null): boolean {
    return !!externalRef && externalRef.includes(APPROVAL_TAG_PREFIX);
  }

  private generateBatchNumber(): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mi = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    const short = randomUUID().split('-')[0];
    return `SB-${y}${m}${d}-${hh}${mi}${ss}-${short}`;
  }

  private policyView(row: SettlementPolicy) {
    return {
      id: row.id,
      name: row.name,
      beneficiaryType: row.beneficiaryType,
      frequency: row.frequency,
      cutoffDay: row.cutoffDay,
      cutoffTime: row.cutoffTime,
      timezone: row.timezone,
      minimumAmount: row.minimumAmount.toString(),
      currency: row.currency,
      requiresApproval: row.requiresApproval,
      autoSettlement: row.autoSettlement,
      enabled: row.enabled,
      nextScheduledFor: nextScheduledFor(row, new Date()).toISOString(),
      isPastCutoff: isPastCutoff(row, new Date()),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private batchView(row: SettlementBatch & { items?: SettlementItem[] }) {
    return {
      id: row.id,
      batchNumber: row.batchNumber,
      settlementPolicyId: row.settlementPolicyId,
      status: row.status,
      beneficiaryType: row.beneficiaryType,
      currency: row.currency,
      totalAmount: row.totalAmount.toString(),
      approved: this.isApproved(row.externalRef),
      scheduledFor: row.scheduledFor?.toISOString() ?? null,
      processedAt: row.processedAt?.toISOString() ?? null,
      externalRef: row.externalRef,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      items: (row.items ?? []).map((item) => ({
        id: item.id,
        walletId: item.walletId,
        amount: item.amount.toString(),
        currency: item.currency,
        reference: item.reference,
      })),
    };
  }

  private settlementView(row: Settlement) {
    return {
      id: row.id,
      walletId: row.walletId,
      batchId: row.batchId,
      settlementPolicyId: row.settlementPolicyId,
      amount: row.amount.toString(),
      currency: row.currency,
      status: row.status,
      payoutProvider: row.payoutProvider,
      payoutReference: row.payoutReference,
      journalEntryId: row.journalEntryId,
      processedAt: row.processedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
