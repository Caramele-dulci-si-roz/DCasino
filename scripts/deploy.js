const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {
  await hre.run('compile');

  const [owner] = await ethers.getSigners();
  console.log(`House address: ${owner.address}`);

  // Deploy libraries
  const CommitReveal = await ethers.getContractFactory("CommitReveal");
  const commitReveal = await CommitReveal.deploy();
  await commitReveal.deployed();

  const librariesConfig = {
    libraries: {
      CommitReveal: commitReveal.address,
    }
  }

  // Deploy contracts
  const HouseAlwaysWins = await ethers.getContractFactory("HouseAlwaysWins", {...librariesConfig});
  const houseAlwaysWins = await HouseAlwaysWins.deploy();
  
  const CoinFlip = await ethers.getContractFactory("CoinFlip", {...librariesConfig});
  const coinFlip = await CoinFlip.deploy();

  await Promise.all([
    await houseAlwaysWins.deployed(),
    await coinFlip.deployed(),
  ]);

  console.log(`HouseAlwaysWins: ${houseAlwaysWins.address}`);
  console.log(`CoinFlip: ${coinFlip.address}`);

  await houseAlwaysWins.deposit({value: ethers.constants.WeiPerEther});
  await coinFlip.deposit({value: ethers.constants.WeiPerEther});

  saveFrontendFiles({
    'HouseAlwaysWins': houseAlwaysWins,
    'CoinFlip': coinFlip,
  });
}

function saveFrontendFiles(contracts) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";
  const typesDir = __dirname + "/../frontend/src/typechain-types";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  const addresses = {};
  for (const name in contracts) {
    addresses[name] = contracts[name].address;

    const artifact = artifacts.readArtifactSync(name);

    fs.writeFileSync(
      contractsDir + `/${name}.json`,
      JSON.stringify(artifact, null, 2)
    );
  }

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify(addresses, undefined, 2)
  );

  fs.writeFileSync(
    __dirname + "/contract-address.json",
    JSON.stringify(addresses, undefined, 2)
  );

  fs.cpSync('./typechain-types', typesDir, {recursive: true});
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
