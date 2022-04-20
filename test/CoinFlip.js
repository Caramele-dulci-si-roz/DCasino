const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoinFlip", function () {
  async function deployContract() {
    const CommitReveal = await ethers.getContractFactory("CommitReveal");
    const commitReveal = await CommitReveal.deploy();
    await commitReveal.deployed();

    const CoinFlip = await ethers.getContractFactory("CoinFlip", {
      libraries: {
        CommitReveal: commitReveal.address,
      }
    });
    const coinFlip = await CoinFlip.deploy();
    await coinFlip.deployed();

    return coinFlip;
  }

  it("should deploy", async function () {
    const coinFlip = await deployContract();
    expect(coinFlip.address).to.be.a("string");
  });

  const betABI = ["address", "uint", "uint", "uint"];
  function hashBet(bet) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(betABI, bet));
  }

  it("should play multiple games", async function () {
    const [owner, player] = await ethers.getSigners();
    const coinFlip = await deployContract();

    await coinFlip.deposit({value: 1e9});

    for (let i = 0; i < 10; i++) {
      await playGame(i, coinFlip, owner, player);
    }
  });

  async function playGame(i, coinFlip, owner, player) {
    await coinFlip.commitBet(hashBet([owner.address, 0, 0, 0]), 0);
    const commitBetTx = await coinFlip.connect(player).commitBet(
      hashBet([player.address, 10, 0, 0]), 
      0, {
      value: 10,
    });

    let receipt = await commitBetTx.wait();
    expect(receipt.events.length).to.equal(1);
    const playerBetId = receipt.events[0].args.betId;

    await coinFlip.endCommitPhase();

    await coinFlip.connect(player).revealBet(playerBetId, 0);
    const revealTx = await coinFlip.revealBet(0, 0);

    receipt = await revealTx.wait();
    expect(receipt.events[0].args.gameId.toString()).to.equal(i.toString());
  }
});
