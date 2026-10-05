# StockFount security model

## Roles

| Role | Holder | Can | Cannot |
|---|---|---|---|
| Admin | OpenZeppelin `TimelockController`, 48h minimum delay, proposer and executor = admin multisig, no external admin | unpause, raise caps, change fees (within code caps), risk limits, feeds, bounds, breaker settings and pools, all after 48h in public | move user funds; raise the protocol share above 30%; turn off the circuit breaker; change the $FOUNT token |
| Guardian | A second multisig | pause deposits and rebalancing, lower caps, halt drawdowns | unpause, raise anything, move funds |
| Keeper | Hot wallet | rebalance within oracle-checked loss limits (at most 3%), harvest, run buy-and-burn within per-run caps and a minimum interval | anything else |
| Deployer | Fresh wallet | launch $FOUNT on Pons (it receives the Pons creator fees); bind each position to its Fount once, in the deploy transaction sequence | **nothing after deployment**: no role, no ownership, no pending ownership, no timelock rights |

## What changed from Stonkwell, and why

| Area | Stonkwell | StockFount |
|---|---|---|
| Ownership of oracle, swap adapter, registry | Deployer EOA, then `transferOwnership` to the timelock, which must `acceptOwnership` 48h later. The deployer keeps control during that window. | Timelock is the owner from the constructor. Feeds, pools, hooks and listings are constructor arguments. No window. |
| `DrawdownRetire` admin | Deployer during setup, then handed over | Timelock from the constructor. Input limits are constructor arguments. |
| $FOUNT / $WELL address | Could be set once later by the deployer (`setWellToken`) | Set at deployment, or once later **by the timelock** (`setFountToken`, admin only). The deployer has no part in it. |
| Admin type | Not checked on-chain | `GovernanceChecks.requireTimelock`: admin must report `getMinDelay() >= 48h`, and the deployer must hold none of the timelock's admin, proposer, executor or canceller roles. Otherwise the constructor reverts. |
| Guardian and keeper | Guardian ≠ admin checked in some contracts | Guardian, keeper and admin pairwise distinct, and neither guardian nor keeper is the deployer, checked in every contract with roles |
| Oracle | Freshness and positivity only | Plus per-feed `[minAnswer, maxAnswer]`, USDG bounds, a round-to-round circuit breaker, and a `status()` view saying why a token is unpriced |
| Borrow Desk, Basket Program | Included | Removed. Lending against vault shares adds liquidation and bad-debt risk, and it can be added later after its own audit. |

## Oracle hardening

`FountOracle._read` returns a `Status`:

- `Stale`: no update within `maxAge`, or a non-positive, zero-time or future answer.
- `OutOfBounds`: the answer is outside `[minAnswer, maxAnswer]`. Equity bounds are set at deployment to a tenth
  and ten times the launch price. USDG is bounded to $0.95–$1.05.
- `Jump`: the answer is younger than `jumpCooldown` and moved more than `maxJumpBps` from the feed's previous
  round. A previous round that cannot be read (for example the first round of a new aggregator phase) counts
  as a jump, so a new phase is trusted only after the cooldown.
- `SequencerDown`, `CorporateAction`, `NoFeed`, and USDG variants of the first three.

Anything but `Ok` makes `isFresh` false. `Fount` then blocks deposits, USDG exits and rebalances, while
`redeemInKind` keeps working because it needs no price.

Hard limits: `maxJumpBps` is 100–5,000 and `jumpCooldown` is 5 minutes to 1 day. Launch values are 1,500 bps
and 30 minutes (`contracts/config/robinhood.json`).

## Known limitations

- **`GovernanceChecks` trusts the admin's own answers.** A contract that fakes `getMinDelay` and `hasRole` would
  pass the constructor check. `scripts/verify.js` closes this off-chain by comparing the timelock's bytecode
  with the OpenZeppelin `TimelockController` compiled in this repository. Run it for every deployment, and
  publish its output.
- **Multisig-ness is not provable on-chain.** The deploy script and preflight require the admin and guardian
  to be contracts, but cannot prove they are well-run multisigs. Use Safe with a sensible threshold.
- **The timelock can still make bad changes**, slowly: a new feed, a new pool, ownership transfers. The
  protection is that every change is public for 48 hours and in-kind exits always work. Watch the timelock's
  `CallScheduled` events.
- **Buy-and-burn pricing.** There is no $FOUNT oracle. `minFountOut` comes from the keeper's simulation of the
  same pool it trades in, so a manipulated Pons pool is bounded only by `maxInputPerRun` and `minInterval`.
- **Pons hook.** The `$FOUNT/ETH` pool uses the third-party Pons hook. It is allowlisted only on the swap
  adapter. Fount positions reject hooked pools.

## Audit scope

In scope: `src/Fount.sol`, `src/FountOracle.sol`, `src/DrawdownRetire.sol`, `src/FeeRouter.sol`,
`src/FountRegistry.sol`, `src/governance/GovernanceChecks.sol`, `src/v4/FountPositionV4.sol`,
`src/v4/V4SwapAdapter.sol`, `src/v4/V4PoolMath.sol`, and the deploy ordering in `scripts/deploy.js`.

Out of scope: mocks, tests, the app, the keeper, and third-party contracts (Uniswap v4, Permit2, Chainlink,
USDG, Equity Tokens, Pons).
