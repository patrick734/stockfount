# StockFount

Oracle-guarded liquidity for tokenized stocks on Robinhood Chain. You deposit USDG into a **Fount**, and the
Fount runs concentrated stock-token / USDG liquidity on Uniswap v4. 70% of trading fees compound for depositors.
The other 30% buys **$FOUNT** and burns it.

StockFount is built on the MIT-licensed [Stonkwell](https://github.com/lilkiddo-d/StonkWell) contracts. It
removes the Borrow Desk and Basket Program and hardens governance and pricing:

- **Rug-proof deployment.** Every contract checks in its constructor that its admin is an OpenZeppelin
  `TimelockController` with at least a 48-hour delay, and that the deploying wallet cannot propose, execute,
  cancel or administer on it. All settings are passed in at construction, so the deployer never owns anything,
  not even for one block. `scripts/verify.js` proves this on-chain for any deployment.
- **$FOUNT fixed at deployment.** $FOUNT is launched on Pons first, and `DrawdownRetire` stores it immutably.
  No account can ever point the buy-and-burn at another token.
- **Hardened oracle.** Each Chainlink feed has sanity bounds, and USDG must stay within $0.95–$1.05. A
  circuit breaker holds any price that jumped more than 15% from the previous round until it is 30 minutes
  old. The breaker can be tuned through the timelock within hard limits, but never switched off.
- **Live safety page.** The app's `/safety` page reads all of the above from the chain on every load.

See [docs/SECURITY.md](docs/SECURITY.md) for the trust model and the audit scope.

## Layout

```
launch/      Step 1: the dev wallet launches $FOUNT on the Pons V2 launchpad
contracts/   Hardhat project (Solidity 0.8.26, OpenZeppelin 5.1, Uniswap v4 MIT files only)
  src/                    Fount, FountOracle, FeeRouter, DrawdownRetire, FountRegistry
  src/v4/                 FountPositionV4 (PositionManager + Permit2), V4SwapAdapter
  src/governance/         GovernanceChecks (constructor checks), Timelock (OZ TimelockController)
  test/unit/              146 unit tests on mocks, including governance and oracle hardening
  test/fork/              tests against the live Uniswap v4 pools on a Robinhood Chain fork
  scripts/deploy.js       Step 2: deploys and configures everything in one pass, then verifies it
  scripts/verify.js       Read-only on-chain proof that the deployer holds no power
keeper/      Off-chain keeper bot: rebalance, harvest, route fees, buy and burn $FOUNT
app/         Next.js 14 + wagmi/viem interface: Home, Founts, Safety, Portfolio, Docs
```

## Launch order

The deployer is a **new wallet used only for this**, and it never holds a role.

1. **Launch $FOUNT on Pons** from the deployer wallet: `cd launch && npm ci && npm run preflight && npm run launch`.
   See [launch/README.md](launch/README.md).
2. **Create two multisigs** (for example Safe): the admin, which proposes to the timelock, and the guardian,
   which can only pause. Pick a keeper hot wallet. All three must differ from each other and from the deployer.
3. **Preflight** (read-only): `cd contracts && ADMIN_MULTISIG=… GUARDIAN_MULTISIG=… KEEPER_ADDRESS=… FOUNT_TOKEN_ADDRESS=… DEPLOYER_ADDRESS=… npm run preflight`.
4. **Deploy**: same variables plus `DEPLOYER_PRIVATE_KEY`, then `npm run deploy:robinhood`. The script ends by
   running the verification. Windows users can run `.\launch.ps1` from the root (it reads `launch.env`), which
   does steps 3–4 with a fork rehearsal first.
5. **Publish**: `npm run export-abis`, then commit `contracts/deployments/robinhood.json` and `app/src/generated`.
6. **Start the keeper** ([keeper/README.md](keeper/README.md)).
7. **When $FOUNT graduates on Pons**, run `node scripts/register-fount-pool.js`. It prints the timelock
   transactions for the admin multisig to schedule. Buy-and-burn starts 48 hours later. Until then, fees wait
   in `DrawdownRetire`.

**Do not deploy to mainnet before an independent audit** of `Fount`, `FountPositionV4`, `V4SwapAdapter`,
`FountOracle`, `DrawdownRetire` and `GovernanceChecks`. These contracts hold depositors' money.

## Development

```bash
cd contracts && npm ci && npm test              # unit tests
FORK=1 npx hardhat test                         # fork tests (needs a Robinhood Chain RPC)
npx hardhat node &                              # local chain
npx hardhat run scripts/deploy.js --network localhost && npm run export-abis
cd ../app && npm ci && NEXT_PUBLIC_ENABLE_LOCAL=1 npm run dev
cd ../keeper && npm ci && npm test
cd ../launch && npm ci && npm test
```

If `binaries.soliditylang.org` is unreachable, install `solc@0.8.26` from npm and set `SOLCJS_PATH` to its
`soljson.js`, and Hardhat compiles with it instead (`contracts/solc-override.js`).

## License

MIT. StockFount is a modified version of Stonkwell. The original copyright notice is kept in [LICENSE](LICENSE).
The only Uniswap v4-core files used are MIT-licensed; no BUSL files are included.
