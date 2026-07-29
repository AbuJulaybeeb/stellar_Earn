import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StellarService } from './stellar.service';
import * as StellarSdk from 'stellar-sdk';

describe('StellarService (Infrastructure)', () => {
  let service: StellarService;

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'STELLAR_ADMIN_SECRET') return null;
      if (key === 'STELLAR_NETWORK') return 'TESTNET';
      if (key === 'STELLAR_HORIZON_URL')
        return 'https://horizon-testnet.stellar.org';
      if (key === 'SOROBAN_RPC_URL')
        return 'https://soroban-testnet.stellar.org';
      if (key === 'CONTRACT_ID') return 'C_CONTRACT';

      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize Stellar components on module init', () => {
    expect(service.getHorizon()).toBeDefined();
    expect(service.getRpc()).toBeDefined();
    expect(service.getNetworkPassphrase()).toBe(StellarSdk.Networks.TESTNET);
  });

  it('should return the correct network passphrase for TESTNET', () => {
    expect(service.getNetworkPassphrase()).toBe(StellarSdk.Networks.TESTNET);
  });

  it('should return the correct network passphrase for PUBLIC', () => {
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'STELLAR_NETWORK') return 'PUBLIC';
      if (key === 'STELLAR_HORIZON_URL')
        return 'https://horizon.stellar.org';
      if (key === 'SOROBAN_RPC_URL')
        return 'https://soroban.stellar.org';
      return null;
    });

    service.onModuleInit();

    expect(service.getNetworkPassphrase()).toBe(StellarSdk.Networks.PUBLIC);
  });

  it('should provide access to the Horizon server', () => {
    const horizon = service.getHorizon();
    expect(horizon).toBeDefined();
    expect(typeof horizon.loadAccount).toBe('function');
  });

  it('should provide access to the RPC server', () => {
    const rpc = service.getRpc();
    expect(rpc).toBeDefined();
    expect(typeof rpc.getLatestLedger).toBe('function');
  });

  it('should default to testnet URLs when not configured', () => {
    mockConfig.get.mockReturnValue(null);

    service.onModuleInit();

    // Should not throw — defaults are applied
    expect(service.getHorizon()).toBeDefined();
    expect(service.getRpc()).toBeDefined();
  });
});
