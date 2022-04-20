import { MetaMaskInpageProvider } from '@metamask/providers';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { ethers } from 'ethers';
import { default as useRefState } from 'react-usestateref';

interface MetaMaskData {
    web3?: ethers.providers.Web3Provider;
    successful: boolean;
    error?: string;
    account?: string;
    balance: ethers.BigNumber;
}

const useMetaMask = (networkId: string): MetaMaskData => {
    const ethereum = window.ethereum as MetaMaskInpageProvider | undefined;
    const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : undefined;

    const [account, setAccount] = useState<string | undefined>();
    const [balance, setBalance, balanceRef] = useRefState<ethers.BigNumber>(ethers.BigNumber.from("0"));
    const [ethereumEvents, dispatchEthereumEvent] = useReducer(x => (x + 1) % 2, 0);

    const setBalanceIfChanged = (newBalance: ethers.BigNumber) => {
        if (!balanceRef.current.eq(newBalance)) setBalance(newBalance);
    };

    const connectAccountCb = useCallback(() => connectAccount(ethereum), [ethereum, ethereumEvents]);
    const listenWalletEventsCb = useCallback(() => listenWalletEvents(ethereum, setAccount, dispatchEthereumEvent), [ethereum]);
    const listenBlockchainEventsCb = useCallback(() => listenBlockchainEvents(provider, account, setBalanceIfChanged), [provider, account]);

    useEffect(() => { connectAccountCb().then(setAccount); }, [connectAccountCb]);
    useEffect(() => { listenWalletEventsCb() }, [listenWalletEventsCb]);
    useEffect(() => { listenBlockchainEventsCb() }, [listenBlockchainEventsCb]);

    if (ethereum === undefined) {
        return {
            successful: false,
            error: 'MetaMask is not installed/enabled',
            balance,
        };
    }

    if (ethereum.networkVersion !== networkId) {
        return {
            successful: false,
            error: `MetaMask is connected to the wrong network. Please switch to the ${networkId} network.`,
            balance,
        };
    }

    return {
        successful: true,
        web3: provider,
        account,
        balance,
    };
};

const connectAccount = async (ethereum: MetaMaskInpageProvider | undefined) => {
    if (ethereum === undefined) return undefined;

    const [selectedAddress] = await ethereum.request({ method: 'eth_requestAccounts' }) as Array<string>;
    return selectedAddress;
};

const getAccountBalance = async (provider: ethers.providers.Web3Provider | undefined, account: string | undefined): Promise<ethers.BigNumber> => {
    if (provider === undefined || account === undefined) return ethers.BigNumber.from("0");
    return await provider.getBalance(account);
};

const listenBlockchainEvents = (
    provider: ethers.providers.Web3Provider | undefined,
    account: string | undefined,
    setBalanceIfChanged: (newBalance: ethers.BigNumber) => void,
) => {
    if (provider === undefined || account === undefined) return;

    provider.on('block', () => getAccountBalance(provider, account).then(setBalanceIfChanged));
}

const listenWalletEvents = (
    ethereum: MetaMaskInpageProvider | undefined, 
    setAccount: React.Dispatch<React.SetStateAction<string | undefined>>,
    dispatchEvent: React.DispatchWithoutAction,
    ) => {

    if (ethereum === undefined) return;

    ethereum.on('accountsChanged', (...args: any[]) => setAccount(args[0][0]));
    ethereum.on('chainChanged', () => dispatchEvent());
};

export default useMetaMask;