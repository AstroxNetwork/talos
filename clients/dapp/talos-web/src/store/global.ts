import { createModel } from '@rematch/core';
import to from 'await-to-js';
import { RootModel } from './index.ts';
import { IWalletProvider, NetworkType } from '@wizz-btc/provider';
import { getPropByKey } from '../utils';
import { message } from '../component/EntryGlobal.tsx';
import { DelegationIdentity, Ed25519KeyIdentity } from '@dfinity/identity';
import { Canister, createDelegationChain } from '../canister';
import { JsonnableEd25519KeyIdentity } from '@dfinity/identity/lib/cjs/identity/ed25519';
import { JsonnableDelegationChain } from '@dfinity/identity/lib/cjs/identity/delegation';
import { bitcoin, toXOnly } from '@wizz-btc/wallet';

export type WalletProviderKey = 'wizz' | 'unisat' | 'atom' | 'okxwallet.bitcoinTestnet' | 'okxwallet.bitcoin';


type GlobalProps = {
  address?: string;
  publicKey?: string;
  jwt?: string;
  network?: NetworkType;
  providerKey?: WalletProviderKey;
  theme: 'light' | 'dark' | 'system';
  principal?: string;
  sessionIdentity: JsonnableEd25519KeyIdentity;
  delegationChain: JsonnableDelegationChain;
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
        const address = accounts[0];
        const [network, publicKey] = await Promise.all([
          provider.getNetwork(),
          provider.getPublicKey(),
        ]);
        // if (network != 'testnet') {
        //   network = await provider.switchNetwork('testnet').catch(() => {
        //     return '';
        //   });
        //   if (network != 'testnet') {
        //     return message.error('Please switch to Testnet.');
        //   }
        //   publicKey = await provider.getPublicKey();
        //   address = (await provider.requestAccounts())[0];
        // }
        const sessionIdentity = Ed25519KeyIdentity.generate();
        const sessionPublicKey = sessionIdentity.getPublicKey().toDer();
        const siwbActor = Canister.newSIWBActor();
        const prepareLogin = await siwbActor.siwb_prepare_login(address);
        if ('Err' in prepareLogin) {
          return message.error(prepareLogin.Err);
        }
        const msg = prepareLogin.Ok;
        const signed = await provider.signMessage(msg);
        const loginRes = await siwbActor.siwb_login(signed, address, publicKey, new Uint8Array(sessionPublicKey), { ECDSA: null });
        if ('Err' in loginRes) {
          return message.error(loginRes.Err);
        }
        const loginOk = loginRes.Ok;
        const delegationRes = await siwbActor.siwb_get_delegation(address, new Uint8Array(sessionPublicKey), BigInt(loginOk.expiration));
        if ('Err' in delegationRes) {
          return message.error(delegationRes.Err);
        }

        const delegationChain = createDelegationChain(delegationRes.Ok, loginOk.user_canister_pubkey);

        const pubkey = Buffer.from(publicKey, 'hex');
        const xonly = toXOnly(pubkey);
        const hash160 = bitcoin.crypto.hash160(xonly);

        const talosActor = Canister.newTalosActor(sessionIdentity);
        const registerRes = await talosActor.user_register(address, {
          hash160: Array.from(hash160),
          xonly: Array.from(xonly),
          pubkey: Array.from(pubkey),
        });
        if ('Err' in registerRes) {
          return message.error(registerRes.Err);
        }
        
        const principal = registerRes.Ok.principal.toText();


        dispatch.global.save({
          address,
          providerKey,
          network,
          publicKey,
          principal,
          sessionIdentity: sessionIdentity.toJSON(),
          delegationChain: delegationChain.toJSON(),
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
        sessionIdentity: undefined,
        delegationChain: undefined,
      });
      const key = state.global.address + ':' + state.global.network;
      dispatch.balance.save({
        [key]: null,
      });
    },
  }),
});
