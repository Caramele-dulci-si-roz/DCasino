import React from 'react';
import './css/App.css';
import MetaMaskRequired from './components/MetaMaskRequired';
import MetaMaskLoading from './components/MetaMaskLoading';
import CoinFlip from './components/CoinFlip';
import useMetamask from './hooks/useMetamask';

const HARDHAT_NETWORK_ID = '31337';

function App() {
  const {
    successful: metamaskSuccessfulInit, 
    error: metamaskError,
    account: metamaskAccount,
    balance: metamaskBalance,
    web3,
  } = useMetamask(HARDHAT_NETWORK_ID);

  if (!metamaskSuccessfulInit || metamaskError) return <MetaMaskRequired message={metamaskError as string} />;
  if (!metamaskAccount) return <MetaMaskLoading message='Waiting for account to connect.'/>;
  if (!web3) return <MetaMaskLoading message='Provider not available yet.'/>;
  
  return (
    <div>
      Current account: {metamaskAccount}. Balance: {metamaskBalance.toString()} Wei
      <CoinFlip account={metamaskAccount} provider={web3}/>
    </div>
  );
}

export default App;
