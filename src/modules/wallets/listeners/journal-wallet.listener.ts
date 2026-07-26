import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WalletMirroringService,
  type JournalPostedEvent,
} from '../use-cases/wallet-mirroring.service';

/**
 * Mirrors accounting journal posts into wallets / escrow.
 * Listens to `accounting.JournalPosted` (preferred — includes journalId).
 */
@Injectable()
export class JournalWalletListener {
  private readonly logger = new Logger(JournalWalletListener.name);

  public constructor(private readonly mirroring: WalletMirroringService) {}

  @OnEvent('accounting.JournalPosted')
  public async onJournalPosted(event: JournalPostedEvent): Promise<void> {
    try {
      await this.mirroring.mirrorJournalPosted(event);
    } catch (error) {
      this.logger.error(
        `Wallet mirror failed for journal ${event?.journalId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
