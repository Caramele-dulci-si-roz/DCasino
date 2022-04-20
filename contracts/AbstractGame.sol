// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/CommitReveal.sol";

abstract contract AbstractGame is Ownable {
    struct Bet {
        address payable player;
        uint amount;
        uint outcome;
        uint randomness;
    }

    uint constant INVALID_BET = 0;

    bytes32[] commits;
    Bet[] public bets;
    bool[] revealedBet;
    bool public houseCommited = false;
    bool public commitPhaseEnded = false;
    bool public houseRevealed = false;
    uint public houseCommitBlockNumber = 0;
    uint public gameTimeoutInBlocks = 100;
    uint public gameId = 0;

    struct GameStatus {
        bool bettingStarted;
        uint players;
        uint gameId;

        bool houseCommited;
        bool commitPhaseEnded;
        bool houseRevealed;
    }

    function deposit() external payable {}

    function gameStatus() public view returns (GameStatus memory) {
        uint players_ = 0;
        if (houseCommited) {
            players_ = bets.length - 1;
        }
        
        return GameStatus({
            bettingStarted: houseCommited && !commitPhaseEnded,
            players: players_,
            gameId: gameId,

            houseCommited: houseCommited,
            commitPhaseEnded: commitPhaseEnded,
            houseRevealed: houseRevealed
        });
    }

    function setGameTimeoutInBlocks(uint gameTimeoutInBlocks_) public onlyOwner {
        require(houseCommited == false, "Cannot change game timeout after the game has started.");

        gameTimeoutInBlocks = gameTimeoutInBlocks_;
    }

    event BetCommited(address indexed player, uint gameId, uint betId);

    function commitBet(bytes32 betHash, uint outcome_) public payable {
        require(houseCommited || msg.sender == owner(), "The house must commit first.");
        require(!commitPhaseEnded, "The commit phase has ended.");
        require(msg.sender == owner() || msg.value > 0, "The bet must be greater than 0.");
    
        validateBet(uint(msg.value), outcome_);

        uint commitId = CommitReveal.commit(betHash, commits);

        bets.push(Bet({
            player: payable(msg.sender),
            amount: msg.value,
            outcome: outcome_, 
            randomness: 0 // unkown at the commit stage
        }));
        revealedBet.push(false);

        if (msg.sender == owner()) {
            houseCommited = true;
            houseCommitBlockNumber = block.number;
            prepare();
        }

        emit BetCommited(msg.sender, gameId, commitId);
    }

    function prepare() internal virtual onlyOwner {}

    function validateBet(uint, uint) internal virtual {}

    event CommitPhaseEnded(uint gameId);

    function endCommitPhase() public onlyOwner {
        require(!commitPhaseEnded, "The commit phase has already ended.");

        commitPhaseEnded = true;
        emit CommitPhaseEnded(gameId);
    }

    function revealBet(uint betId, uint randomness) public {
        require(houseCommited, "The house must commit.");
        //require(commitPhaseEnded, "The commit phase has not ended yet.");
        require(!houseRevealed, "The house already revealed its bet.");
        require(betId < bets.length, "Invalid bet id.");

        bets[betId].randomness = randomness;
        require(CommitReveal.isValidReveal(betId, abi.encode(bets[betId]), commits), "Invalid bet hash.");
        
        revealedBet[betId] = true;

        if (msg.sender == owner()) {
            houseRevealed = true;
            play();
        }
    }

    event GamePlayed(uint gameId, uint randomness);

    event FailedPayout(address indexed player, uint gameId, uint amount);
    event Payout(address indexed player, uint gameId, uint amount);

    function play() private {
        uint commitsSum = 0;
        for (uint i = 0; i < commits.length; i++) {
            commitsSum += uint(commits[i]) % 2e7;
            commitsSum %= 2e7;

            // keep only the bets that have been revealed
            if (!revealedBet[i]) {
                bets[i].player.transfer(bets[i].amount);
                bets[i].amount = INVALID_BET;
            } else if (bets[i].player == owner()) {
                bets[i].amount = INVALID_BET;
            }
        }

        uint randomness = uint(keccak256(abi.encode(block.timestamp, msg.sender, commitsSum)));
        emit GamePlayed(gameId, randomness);
        game(bets, randomness);

        gameId++;
        reset();
    }
    function abort() public {
        require(block.number > houseCommitBlockNumber + gameTimeoutInBlocks, "Game has not expired yet.");
        require(houseCommited, "No game to abort.");
        require(!houseRevealed, "The house already revealed its bet.");

        // The game is aborted, refund everyone
        for (uint i = 0; i < bets.length; i++) {
            if (bets[i].player != owner()) {
                (bool success, ) = bets[i].player.call{value: bets[i].amount}("");
                if (!success) {
                    emit FailedPayout(bets[i].player, gameId, bets[i].amount);
                }
            }
        }

        reset();
    }

    function reset() private onlyOwner {
        cleanup();
        delete bets;
        delete commits;
        houseCommited = false;
        commitPhaseEnded = false;
        houseRevealed = false;
        houseCommitBlockNumber = 0;
    }

    function cleanup() internal virtual onlyOwner {}

    function game(Bet[] memory bets_, uint randomness) internal virtual;
}
