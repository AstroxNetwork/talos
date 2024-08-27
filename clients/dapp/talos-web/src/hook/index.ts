import {
  InscriptionItem,
  IWalletProvider,
  NetworkType,
  Rune,
  RuneWithValue,
  WalletAssetBalance,
} from '@wizz-btc/provider';
import { bitcoin } from '@wizz-btc/wallet';
import IconBitcoinMainnet from '@/assets/icons/bitcoin.svg';
import IconBitcoinTestnet from '@/assets/icons/bitcoin_testnet.svg';
import IconBitcoinSignet from '@/assets/icons/bitcoin_signet.svg';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { ElectrumApi, MempoolApi } from '@wizz-btc/api';
import { useDispatch, useSelector } from 'react-redux';
import { RootDispatch, RootState } from '../store';
import { balanceOf } from '@wizz-btc/helpers';
import { OrdXApi, useOrdXApi } from '../service/ordx';
import { getPropByKey } from '../utils';
import { App } from 'antd';
import { DelegationChain, DelegationIdentity, Ed25519KeyIdentity } from '@dfinity/identity';
import { Canister } from '../canister';
import { Network } from 'bitcoinjs-lib';

export type NetworkEntry = {
  color: string;
  electrumApi: string;
  ordxApi: string;
  icon: string;
  mempoolUrl: string;
  type: string;
  symbol: string;
  mempoolApi: string;
  network: Network;
  supportInscriptions: boolean;
  supportAtomicals: boolean;
  supportRunes: boolean;
};
export const NETWORKS: Record<string, NetworkEntry> = {
  mainnet: {
    type: 'mainnet',
    network: bitcoin.networks.bitcoin,
    icon: IconBitcoinMainnet,
    color: '#f7931a',
    symbol: 'BTC',
    mempoolUrl: 'https://mempool.space',
    mempoolApi: 'https://mempool.space/api',
    electrumApi: 'https://ep.wizz.cash/proxy',
    ordxApi: 'https://ordx-test.wizz.cash',
    supportAtomicals: true,
    supportRunes: true,
    supportInscriptions: true,
  },
  testnet: {
    type: 'testnet',
    symbol: 'tBTC',
    network: bitcoin.networks.testnet,
    icon: IconBitcoinTestnet,
    color: '#5fd15c',
    mempoolUrl: 'https://mempool.space/testnet',
    mempoolApi: 'https://mempool.space/testnet/api',
    electrumApi: 'https://eptest.wizz.cash/proxy',
    ordxApi: 'https://ordx-test.wizz.cash',
    supportAtomicals: true,
    supportRunes: true,
    supportInscriptions: true,
  },
  testnet4: {
    type: 'testnet4',
    symbol: 'tBTC',
    network: bitcoin.networks.testnet,
    icon: IconBitcoinTestnet,
    color: '#5fd15c',
    mempoolUrl: 'https://mempool.space/testnet4',
    mempoolApi: 'https://mempool.space/testnet4/api',
    electrumApi: 'https://eptestnet4.wizz.cash/proxy',
    ordxApi: 'https://ordx-test.wizz.cash',
    supportAtomicals: true,
    supportRunes: false,
    supportInscriptions: false,
  },
  signet: {
    type: 'signet',
    symbol: 'sBTC',
    network: bitcoin.networks.testnet,
    icon: IconBitcoinSignet,
    color: '#b028aa',
    mempoolUrl: 'https://mempool.space/signet',
    mempoolApi: 'https://mempool.space/signet/api',
    electrumApi: 'https://eptest.wizz.cash/proxy',
    ordxApi: 'https://ordx-test.wizz.cash',
    supportAtomicals: false,
    supportRunes: false,
    supportInscriptions: false,
  },
};

export function useMempoolApi() {
  const network = useNetwork();
  return useMemo(() => new MempoolApi(network.mempoolApi), [network.mempoolApi]);
}

