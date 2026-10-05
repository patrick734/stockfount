// $FOUNT launched after the protocol: DrawdownRetire starts without a token and the timelock sets it once.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { USDG, EQ, baseFixture, viaTimelock } = require("./fixtures");

describe("DrawdownRetire without $FOUNT at deployment", function () {
  async function unset() {
    const ctx = await baseFixture();
    const drawdown = await ethers.deployContract("DrawdownRetire", [
      ethers.ZeroAddress,
      ctx.swap,
      ctx.admin.address,
      ctx.guardian.address,
      ctx.keeper.address,
      0,
      [ctx.usdg.target],
      [USDG(1_000)],
    ]);
    await ctx.usdg.mint(drawdown, USDG(500));
    return { ...ctx, drawdown };
  }

  it("deploys with no token, holds fees, and refuses to draw down", async function () {
    const { drawdown, usdg, keeper } = await loadFixture(unset);
    expect(await drawdown.fountToken()).to.equal(ethers.ZeroAddress);
    await expect(drawdown.connect(keeper).drawdown(usdg, USDG(100), 1, "0x")).to.be.revertedWithCustomError(drawdown, "FountTokenUnset");
    await drawdown.retireHeld(); // no-op, does not revert
    expect(await usdg.balanceOf(drawdown)).to.equal(USDG(500));
  });

  it("lets only the admin set the token, and only once", async function () {
    const { drawdown, fountToken, deployer, multisig, guardian, keeper, admin, alice } = await loadFixture(unset);
    for (const s of [deployer, multisig, guardian, keeper, alice]) {
      await expect(drawdown.connect(s).setFountToken(fountToken)).to.be.revertedWithCustomError(drawdown, "AccessControlUnauthorizedAccount");
    }
    await expect(drawdown.connect(admin).setFountToken(fountToken)).to.emit(drawdown, "FountTokenSet").withArgs(fountToken.target);
    const other = await ethers.deployContract("FountToken", [admin.address, EQ(1)]);
    await expect(drawdown.connect(admin).setFountToken(other)).to.be.revertedWithCustomError(drawdown, "FountTokenAlreadySet");
  });

  it("rejects a token without code and a token that is a configured fee input", async function () {
    const { drawdown, usdg, admin, alice } = await loadFixture(unset);
    await expect(drawdown.connect(admin).setFountToken(alice.address)).to.be.revertedWithCustomError(drawdown, "InvalidConfig");
    await expect(drawdown.connect(admin).setFountToken(usdg)).to.be.revertedWithCustomError(drawdown, "InvalidConfig");
    await expect(drawdown.connect(admin).setFountToken(ethers.ZeroAddress)).to.be.revertedWithCustomError(drawdown, "InvalidConfig");
  });

  it("buys and burns once the token is set through the 48h timelock", async function () {
    const ctx = await loadFixture(unset);
    const { drawdown, fountToken, usdg, keeper } = ctx;
    await viaTimelock(ctx, drawdown, "setFountToken", [fountToken.target]);
    expect(await drawdown.fountToken()).to.equal(fountToken.target);
    const supply = await fountToken.totalSupply();
    await expect(drawdown.connect(keeper).drawdown(usdg, USDG(100), 1, "0x")).to.emit(drawdown, "Retired");
    expect(await fountToken.totalSupply()).to.be.lt(supply);
  });
});
