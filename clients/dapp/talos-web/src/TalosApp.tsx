import { App as AntApp, ConfigProvider, theme } from 'antd';
import EntryGlobal from './component/EntryGlobal.tsx';
import Main from './ui/Main';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { darkTheme, getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { Chain } from 'viem/chains';
import { defineChain } from 'viem';
import React from 'react';

const queryClient = new QueryClient();

const coreDev: Chain = defineChain({
  id: 1112,
  name: 'Core Blockchain Devnet',
  nativeCurrency: {
    decimals: 18,
    name: 'dCORE',
    symbol: 'dCORE',
  },
  rpcUrls: {
    default: { http: ['https://rpc.dev.btcs.network'] },
  },
  blockExplorers: {
    default: {
      name: 'CoreDao Devnet',
      url: 'https://scan.dev.btcs.network',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 11_907_934,
    },
  },
  testnet: true,
});
const config = getDefaultConfig({
  appName: 'ARC20 Staking',
  projectId: 'f650ac7107adc07858f8d768fad2e829',
  chains: [coreDev],
});

function TalosApp() {
  return <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={darkTheme({
        borderRadius: 'small',
        accentColor: '#FF9813',
      })} coolMode locale={'en-US'}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#ff9813',
              colorLink: '#ff9813',
            },
            algorithm: theme.darkAlgorithm,
            components: {
              Checkbox: {
                colorPrimary: '#ff9813',
              },
              Button: {
                borderRadius: 4,
                borderRadiusLG: 4,
                borderRadiusSM: 4,
              },
              Input: {
                borderRadius: 4,
                borderRadiusLG: 4,
                borderRadiusSM: 4,
              },
              InputNumber: {
                borderRadius: 4,
                borderRadiusLG: 4,
                borderRadiusSM: 4,
              },
            },
          }}>
          <AntApp>
            <EntryGlobal />
            <Main />
          </AntApp>
        </ConfigProvider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>;
}

export default TalosApp;
