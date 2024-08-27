import { ConnectButton } from '@rainbow-me/rainbowkit';
import React from 'react';
import { Button } from 'antd';
import IconCore from '@/assets/icons/core_staking.png';

export default function RainbowConnectButton() {
  return <ConnectButton.Custom>
    {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
      // Note: If your app doesn't use authentication, you
      // can remove all 'authenticationStatus' checks
      const ready = mounted && authenticationStatus !== 'loading';
      const connected =
        ready &&
        account &&
        chain &&
        (!authenticationStatus ||
          authenticationStatus === 'authenticated');

      if (!connected) {
        return (
          <Button size={'small'} onClick={openConnectModal} className={'text-xs rounded-3xl !px-1.5 gap-1'}>
            <img src={IconCore} alt="Core" className={'w-4 h-4'} />Connect Core Wallet
          </Button>
        );
      }

      if (chain.unsupported) {
        return (
          <Button size={'small'} onClick={openChainModal} className={'text-xs rounded-3xl !px-1.5 gap-1'}>
            <img src={IconCore} alt="Core" className={'w-4 h-4'} />Wrong network
          </Button>
        );
      }

      return (
        <Button size={'small'} onClick={openAccountModal} className={'text-xs rounded-3xl !px-1.5 gap-1'}>
          <img src={IconCore} alt="Core" className={'w-4 h-4'} />{account.displayName}
        </Button>
      );
    }}
  </ConnectButton.Custom>;
}