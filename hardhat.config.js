require("@nomiclabs/hardhat-waffle");
require('@typechain/hardhat')
require('@nomiclabs/hardhat-ethers')

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("transfer", "Sends ETH and tokens to an address")
  .addPositionalParam("receiver", "The address that will receive them")
  .setAction(async ({ receiver }, { ethers }) => {
    if (network.name === "hardhat") {
      console.warn(
        "You are running the faucet task with Hardhat network, which" +
          "gets automatically created and destroyed every time. Use the Hardhat" +
          " option '--network localhost'"
      );
    }

    const [sender] = await ethers.getSigners();
    const tx = await sender.sendTransaction({
        to: receiver,
        value: ethers.constants.WeiPerEther,
      });
    await tx.wait();
    console.log(`Sent 1 ETH from ${sender.address} to ${receiver}`);
});

task("deposit", "Sends ETH and tokens to a contract")
  .addPositionalParam("contract", "The name of the contract")
  .setAction(async ({ contract }, { ethers }) => {
    if (network.name === "hardhat") {
      console.warn(
        "You are running the faucet task with Hardhat network, which" +
          "gets automatically created and destroyed every time. Use the Hardhat" +
          " option '--network localhost'"
      );
    }

    const [sender] = await ethers.getSigners();
    const contractAddress = require("./scripts/contract-address.json");

    const ContractArtifact = artifacts.readArtifactSync(contract);
    const Contract = new ethers.Contract(
        contractAddress[contract],
        ContractArtifact.abi,
        sender,  
    );

    const tx = await Contract.deposit({
      value: ethers.constants.WeiPerEther,
    });
    await tx.wait();
    console.log(`Sent 1 ETH from ${sender.address} to ${contract}`);
});


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
};
