import { App as AntApp, ConfigProvider, theme } from 'antd';
import EntryGlobal from './component/EntryGlobal.tsx';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { darkTheme, getDefaultConfig, lightTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { Chain, coreDao } from 'viem/chains';
import { defineChain } from 'viem';
import React, { useEffect } from 'react';
import Page from './ui/Page';
import { useThemeMode } from './hook';

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
  appName: 'Talos Staking',
  projectId: 'f650ac7107adc07858f8d768fad2e829',
  chains: [coreDao, coreDev],
});

function TalosApp() {
  const themeMode = useThemeMode();
  useEffect(() => {
    document.body.className = `talos-${themeMode}`;
  }, [themeMode]);
  const [rkTheme, antTheme] = themeMode === 'dark' ? [darkTheme({
    accentColor: '#1668dc',
  }), theme.darkAlgorithm] : [lightTheme({
    accentColor: '#1668dc',
  }), theme.defaultAlgorithm];
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} coolMode locale={'en-US'}>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: '#1668dc',
                colorLink: '#1668dc',
              },
              algorithm: antTheme,
              components: {
                Checkbox: {
                  colorPrimary: '#1668dc',
                },
              },
            }}>
            <AntApp>
              <EntryGlobal />
              <Page />
            </AntApp>
          </ConfigProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default TalosApp;
