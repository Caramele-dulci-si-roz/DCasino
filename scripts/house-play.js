const { ethers } = require("hardhat");
const contractAddress = require("./contract-address.json");

const betABI = ["address", "uint", "uint", "uint"];
const hashBet = (bet) => {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(betABI, bet));
}

async function main() {
    const [owner] = await ethers.getSigners();
    console.log(`House address: ${owner.address}`);

    const CoinFlipArtifact = artifacts.readArtifactSync("CoinFlip");

    const CoinFlip = new ethers.Contract(
        contractAddress.CoinFlip,
        CoinFlipArtifact.abi,
        owner,  
    );

    let lastRandomSeed = null;

    const game = async () => {
        const gameStatus = await CoinFlip.gameStatus();
        console.log(`=== Periodic check - game #${gameStatus.gameId} ===`);

        if (!gameStatus.houseCommited) {
            console.log("House will commit. Betting will start.");
            lastRandomSeed = Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER);
            await CoinFlip.commitBet(hashBet([
                owner.address,
                0, // ignored amount
                0, // ignored outcome
                lastRandomSeed
            ]), 0);
        } else if (gameStatus.houseCommited && !gameStatus.commitPhaseEnded && gameStatus.players > 0) {
            console.log("Betting phase ended. Players should reveal their bets.");
            await CoinFlip.endCommitPhase();
        } else if (gameStatus.houseCommited && gameStatus.commitPhaseEnded) {
            console.log("Revealing phase ended. House will reveal its bet. LET'S PLAY!");
            try {
                const tx = await CoinFlip.revealBet(0, lastRandomSeed);
                const receipt = await tx.wait();
                
                for (const event of receipt.events) {
                    const allArgs = event.args.map(arg => arg.toString()).join(", ");
                    console.log(`${event.event}: ${allArgs}`);
                }

                await game();
            } catch (e) {
                console.log(e);
            }
        } else {
            console.log("Nothing to do.");
        }
    };

    await game();
    setInterval(() => game(), 20000);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
