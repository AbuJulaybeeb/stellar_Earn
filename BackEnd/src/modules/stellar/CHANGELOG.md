# stellar module changelog

All notable changes to the `stellar` backend module are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this module adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `sendPayment(recipientAddress, amount, asset?)` public method on `StellarService` for disbursing XLM (or other Stellar assets) via Horizon. Loads the configured admin keypair from `SOROBAN_SECRET_KEY` / `STELLAR_ADMIN_SECRET`, builds a payment operation with `TransactionBuilder` and `Operation.payment`, signs, and submits. Returns `{ transactionHash, ledger }`.
- `sendBatchPayments(payments)` public method that builds a single `TransactionBuilder` with multiple `Operation.payment()` calls (one per recipient), signs once, and submits once via Horizon. Returns per-transaction results with `{ transactionHash, ledger, operations[] }`. Splits into multiple transactions when the input exceeds 100 operations (#1981).