export function useLoading(): [boolean, () => void, () => void, number] {
  const [count, setCount] = useState(0);

  const increment = useCallback(() => {
    setCount((prevCount) => prevCount + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount((prevCount) => prevCount - 1);
  }, []);

  return [count > 0, increment, decrement, count];
}


export function toNetwork(network: NetworkType) {
  if (network === 'testnet') {
    return NETWORKS.testnet;
  }
  if (network === 'testnet4') {
    return NETWORKS.testnet4;
  }
  if (network === 'signet') {
    return NETWORKS.signet;
  }
  if (network == 'mainnet' || network == 'livenet') {
    return NETWORKS.mainnet;
  }
  return NETWORKS.testnet;
}

export function useNetwork() {
  const networkType = useSelector((state: RootState) => state.global.network) as NetworkType || 'mainnet';
  return toNetwork(networkType);
}

export function useJWT() {
  return useSelector((state: RootState) => state.global.jwt);
}

export function useAddress() {
  return useSelector((state: RootState) => state.global.address);
}

export function usePublicKey() {
  return useSelector((state: RootState) => state.global.publicKey);
}


export function useMessage() {
  return App.useApp().message;
}


export function useElectrumApi() {
  const network = useNetwork();
  return useMemo(() => new ElectrumApi(network.electrumApi), [network.electrumApi]);
}

export type WalletBalance = WalletAssetBalance & {
  loading: boolean;
  refresh: () => any;
  address: string;
  principal?: string;
  publicKey?: string;
  network: NetworkEntry;
};

export async function listInscriptions(
  wallet: {
    getAddressInscriptions: (
      address: string,
      cursor: number,
      size: number,
    ) => Promise<{
      list: InscriptionItem[];
      total: number;
    }>;
  },
  addr: string,
) {
  const items: InscriptionItem[] = [];
  let cursor = 0;
  const size = 100;
  let hasMore = true;
  while (hasMore) {
    const v = await wallet.getAddressInscriptions(addr, cursor, size);
    const list = v?.list as any;
    if (Array.isArray(list)) {
      items.push(...list);
      cursor += size;
      hasMore = items.length < v.total;
    } else {
      hasMore = false;
    }
  }
  return items;
}

export async function listRunes(ordXApi: OrdXApi, outpoints: string[]) {
  const [err, res] = await ordXApi.outputs({
    data: outpoints,
  });
  if (err) {
    throw err;
  }
  if (!res) {
    throw new Error('Invalid response');
  }
  if (!res.success) {
    throw new Error(res.message);
  }
  const obj = res.response || {};
  if (!Array.isArray(obj.runes) || !Array.isArray(obj.outputs)) {
    throw new Error('Invalid response');
  }
  const runesMap: Record<string, Rune> = {};
  for (const rune of obj.runes) {
    runesMap[rune.rune_id] = rune;
  }
  const outpointToRuneValues: Record<string, RuneWithValue[]> = {};
  const outputs = obj.outputs;
  for (let i = 0; i < outpoints.length; i++) {
    const outpoint = outpoints[i];
    const output = outputs[i];
    if (!output) {
      throw new Error('Invalid output');
    }
    if (!Object.keys(output).length) {
      continue;
    }
    for (const runeId in output) {
      const rune = runesMap[runeId];
      if (!outpointToRuneValues[outpoint]) {
        outpointToRuneValues[outpoint] = [];
      }
      const find = outpointToRuneValues[outpoint]!;
      const runeValue = BigInt(output[runeId]);
      find.push({ ...rune, rune_value: runeValue });
    }
  }
  return outpointToRuneValues;
}

export const useWalletProvider = () => {
  let key = useSelector((state: RootState) => state.global?.providerKey);
  const address = useAddress();
  if (!key && address) {
    key = 'wizz';
  }
  if (key) {
    const provider = getPropByKey(window, key);
    if (provider) return provider as IWalletProvider;
  }
  return undefined;
};


export function usePrincipal() {
  return useSelector((state: RootState) => state.global.principal);
}

export function useBalance(): WalletBalance {
  const electrumApi = useElectrumApi();
  const address = useAddress();
  const network = useNetwork();
  const dispatch = useDispatch<RootDispatch>();
  const mempoolApi = useMempoolApi();
  const provider = useWalletProvider();
  const principal = usePrincipal();
  const publicKey = usePublicKey();
  const ordXApi = useOrdXApi();
  const [loading, plusLoading, minusLoading] = useLoading();
  const cacheKey = `${address}:${network}`;
  const balance = useSelector((state: RootState) => state.balance[cacheKey]) || emptyBalance();
  const [r, refresh] = useReducer((x) => x + 1, 0);
  const loadBalance = useCallback(async () => {
    if (!address) {
      return;
    }
    return balanceOf({
      address,
      electrumApi,
      mempoolApi,
      listInscriptions: (address) => network.supportInscriptions ? listInscriptions({
        getAddressInscriptions(address: string, cursor: number, size: number): Promise<{
          list: InscriptionItem[];
          total: number
        }> {
          if (provider?.getInscriptionsByAddress) {
            return provider?.getInscriptionsByAddress(address, cursor, size) as any;
          }
          return provider?.getInscriptions(cursor, size) as any;
        },
      }, address) : Promise.resolve([]),
      listRunes: (outpoints) => network.supportRunes ? listRunes(ordXApi, outpoints) : Promise.resolve({}),
    }).then((b) => {
      console.log('balance', b);
      dispatch.balance.save({ [cacheKey]: b });
    });
  }, [address, cacheKey, dispatch.balance, electrumApi, mempoolApi, network.supportInscriptions, network.supportRunes, ordXApi, provider]);
  useEffect(() => {
    const controller = new AbortController();
    plusLoading();
    loadBalance()
      .catch((e) => {
        console.log(e);
      })
      .finally(() => {
        minusLoading();
      });
    return () => {
      controller.abort();
    };
  }, [loadBalance, minusLoading, plusLoading, r]);
  return Object.assign(balance, {
    loading,
    refresh,
    address,
    network,
    principal,
    publicKey,
  });
}

export function useIdentity() {
  const sessionIdentity = useSelector((state: RootState) => state.global.sessionIdentity);
  return useMemo(() => {
    if (!sessionIdentity) {
      return;
    }
    return Ed25519KeyIdentity.fromJSON(JSON.stringify(sessionIdentity));
  }, [sessionIdentity]);
}


export function useDelegateIdentity() {
  const delegationChain = useSelector((state: RootState) => state.global.delegationChain);
  const sessionIdentity = useSelector((state: RootState) => state.global.sessionIdentity);
  return useMemo(() => {
    if (!delegationChain || !sessionIdentity) {
      return;
    }
    const d = DelegationChain.fromJSON(JSON.stringify(delegationChain));
    const i = DelegationIdentity.fromDelegation(Ed25519KeyIdentity.fromParsedJson(sessionIdentity), d);
    return DelegationIdentity.fromDelegation(i, d);
  }, [delegationChain, sessionIdentity]);
}

export function useTalosActor() {
  const identity = useIdentity();
  return useMemo(() => {
    return Canister.newTalosActor(identity);
  }, [identity]);
}

export function useTalosWalletActor() {
  const identity = useIdentity();
  return useMemo(() => {
    return Canister.newTalosWalletActor(identity);
  }, [identity]);
}

export function useThemeMode() {
  const theme = useSelector((state: RootState) => state.global?.theme);
  const [current, setCurrent] = useState(theme);
  useEffect(() => {
    if (['light', 'dark'].includes(theme)) {
      setCurrent(theme as any);
      return;
    }
    const change = (e: MediaQueryListEvent) => {
      setCurrent(e.matches ? 'dark' : 'light');
    };
    const list = window.matchMedia('(prefers-color-scheme: dark)');
    setCurrent(list.matches ? 'dark' : 'light');
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, [theme]);

  useEffect(() => {
    if (theme === 'system') {
      const list = window.matchMedia('(prefers-color-scheme: dark)');
      document.body.setAttribute('theme', list.matches ? 'dark' : 'light');
    } else {
      document.body.setAttribute('theme', current);
    }
  }, [current, theme]);
  return current as 'light' | 'dark';
}

export function emptyBalance(): WalletAssetBalance {
  return {
    rgb20s: [],
    rgb20sUTXOs: [],
    rgb20sValue: 0,
    height: 0,
    scripthash: '',
    address: '',
    atomicalNFTs: [],
    atomicalFTs: [],
    atomicalsValue: 0,
    atomicalsUTXOs: [],
    regularValue: 0,
    regularUTXOs: [],
    inscriptionsValue: 0,
    inscriptionsUTXOs: [],
    runesValue: 0,
    runesUTXOs: [],
    inscriptions: {},
    atomicals: {},
    runes: [],
    confirmedValue: 0,
    confirmedUTXOs: [],
    unconfirmedUTXOs: [],
    unconfirmedSendValue: 0,
    unconfirmedReceiveValue: 0,
    unconfirmedChangedValue: 0,
    unconfirmedSpentValue: 0,
    unconfirmedTxs: [],
    mergedUTXOs: [],
    mergedValue: 0,
    recentTxs: [],
  };
}

