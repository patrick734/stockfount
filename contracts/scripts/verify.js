// Checks a StockFount deployment on-chain. Read-only, needs no key, and anyone can run it:
//   npx hardhat run scripts/verify.js --network robinhood        (reads deployments/robinhood.json)
//   DEPLOYMENT=deployments/fork.json npx hardhat run scripts/verify.js
// Exits 1 if any check fails. deploy.js runs the same checks right after deploying.
const fs = require("fs");
const path = require("path");

const MIN_DELAY = 48n * 3600n;

async function verifyDeployment(ethers, d, { requireMultisigs = false } = {}) {
  let failures = 0;
  const check = (ok, msg) => {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`);
    if (!ok) failures++;
  };
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const fromBlock = d.startBlock ?? 0;

  console.log("Timelock");
  const tl = await ethers.getContractAt("TimelockController", d.timelock);
  const artifact = await require("hardhat").artifacts.readArtifact("TimelockController");
  const code = await ethers.provider.getCode(d.timelock);
  check(ethers.keccak256(code) === ethers.keccak256(artifact.deployedBytecode), "bytecode is the unmodified OpenZeppelin TimelockController");
  const delay = await tl.getMinDelay();
  check(delay >= MIN_DELAY, `minimum delay ${delay / 3600n}h (at least 48h)`);
  const R = { admin: await tl.DEFAULT_ADMIN_ROLE(), proposer: await tl.PROPOSER_ROLE(), executor: await tl.EXECUTOR_ROLE(), canceller: await tl.CANCELLER_ROLE() };
  for (const [name, role] of Object.entries(R)) {
    check(!(await tl.hasRole(role, d.deployer)), `deployer is not a timelock ${name}`);
  }
  check(await tl.hasRole(R.proposer, d.roles.admin), "admin multisig can propose");
  check(!(await tl.hasRole(R.admin, d.roles.admin)), "admin multisig cannot bypass the timelock's own role management");
  const tlGrants = await tl.queryFilter(tl.filters.RoleGranted(R.admin), fromBlock);
  check(tlGrants.every((e) => same(e.args.account, d.timelock)), "only the timelock administers itself");

  if (requireMultisigs) {
    console.log("Multisigs");
    for (const name of ["admin", "guardian"]) {
      check((await ethers.provider.getCode(d.roles[name])) !== "0x", `${name} ${d.roles[name]} is a contract`);
    }
  }

  console.log("Role holders");
  const accessControlled = [
    ["DrawdownRetire", d.drawdownRetire],
    ...Object.entries(d.founts).map(([t, f]) => [`Fount ${t}`, f.fount]),
  ];
  for (const [label, address] of accessControlled) {
    const c = await ethers.getContractAt("Fount", address); // same AccessControl ABI
    const expected = {
      [await c.DEFAULT_ADMIN_ROLE()]: d.timelock,
      [await c.GUARDIAN_ROLE()]: d.roles.guardian,
      [await c.KEEPER_ROLE()]: d.roles.keeper,
    };
    const holders = new Map();
    for (const e of await c.queryFilter(c.filters.RoleGranted(), fromBlock)) holders.set(`${e.args.role}:${e.args.account.toLowerCase()}`, [e.args.role, e.args.account]);
    for (const e of await c.queryFilter(c.filters.RoleRevoked(), fromBlock)) holders.delete(`${e.args.role}:${e.args.account.toLowerCase()}`);
    const unexpected = [...holders.values()].filter(([role, account]) => !same(expected[role], account));
    check(unexpected.length === 0 && holders.size === 3, `${label}: exactly timelock admin, guardian, keeper`);
    check(!(await c.hasRole(await c.DEFAULT_ADMIN_ROLE(), d.deployer)), `${label}: deployer has no admin role`);
  }

  console.log("Owners");
  for (const [label, name, address] of [
    ["FountOracle", "FountOracle", d.oracle],
    ["FeeRouter", "FeeRouter", d.feeRouter],
    ["FountRegistry", "FountRegistry", d.registry],
    ...(d.swapAdapterIsMock ? [] : [["V4SwapAdapter", "V4SwapAdapter", d.swapAdapter]]),
  ]) {
    const c = await ethers.getContractAt(name, address);
    if (!c.interface.getFunction("owner", [])) continue;
    try {
      check(same(await c.owner(), d.timelock) && same(await c.pendingOwner(), ethers.ZeroAddress), `${label}: owned by the timelock, nothing pending`);
    } catch {
      check(false, `${label}: has no owner() (mock?)`);
    }
  }

  console.log("Wiring");
  const drawdown = await ethers.getContractAt("DrawdownRetire", d.drawdownRetire);
  const onChainToken = await drawdown.fountToken();
  if (d.fountToken) check(same(onChainToken, d.fountToken), `DrawdownRetire burns $FOUNT ${d.fountToken}`);
  else if (same(onChainToken, ethers.ZeroAddress)) console.log("  info  $FOUNT not set yet: fees wait in DrawdownRetire until the timelock sets it (set-token.sh)");
  else console.log(`  info  $FOUNT set on-chain to ${onChainToken} (deployment file not updated yet)`);
  const router = await ethers.getContractAt("FeeRouter", d.feeRouter);
  check(same(await router.drawdownRetire(), d.drawdownRetire) && same(await router.pendingDrawdownRetire(), ethers.ZeroAddress), "FeeRouter sends to DrawdownRetire, no change pending");
  const oracle = await ethers.getContractAt("FountOracle", d.oracle);
  check((await oracle.maxJumpBps()) > 0n && (await oracle.jumpCooldown()) > 0n, `circuit breaker ${await oracle.maxJumpBps()} bps / ${await oracle.jumpCooldown()}s`);
  const registry = await ethers.getContractAt("FountRegistry", d.registry);
  const listed = (await registry.entries()).map((e) => e.target.toLowerCase());
  for (const [ticker, f] of Object.entries(d.founts)) {
    const fount = await ethers.getContractAt("Fount", f.fount);
    const position = await ethers.getContractAt("FountPositionV4", f.position);
    const wired =
      same(await fount.position(), f.position) &&
      same(await position.fount(), f.fount) &&
      same(await fount.oracle(), d.oracle) &&
      same(await fount.feeRouter(), d.feeRouter) &&
      same(await fount.swapAdapter(), d.swapAdapter);
    check(wired, `Fount ${ticker}: position bound both ways, shared oracle, router and adapter`);
    check((await oracle.feeds(f.equityToken)).aggregator !== ethers.ZeroAddress, `Fount ${ticker}: oracle feed set`);
    check(listed.includes(f.fount.toLowerCase()), `Fount ${ticker}: listed in the registry`);
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed: the deployer holds no power over StockFount.");
  return failures;
}

async function main() {
  const hre = require("hardhat");
  const file = process.env.DEPLOYMENT || path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`Verifying ${path.relative(process.cwd(), file)} on ${hre.network.name}\n`);
  const failures = await verifyDeployment(hre.ethers, d, { requireMultisigs: hre.network.name === "robinhood" });
  if (failures) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { verifyDeployment };
