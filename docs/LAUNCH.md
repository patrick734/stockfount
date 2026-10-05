# Launching StockFount

Everything runs from the repo folder on your Mac. Nothing here ever asks you to paste a private key into a file.

## What "rug-proof" means here

Three wallets matter, and none of them alone can take depositors' money:

| Wallet | What it is | Power |
|---|---|---|
| **Dev wallet** | A new MetaMask account. It pays the deploy gas and launches $FOUNT. | **None after deploy.** The contracts refuse to deploy if it would keep any role. |
| **Admin Safe** | A Safe multisig (for example 2 of 3 owners). | Proposes changes to the **timelock**. Every change waits **48 hours in public** before it can run. |
| **Guardian Safe** | A second Safe. | Can only **pause** deposits and **lower** limits. It cannot unpause, raise anything or move funds. |
| **Keeper** | A hot wallet whose key lives only in GitHub Actions. | Rebalances, harvests and runs buy-and-burn, within on-chain loss limits. |

The timelock is the admin of every contract. If anyone tries something bad, even the Safe owners, the change is
visible on-chain for 48 hours first. Depositors can always leave in kind (stock token plus USDG, with no price
needed), so they have time to exit. Run `./verify.sh` after deploying and post its output: it proves all of this
on-chain.

## Before you start

- Node.js 22 (`node -v`), git, and the GitHub CLI: `brew install gh && gh auth login`
- The repo cloned: `git clone https://github.com/patrick734/stockfount && cd stockfount`
- About 0.03 ETH on Robinhood Chain for the dev wallet, and 0.01 ETH for the keeper

## 1. Safes

On [app.safe.global](https://app.safe.global), switch the network to **Robinhood Chain** and create two Safes:

1. **Admin Safe:** your owners (for example you plus 2 other wallets or devices), threshold 2.
2. **Guardian Safe:** different owners or a different threshold. It must be a different address from the admin.

Copy both addresses.

## 2. Dev wallet

In MetaMask: Add account > Create a new account. Send it 0.03 ETH on Robinhood Chain (straight from an exchange
is fine). Then save it as an encrypted keystore:

```bash
cd contracts && npm ci && cd ..
node tools/import-key.js stockfount-dev
```

Copy the key in MetaMask (Account details > Show private key) and press Enter. The tool reads it from the
clipboard, clears the clipboard, and asks for a password to encrypt it with. It shows only the address.

## 3. Keeper

```bash
node tools/wallet.js keeper-secret
```

This creates a new keeper wallet, stores its key **only** as the `KEEPER_PRIVATE_KEY` secret of your GitHub repo,
sets the repo variable `KEEPER_LIVE=0`, writes `KEEPER_ADDRESS` into `launch.env`, and prints the address. Send
that address 0.01 ETH.

## 4. Settings

```bash
cp -n launch.env.example launch.env
open -e launch.env
```

Fill in `ADMIN_MULTISIG` and `GUARDIAN_MULTISIG`, check `KEEPER_ADDRESS` and `DEPLOYER_ACCOUNT=stockfount-dev`,
and leave `FOUNT_TOKEN_ADDRESS` empty. If you have a private RPC (Alchemy), put it on the `ROBINHOOD_RPC_URL=`
line without the `#`.

## 5. Rehearse, then deploy

```bash
./launch.sh --rehearsal
```

This runs the complete deploy on a local copy of Robinhood Chain with your real settings and checks. It is free
and sends nothing. It must end with `REHEARSAL PASSED`.

Then, during US market hours (6:30 AM to 1:00 PM PT), run the real deploy:

```bash
./launch.sh
```

Type `DEPLOY` and enter the dev wallet's password. It ends by verifying that the deployer holds no power.

```bash
git add -A && git commit -m "Mainnet deployment" && git push
./verify.sh
```

The push makes Vercel publish the site with the live addresses. Post the `./verify.sh` output.

## 6. Launch $FOUNT on Pons

Launch it on the Pons website from the dev wallet, or run `./launch-token.sh` (preflight) and then
`./launch-token.sh --launch`. Copy the token address, then:

```bash
./set-token.sh 0xTOKEN
```

This checks the token and writes two files to `safe-txs/`. In the admin Safe, open Apps > Transaction Builder,
drag in `set-token-1-schedule.json`, and sign it with the owners. 48 hours later, do the same with
`set-token-2-execute.json`. `./govern.sh status` shows when it is ready.

## 7. Keeper

GitHub > Actions > **Keeper** > Run workflow. While `KEEPER_LIVE` is `0`, it only simulates and logs. When a few
runs look healthy, set the repo variable `KEEPER_LIVE` to `1` (Settings > Secrets and variables > Actions >
Variables). It then runs every 15 minutes.

## 8. After $FOUNT graduates on Pons

```bash
./govern.sh register-pool
```

Same two-file Safe flow. Once executed, the keeper starts buying and burning $FOUNT with the protocol's 30% share.
Until then, those fees wait safely in `DrawdownRetire`.

## Troubleshooting

- **`BadRecordMac` or a dropped connection:** the public RPC is flaky. Set `ROBINHOOD_RPC_URL` in `launch.env`.
- **Prices stale in the preflight:** outside US market hours. Deploy between 6:30 AM and 1:00 PM PT.
- **`already deployed`:** `contracts/deployments/robinhood.json` exists. Use `FORCE=1 ./launch.sh` only if you
  really want a second, separate deployment.
