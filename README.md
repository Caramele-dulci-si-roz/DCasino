# DCasino

Transparent, reproducible, and secure gambling on the blockchain. This is a proof-of-concept project illustrating how multiple parties (gamblers) could participate in gambling activities with little trust in the casino entity. 

1. [Motivation](#motivation)
2. [Solution overview](#solution-overview)
3. [Implementation details](#implementation-details)
4. [Usage](#usage)

## Motivation

Gambling is a popular activity and has a long history of deception, dishonest parties engaging in gambling activities at the expense of the honest ones. There are plenty of examples of rigged casino games both in the physical and the virtual world: slot machines paying less than they say, magnetic roulette balls, online casinos manipulating outcomes in their favor, etc. To avoid such events, we assert that the following properties are required:
* transparency - the mechanics of the game are visible to the players (including outcome probabilities, house edge, etc.)
* immutability - the house is unable to alter the mechanics of a game while players are participating
* reproducibility - given the initial conditions, players should be able to recompute the outcomes of the games
* trustless - the players shouldn't be concerned about payouts not being paid or that any other player has an advantage 

Our objective is to build a proof-of-concept application meeting all the requirements above.

## Solution overview

Our solution is based on Ethereum smart contracts and a commit-reveal scheme. It successfully acquires all the requirements we already stated, and we will provide some sound arguments in the paragraphs below to support our point. 

Transparency is guaranteed by the public nature of the blockchain, every bit of information is publicly available to everyone and the smart contracts' code is no exception. One could analyse the code of the game they are going to play and decide if it can be trusted to be fair. As smart contracts can't be replaced, there is no worry that the code could be changed. Even so, assuming the casino deployed some patching mechanism in the contract itself, the transparency property allows the user to decide if immutability is violated or not and take an action accordingly. Until now, we managed to provide a transparent and immutable game environment based solely on the features provided by the Ethereum blockchain. Next, we will describe how we achieve reproducibility when the game outcomes must be random, which is a little bit trickier.

The Ethereum Virtual Machine (EVM) is purely deterministic, so there is no way of generating true random numbers. One could rely on somewhat random data like the block number or the timestamp of the block, but those can be influenced by miners. To bypass this obstacle, we rely on the participants to provide true random numbers which will be combined and used as the seed of Pseudo Random Number Generator (PRNG) to compute the outcomes of the game. To avoid players predicting the outcomes before the games ends, we use a commit-reveal scheme which works the following way:
1. betting started, players (including the house) commit to some locally generated random number and a bet -> `commit(hash of random, bet)`
2. after everyone placed their bets, the random numbers are revealed and the hashes are checked so we know that numbers were not changed -> `reveal(random, bet)`
3. the house computes the outcomes of the game using the random seeds and awards the payouts -> `outcome(sum of randoms)`

![gambling blockchain drawio (2)](https://user-images.githubusercontent.com/10727813/161435411-2a04e061-4f79-45f9-95da-797a6e7dfbb6.png)

Downsides of the approach:
* some parties could miss the reveal step thus delaying the game and losing their entire bet
* not suitable for real-time games, each step (commit, reveal, payout) is slow (~15 seconds for a single block to be mined on ETH)

Reference: https://ethereum.stackexchange.com/questions/191/how-can-i-securely-generate-a-random-number-in-my-smart-contract

## Implementation details

The commit-reveal scheme implementaion could be found in (CommitReveal.sol)[./contracts/lib/CommitReveal.sol] and consists of just two functions one for adding the commit in an array and the other one for checking if a reveal is valid. We rely on `keccak256` hashing for commits.

A generic implementation of a game is provided in (AbstractGame.sol)[./contracts/lib/AbstractGame.sol]. This way the logic behind betting is not duplicated for each game. It provides an API for commiting and revealing bets and it automatically triggers the payout when the house decides to reveal its bet. Also, there is an abort function which can be called by any player if the house did not perform any action for long enough (`gameTimeoutInBlocks`).
```solidity
function commitBet(bytes32 betHash, uint outcome_) public payable;
function revealBet(uint betId, uint randomness) public;
function abort() public;
```

Concrete games have to implement the main method `function game(Bet[] memory bets_, uint randomness) internal virtual;` which is responsible for calculating the outcomes and paying the rewards. For example, the (CoinFlip.sol)[./contracts/lib/CoinFlip.sol] game tosses a coin by using the modulo operation on the random value. The random value is the sum of all random values provided by the players and the house.
```
uint value = randomness % 1000;
if (value < 480) {
    outcome = uint(CoinValue.HEADS);
} else if (value < 960) {
    outcome = uint(CoinValue.TAILS);
} else {
    outcome = uint(CoinValue.EDGE);
}
```

The frontend application simply connects to a MetaMask wallet using a custom written hook (using Ethers.js library) and grabs the game state from the contract. Placing bets is done by calling the contract functions and authorizing them from MetaMask. Contract events are monitored so we can inform the user when the state of the game changes as soon as possible:
```
event CommitPhaseEnded(uint gameId);
event GamePlayed(uint gameId, uint randomness);
event FailedPayout(address indexed player, uint gameId, uint amount);
event Payout(address indexed player, uint gameId, uint amount);
```

The entire application is built on top of HardHat framework. It provides a nice "glue" between smart contracts' ABI, frontend JavaScript libraries, and TypeScript types. It also provides utilities to deploy a local blockchain and manage wallets.

## Usage

Install the dependencies using `npm install` and start the HardHat network `npx hardhat node`. Now, use the deploy script to compile, deploy and copy contracts' ABIs to the right location. Don't forget to deposit some ethers to the game contract and the account of the casino, otherwise it won't have enough money to operate. Afterwards, run the casino bot (`scripts/house-play.js`) because the game can't proceed without it. Finally, start the frontend application with `npm start`. You'll need a MetaMask wallet installed in your browser connected to the HardHat network. Happy gambling! 
