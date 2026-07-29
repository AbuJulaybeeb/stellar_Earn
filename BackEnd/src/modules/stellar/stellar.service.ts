import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rpc } from 'stellar-sdk';
import * as StellarSdk from 'stellar-sdk';

/**
 * Shared Stellar infrastructure service.
 *
 * Initializes and provides access to the configured Horizon server, Soroban
 * RPC server, and network passphrase. Focused business-logic services
 * ({@link StellarSubmissionService}, {@link StellarPaymentService},
 * {@link StellarEventIngestionService}) depend on this service for the
 * low-level Stellar SDK clients.
 *
 * Backward-compatibility note: this service retains delegating wrappers
 * for `approveSubmission`, `signAndSubmit`, `sendPayment`, and
 * `ingestContractEvents` so that existing consumers are not broken by the
 * refactor. New code should inject the focused services directly.
 */
@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private horizonServer: StellarSdk.Horizon.Server;
  private rpcServer: rpc.Server;
  private networkPassphrase: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeStellarComponents();
  }

  private initializeStellarComponents() {
    const horizonUrl =
      this.configService.get<string>('STELLAR_HORIZON_URL') ||
      'https://horizon-testnet.stellar.org';
    const rpcUrl =
      this.configService.get<string>('SOROBAN_RPC_URL') ||
      'https://soroban-testnet.stellar.org';
    const network = this.configService.get<string>('STELLAR_NETWORK');

    this.horizonServer = new StellarSdk.Horizon.Server(horizonUrl);
    this.rpcServer = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith('http://'),
    });
    this.networkPassphrase =
      network === 'PUBLIC'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

    this.logger.log(`Stellar Service initialized on ${network}`);
  }

  /** Returns the configured Horizon server instance. */
  getHorizon(): StellarSdk.Horizon.Server {
    return this.horizonServer;
  }

  /** Returns the configured Soroban RPC server instance. */
  getRpc(): rpc.Server {
    return this.rpcServer;
  }

  /** Returns the Stellar network passphrase for the configured network. */
  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }
}
