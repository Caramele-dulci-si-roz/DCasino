// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "./AbstractGame.sol";

contract CoinFlip is AbstractGame {
    enum CoinValue {
        HEADS,
        TAILS,
        EDGE
    }

    uint forPrizes = 0;
    uint bank = 0;

    function prepare() internal virtual override onlyOwner {
        bank = address(this).balance;
    }

    function game(Bet[] memory bets_, uint randomness) internal override {
        // 48 / 48 / 4 chances for TAILS, HEADS, EDGE

        uint outcome;
        uint value = randomness % 1000;

        if (value < 480) {
            outcome = uint(CoinValue.HEADS);
        } else if (value < 960) {
            outcome = uint(CoinValue.TAILS);
        } else {
            outcome = uint(CoinValue.EDGE);
        }

        for (uint i = 0; i < bets_.length; i++) {
            if (bets_[i].amount == INVALID_BET) continue;

            if (bets_[i].outcome == outcome) {
                bets_[i].player.transfer(bets_[i].amount * 2);
            }
        }
    }

    function validateBet(uint amount, uint outcome) internal virtual override {
        require(outcome == uint(CoinValue.HEADS) || outcome == uint(CoinValue.TAILS), "Invalid outcome.");
        require(forPrizes + amount <= bank, "Not enough house funds.");

        forPrizes += amount;
    }

    function cleanup() internal virtual override onlyOwner {
        forPrizes = 0;
    }
}