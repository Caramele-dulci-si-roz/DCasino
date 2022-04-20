import React, { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';

import CoinFlipArtifact from "../contracts/CoinFlip.json";
import contractAddress from "../contracts/contract-address.json";
import { CoinFlip as CoinFlipContract } from "../typechain-types/contracts/CoinFlip";
import { AbstractGame } from "../typechain-types/contracts/AbstractGame";

import { useForm, SubmitHandler } from "react-hook-form";
import { default as useRefState } from 'react-usestateref';

interface Props {
    account: string;
    provider: ethers.providers.Web3Provider;
}

enum CoinValue {
    HEADS,
    TAILS
}

type Inputs = {
    amount: number,
    bet: CoinValue,
};

interface Bet {
    address: string;
    amount: number;
    outcome: CoinValue;
    randomness: number;

    id?: ethers.BigNumber;
    gameId?: ethers.BigNumber;
}

const CoinFlip: React.FC<Props> = (props: Props) => {
    const {provider} = props;
    const contract = new ethers.Contract(
        contractAddress.CoinFlip,
        CoinFlipArtifact.abi,
        provider.getSigner(0),  
    ) as CoinFlipContract;

    const [gameStatus, setGameStatus, gameStatusRef] = useRefState<AbstractGame.GameStatusStructOutput | undefined>(undefined);

    const [bet, setBet, betRef] = useRefState<Bet | undefined>(undefined);
    const [message, setMessage] = useState<string | undefined>(undefined);
    const [txError, setTxError] = useState<string | undefined>(undefined);
    const [payoutHistory, setPayoutHistory, payoutHistoryRef] = useRefState<{[key: string]: any}>({});
    const [gameHistory, setGameHistory, gameHistoryRef] = useRefState<{[key: string]: any}>({});
    const { register, handleSubmit } = useForm<Inputs>();
    const onSubmit: SubmitHandler<Inputs> = async data => {
        const newBet: Bet = {
            address: props.account,
            amount: data.amount,
            outcome: data.bet,
            randomness: Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER),
        };

        try {
            const tx = await commitBet(contract, newBet);
            const receipt = await tx.wait();
            
            if (receipt.events) {
                const betId = receipt.events[0].args?.betId;
                newBet.id = betId;
            }

            if (gameStatusRef.current?.gameId) {
                newBet.gameId = gameStatusRef.current.gameId;
            }

            console.log('Placed bet', {bet: newBet});
            setTimeout(() => {
                if (betRef.current && betRef.current.id) {
                    contract.revealBet(betRef.current.id, betRef.current.randomness)
                        .then(() => {
                            setBet(undefined);
                            setMessage('Bet revealed. Wait for game results.');
                        });
                }
            }, 3000);
            setBet(newBet);
            setTxError(undefined);
            setMessage('Bet placed, wait for revealing phase.');
        } catch (error: any) {
            setTxError(error.data.message);
        }
    };

    const fetchGameStatusCb = useCallback(async () => {
        const gameStatus = await contract.gameStatus();
        return gameStatus;
    }, [bet]);

    useEffect(() => {
        contract.on(contract.filters.CommitPhaseEnded(), async (gameId, event) => {
            console.log('Commit end', {gameId, event});
            if (betRef.current && betRef.current.id && betRef.current.gameId?.toString() === gameId.toString()) {
                await contract.revealBet(betRef.current.id, betRef.current.randomness);
                setBet(undefined);
                setMessage('Bet revealed. Wait for game results.');
            } else {
                console.error("Bad bet.", {gameId, bet: betRef.current});
            }
        });

        contract.on(contract.filters.GamePlayed(), (gameId, randomness) => {
            if (gameHistoryRef.current[gameId.toString()]) {
                return;
            }

            setGameHistory({
                ...gameHistoryRef.current,
                [gameId.toString()]: {
                    gameId,
                    randomness,
                }
            })

            if (gameStatusRef.current?.gameId && gameStatusRef.current?.gameId.lt(gameId)) {
                setMessage(`Game #${gameStatusRef.current?.gameId} ended. Place your new bet.`);
            }
        })

        contract.on(contract.filters.Payout(props.account), (account, gameId, amount) => {
            if (payoutHistoryRef.current[gameId.toString()]) {
                return;
            }

            setPayoutHistory({
                ...payoutHistoryRef.current,
                [gameId.toString()]: {
                    gameId,
                    amount,
                }
            })
        });
    }, []);
    
    useEffect(() => { fetchGameStatusCb().then(setGameStatus); }, [fetchGameStatusCb]);

    if (!gameStatus) return <div>CoinFlip game is loading...</div>;

    return <div>
        <h1>Coin Flip (game #{gameStatus.gameId.toString()})</h1>
        <h2>Every game phase has 20 seconds (bet, reveal, results)</h2>
        <p>{gameStatus.bettingStarted ? "Betting STARTED!" : "Betting did not start." }</p>
        <p>Players: {gameStatus.players.toString()}</p>

        {message ? <p>{message}</p> : null}
        {txError ? <p>{txError}</p> : null}

        <form onSubmit={handleSubmit(onSubmit)}>
            <label>Amount (Wei):</label>
            <input type="number" {...register("amount", {valueAsNumber: true})} />
            <label>Bet:</label>
            <select {...register("bet", {valueAsNumber: true})}>
                <option value={CoinValue.HEADS}>Heads</option>
                <option value={CoinValue.TAILS}>Tails</option>
            </select>
            <input type="submit" disabled={bet ? true : false} />
        </form>

        <div>
            Payout history
            <ol>
                {Object.keys(payoutHistory).map(key => (<li key={payoutHistory[key].gameId.toString()}>
                    Game #{payoutHistory[key].gameId.toString()}: payout = {payoutHistory[key].amount.toString()}
                    </li>))}
            </ol>
        </div>

        <div>
            Games history
            <ol>
                {Object.keys(gameHistory).map(key => (<li key={gameHistory[key].gameId.toString()}>
                    Game #{gameHistory[key].gameId.toString()}: random seed = {gameHistory[key].randomness.toString()}
                    </li>))}
            </ol>
        </div>

    </div>;
}

const commitBet = async (contract: CoinFlipContract, bet: Bet) => {
    return contract.commitBet(
        hashBet([bet.address, bet.amount, bet.outcome, bet.randomness]),
        bet.outcome,
        { value: bet.amount }
    );
}

const betABI = ["address", "uint", "uint", "uint"];
const hashBet = (bet: [string, number, number, number]) => {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(betABI, bet));
}

export default CoinFlip;