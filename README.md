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
- **$FOUNT set once, by the timelock.** The protocol deploys first. After the Pons launch, the admin Safe sets
  $FOUNT in `DrawdownRetire` through the 48-hour timelock. It can never be changed after that, and the deployer
  has no part in it.
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
  test/unit/              150 unit tests on mocks, including governance and oracle hardening
  test/fork/              tests against the live Uniswap v4 pools on a Robinhood Chain fork
  scripts/deploy.js       Step 2: deploys and configures everything in one pass, then verifies it
  scripts/verify.js       Read-only on-chain proof that the deployer holds no power
keeper/      Off-chain keeper bot: rebalance, harvest, route fees, buy and burn $FOUNT (runs in GitHub Actions)
tools/       Wallet tools: encrypted keystores, keeper secret, launch.env loader
app/         Next.js 14 + wagmi/viem interface: Home, Founts, Safety, Portfolio, Docs
```

## Launch

Step by step, with the exact commands: **[docs/LAUNCH.md](docs/LAUNCH.md)**. In short:

```bash
node tools/import-key.js stockfount-dev   # dev wallet from MetaMask, encrypted
node tools/wallet.js keeper-secret        # keeper key straight into GitHub Actions
./launch.sh --rehearsal                   # free full deploy on a copy of the chain
./launch.sh                               # real deploy (market hours)
./verify.sh                               # proof the deployer holds nothing
./set-token.sh 0xTOKEN                    # after the Pons launch: Safe files for the timelock
./govern.sh register-pool                 # after graduation: start buy-and-burn
```

The keeper runs from GitHub Actions every 15 minutes and only sends transactions when the repo variable
`KEEPER_LIVE` is `1`.

**Do not open the Founts to real deposits before an independent audit** of `Fount`, `FountPositionV4`,
`V4SwapAdapter`, `FountOracle`, `DrawdownRetire` and `GovernanceChecks`. Launch caps are $25,000 per Fount.

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
