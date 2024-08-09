import { createModel } from '@rematch/core';
import to from 'await-to-js';
import { RootModel } from './index.ts';
import { IWalletProvider, NetworkType } from '@wizz-btc/provider';
import { getPropByKey } from '../utils';
import { message } from '../component/EntryGlobal.tsx';

export type WalletProviderKey = 'wizz' | 'unisat' | 'atom' | 'okxwallet.bitcoinTestnet' | 'okxwallet.bitcoin';


type GlobalProps = {
  address?: string;
  publicKey?: string;
  jwt?: string;
  network?: NetworkType;
  providerKey?: WalletProviderKey;
  theme: 'light' | 'dark' | 'system';
};


export const global = createModel<RootModel>()({
  state: {
    theme: 'system',
  } as GlobalProps,
  reducers: {
    save(state: GlobalProps, payload) {
      return {
        ...state,
        ...payload,
      };
    },
  },
  effects: (dispatch) => ({
    async connect(providerKey: WalletProviderKey) {
      const provider = getPropByKey(window, providerKey) as IWalletProvider;
      const [error, accounts] = await to(provider.requestAccounts());
      if (error) {
        return message.error(error.message || 'Connect failed, please try again later.');
      }
      if (accounts?.length) {
        let address = accounts[0];
        let [network, publicKey] = await Promise.all([
          provider.getNetwork(),
          provider.getPublicKey(),
        ]);
        if (network != 'testnet') {
          network = await provider.switchNetwork('testnet').catch(() => {
            return '';
          });
          if (network != 'testnet') {
            return message.error('Please switch to Testnet.');
          }
          publicKey = await provider.getPublicKey();
          address = (await provider.requestAccounts())[0];
        }
        // const [err, res] = await stakeApi.challenge({ params: { userAddress: address } });
        // if (err) {
        //   return message.error(err.message || 'Connect failed, please try again later.');
        // }
        // if (!res?.success) {
        //   return message.error(res?.message || 'Connect failed, please try again later.');
        // }
        // const data = res.data;
        // const [err1, s] = await to(provider.signMessage(data));
        // if (err1) {
        //   return message.error(err1.message || 'Connect failed, please try again later.');
        // }
        // const [err2, ret] = await stakeApi.login({
        //   data: {
        //     pubKey: publicKey,
        //     userAddress: address,
        //     signature: s!,
        //   },
        // });
        // if (err2) {
        //   return message.error(err2.message || 'Connect failed, please try again later.');
        // }
        // if (!ret?.success) {
        //   return message.error(ret?.message || 'Connect failed, please try again later.');
        // }
        dispatch.global.save({
          address,
          providerKey,
          network,
          publicKey,
        });
      } else {
        message.error('No accounts found');
      }
    },
    disconnect(_, state) {
      dispatch.global.save({
        address: undefined,
        publicKey: undefined,
        network: undefined,
        providerKey: undefined,
        jwt: undefined,
      });
      const key = state.global.address + ':' + state.global.network;
      dispatch.balance.save({
        [key]: null,
      });
    },
  }),
});
