# launch

Launches **$FOUNT** on the [Pons](https://ponsfamily.com) V2 launchpad on Robinhood Chain (4663), from the StockFount deployer wallet. This is step 1 of a launch: the protocol contracts are deployed afterwards with the token's address.

$FOUNT is not a StockFount contract. It is created by Pons's own verified factory,
`PonsV2LaunchFactory` at `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`
([source](https://github.com/ponsdotdev/pons-labs)). The full fixed supply is minted to a
bonding curve, which graduates into a permanently locked Uniswap V4 pool. The dev wallet calls
`launchToken` and, optionally, buys from the curve straight after.

## 1. Dev wallet

1. Create a **new** wallet in MetaMask or Rabby that is used for nothing else.
2. Fund it on Robinhood Chain with enough ETH for the Pons launch fee, gas, and any dev buy.
   The preflight prints the exact amount it needs.
3. Put the key in `launch/.env` (git-ignored), or export it in your shell:

   ```bash
   cp .env.example .env   # then set DEPLOYER_PRIVATE_KEY=0x...
   ```

Never commit the key, paste it into chat, or put it in a CI secret that runs on pull requests.

## 2. Token metadata

Edit `fount.config.json`:

| Field | Notes |
| --- | --- |
| `name`, `symbol` | Up to 64 / 16 bytes. Fixed forever once launched. |
| `logo` | `https://` or `ipfs://` URL, up to 512 bytes. **Fixed forever**: upload the logo first. |
| `description` | Up to 2048 bytes. |
| `socials` | `twitter`, `telegram`, `discord`, `website`, `farcaster`. |
| `launchConfigId` | Pons preset (0 is the default). The preflight checks it is enabled. |
| `pairToken` | `0x000…000` for native ETH, or a Pons-approved ERC-20 such as USDG. |
| `creatorFeeRecipient` | Empty means the dev wallet receives creator fees. |
| `creatorTaxBps` | Extra trade tax paid to the creator, capped by Pons (10% today). |
| `buybackEnabled` | Pons five-year buyback vault for this launch. |
| `salt` | Empty for a fresh one, or a 32-byte hex value (mine one for a vanity address). |
| `snipeTaxExemptions` | Up to 32 extra team wallets exempt from the opening snipe tax. The dev wallet is always exempt. |
| `devBuyEth` | ETH the dev wallet spends on the curve right after launch. `"0"` for none. |
| `devBuySlippageBps` | Max slippage for the dev buy (300 = 3%). |

## 3. Preflight (sends nothing)

```bash
npm ci
npm run preflight
```

It checks the RPC is Robinhood Chain, the factory exists, launches are open to the wallet,
the launch config is enabled and the wallet has enough ETH. It then simulates the launch and prints
the predicted token address.

## 4. Launch

```bash
npm run launch
```

It runs the same preflight and asks you to type the symbol, then sends the launch. If `devBuyEth` is
set, it sends the dev buy afterwards. Transaction hashes and the token and curve addresses are saved to
`deployments/fount-4663.json`. Commit that file.

The launch pins the economics Pons quoted at preflight (`expectedEconomics`), so if Pons changes
its terms before the transaction lands, it reverts instead of launching on different terms.

The dev buy is a separate transaction from the launch, so someone else can buy in between.
The dev wallet is exempt from the snipe tax either way.

## After launch

$FOUNT is the token the protocol buys and burns, and `DrawdownRetire` fixes its address at deployment.
So the order is:

1. Launch $FOUNT here (this folder).
2. Deploy the protocol with `FOUNT_TOKEN_ADDRESS` set to the new token (`contracts/`, see the root README).
3. Once $FOUNT graduates on Pons into its Uniswap V4 pool, the admin multisig registers that pool on the
   swap adapter through the timelock (`node contracts/scripts/register-fount-pool.js`). Buy-and-burn starts
   after that. Until then, protocol fees wait in `DrawdownRetire`.
