import { Button, Dropdown, List, MenuProps, Modal, Typography } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { RootDispatch, RootState } from '@/store';
import copy from 'copy-to-clipboard';
import { useEffect, useState } from 'react';
import IconWizz from '@/assets/icon/wizz.svg';
import { DisconnectOutlined, HistoryOutlined } from '@ant-design/icons';
import { useAddress, useLoading, useNetwork } from '../hook';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import { message } from './EntryGlobal.tsx';
import { getPropByKey, shortAddress } from '../utils';
import { WalletProviderKey } from '@wizz-btc/provider';

const providers: Record<string, any> = [
  {
    icon: IconWizz,
    name: 'Wizz Wallet',
    key: 'atom',
  },
  // {
  //   icon: IconUnisat,
  //   name: 'Unisat Wallet',
  //   key: 'unisat',
  // },
  // {
  //   icon: IconOkx,
  //   name: 'OKX Wallet',
  //   key: 'okxwallet.bitcoin',
  // },
  // {
  //   icon: IconBitget,
  //   name: 'Bitget Wallet',
  //   key: 'bitkeep.unisat',
  // },
];


const ConnectButton = () => {
  const dispatch = useDispatch<RootDispatch>();
  const network = useNetwork();
  const address = useAddress();
  const [loading, loadingPlus, loadingMinus] = useLoading();
  const providerKey = useSelector((state: RootState) => state.global?.providerKey);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const breakpoint = useBreakpoint();
  useEffect(() => {
    if (providerKey) {
      const provider = getPropByKey(window, providerKey);
      if (provider) {
        provider.getAccounts().then((accounts) => {
          if (accounts.length) {
            provider.switchNetwork('testnet').catch(() => '').then(async (v: string) => {
              if (v == 'testnet') {
                const publicKey = await provider.getPublicKey();
                dispatch.global.save({
                  address: accounts[0],
                  publicKey,
                  network: v,
                });
              } else {
                dispatch.global.disconnect();
              }
            });
          } else {
            dispatch.global.disconnect();
          }
        });
      }
    }
  }, [address, dispatch.global, network.type, providerKey]);
  if (address) {
    const items: MenuProps['items'] = [
      {
        key: 'history',
        label: <><HistoryOutlined /><span className="ml-2">View History</span></>,
        onClick: () => {
          window.open(`${network.mempoolUrl}/address/${address}`, '_blank');
        },
      },
      {
        key: 'disconnect',
        label: <><DisconnectOutlined /><span className="ml-2">Disconnect</span></>,
        onClick: () => {
          dispatch.global.disconnect();
        },
      },
    ];
    const isMobile = breakpoint === 'xs';
    return (
      <Dropdown menu={{ items }} placement="bottomRight" className="relative">
        <Button size={'large'} className={`leading-4 relative ${isMobile ? 'w-8 h-8' : ''}`}
                onClick={() => {
                  copy(address);
                  message.destroy();
                  message.success('Copied');
                }}>
          <img src={network.icon} alt={network.type} title={network.type} className={'w-4 h-4'} />
          {isMobile ? null : shortAddress(address)}
        </Button>
      </Dropdown>
    );
  }

  const handleConnect = (key: string) => {
    loadingPlus();
    dispatch.global.connect(key as WalletProviderKey).finally(() => {
      loadingMinus();
    });
  };

  const handleOnClick = async () => {
    setShowProviderModal(true);
  };

  return <>
    <Button type="primary" size={'large'} className="leading-4 min-w-[100px]" onClick={handleOnClick}>
      Connect Bitcoin Wallet
    </Button>
    <Modal
      open={showProviderModal}
      centered
      onCancel={() => {
        setShowProviderModal(false);
      }}
      footer={false}>
      <Typography.Title className="mt-4" level={3}>Connect a wallet to continue</Typography.Title>
      <Typography.Text type="secondary">
        Choose how you want to connect. If you don't have a wallet, you can select a provider and create one.
      </Typography.Text>
      <List
        loading={loading}
        className="mt-8"
        itemLayout="horizontal"
        dataSource={providers}
        renderItem={(item) => (
          <List.Item onClick={() => handleConnect(item.key)}>
            <div className="flex items-center cursor-pointer w-full">
              <img src={item.icon} alt={item.name}
                   className="w-10 h-10 rounded-xl object-contain p-1 overflow-hidden" />
              <div className="ml-4 !mb-0 flex-1">
                <div className="text-xl leading-none relative">
                  {item.name}
                  {item.badge ?
                    <span className="absolute ml-2 -top-1 text-xs bg-primary px-1 py-0.5 rounded font-bold"
                          style={{
                            transform: 'scale(0.8)',
                            transformOrigin: 'left top',
                          }}>{item.badge}</span> : null}
                </div>
                {item.extra ? <div className="text-green-500 text-xs">{item.extra}</div> : null}
                {item.text ? <div className="text-xs">{item.text}</div> : null}
              </div>
              {
                providerKey === item.key ?
                  <span className="text-sm text-primary">Last Used</span>
                  : null
              }
            </div>
          </List.Item>
        )}
      />
    </Modal>
  </>;
};

export default ConnectButton;
