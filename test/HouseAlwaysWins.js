const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HouseAlwaysWins", function () {
  async function deployContract() {
    const CommitReveal = await ethers.getContractFactory("CommitReveal");
    const commitReveal = await CommitReveal.deploy();
    await commitReveal.deployed();

    const HouseAlwaysWins = await ethers.getContractFactory("HouseAlwaysWins", {
      libraries: {
        CommitReveal: commitReveal.address,
      }
    });
    const houseAlwaysWins = await HouseAlwaysWins.deploy();
    await houseAlwaysWins.deployed();

    return houseAlwaysWins;
  }

  it("should deploy", async function () {
    const houseAlwaysWins = await deployContract();
    expect(houseAlwaysWins.address).to.be.a("string");
  });

  it("should throw error if house does not commit the bet first", async function () {
    const [owner, player] = await ethers.getSigners();
    const houseAlwaysWins = await deployContract();

    const someHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("some data"));
    await expect(
      houseAlwaysWins.connect(player).commitBet(someHash, 0)
    ).to.be.revertedWith('The house must commit first.');
  });

  const betABI = ["address", "uint", "uint", "uint"];
  function hashBet(bet) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(betABI, bet));
  }

  it("should commit bets", async function () {
    const [owner, player1, player2] = await ethers.getSigners();
    const houseAlwaysWins = await deployContract();

    await houseAlwaysWins.commitBet(hashBet([owner.address, 0, 0, 0]), 0);
    await houseAlwaysWins.connect(player1).commitBet(hashBet([player1.address, 10, 0, 0]), 0, {
      value: 10,
    });
    await houseAlwaysWins.connect(player2).commitBet(hashBet([player2.address, 20, 0, 0]), 0, {
      value: 20,
    });

    expect(await ethers.provider.getBalance(houseAlwaysWins.address)).to.equal(30);
  });

  it("should play a game and start a new one", async function () {
    const [owner, player] = await ethers.getSigners();
    const houseAlwaysWins = await deployContract();

    await houseAlwaysWins.commitBet(hashBet([owner.address, 0, 0, 0]), 0);
    const commitBetTx = await houseAlwaysWins.connect(player).commitBet(
      hashBet([player.address, 10, 0, 0]), 
      0, {
      value: 10,
    });

    let receipt = await commitBetTx.wait();
    expect(receipt.events.length).to.equal(1);
    const playerBetId = receipt.events[0].args.betId;

    await houseAlwaysWins.endCommitPhase();

    await houseAlwaysWins.connect(player).revealBet(playerBetId, 0);
    const revealTx = await houseAlwaysWins.revealBet(0, 0);

    receipt = await revealTx.wait();
    expect(receipt.events.length).to.equal(1);
    expect(receipt.events[0].args.gameId.toString()).to.equal("0");

    // check if we can start the next game
    await houseAlwaysWins.commitBet(hashBet([owner.address, 0, 0, 0]), 0);
  });
});
