import {
  InscriptionItem,
  IWalletProvider,
  NetworkType,
  Rune,
  RuneWithValue,
  WalletAssetBalance,
} from '@wizz-btc/provider';
import { bitcoin } from '@wizz-btc/wallet';
import IconBitcoinMainnet from '@/assets/icon/bitcoin.svg';
import IconBitcoinTestnet from '@/assets/icon/bitcoin_testnet.svg';
import IconBitcoinSignet from '@/assets/icon/bitcoin_signet.svg';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { ElectrumApi, MempoolApi } from '@wizz-btc/api';
import { useDispatch, useSelector } from 'react-redux';
import { RootDispatch, RootState } from '../store';
import { balanceOf } from '@wizz-btc/helpers';
import { OrdXApi, useOrdXApi } from '../service/ordx';
import { getPropByKey } from '../utils';
import { App } from 'antd';

export const NETWORKS = {
  mainnet: {
    type: 'mainnet',
    network: bitcoin.networks.bitcoin,
    icon: IconBitcoinMainnet,
    color: '#f7931a',
    mempoolUrl: 'https://mempool.space',
    mempoolApi: 'https://mempool.space/api',
    electrumApi: 'https://ep.wizz.cash/proxy',
    ordxApi: 'https://ordx-test.wizz.cash',
    supportAtomicals: true,
    supportRunes: true,
    supportOrdinals: true,
  },
  testnet: {
    type: 'testnet',
    network: bitcoin.networks.testnet,
    icon: IconBitcoinTestnet,
    color: '#5fd15c',
    mempoolUrl: 'https://mempool.space/testnet',
    mempoolApi: 'https://mempool.space/testnet/api',
    electrumApi: 'https://eptest.wizz.cash/proxy',
    ordxApi: 'https://ordx-test.wizz.cash',
    supportAtomicals: true,
    supportRunes: true,
    supportOrdinals: true,
  },
  testnet4: {
    type: 'testnet4',
    network: bitcoin.networks.testnet,
    icon: IconBitcoinTestnet,
    color: '#5fd15c',
    mempoolUrl: 'https://mempool.space/testnet4',
    mempoolApi: 'https://mempool.space/testnet4/api',
    electrumApi: 'https://eptestnet4.wizz.cash/proxy',
    ordxApi: 'https://ordx-test.wizz.cash',
    supportAtomicals: true,
    supportRunes: false,
    supportOrdinals: false,
  },
  signet: {
    type: 'signet',
    network: bitcoin.networks.testnet,
    icon: IconBitcoinSignet,
    color: '#b028aa',
    mempoolUrl: 'https://mempool.space/signet',
    mempoolApi: 'https://mempool.space/signet/api',
    electrumApi: 'https://eptest.wizz.cash/proxy',
    ordxApi: 'https://ordx-test.wizz.cash',
    supportAtomicals: false,
    supportRunes: false,
    supportOrdinals: false,
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
  network: typeof NETWORKS.mainnet | typeof NETWORKS.testnet | typeof NETWORKS.signet;
};

export async function listOrdinals(
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


export function useBalance(): WalletBalance {
  const electrumApi = useElectrumApi();
  const address = useAddress();
  const network = useNetwork();
  const dispatch = useDispatch<RootDispatch>();
  const mempoolApi = useMempoolApi();
  const provider = useWalletProvider();
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
      listOrdinals: (address) => network.supportOrdinals ? listOrdinals({
        getAddressInscriptions(_: string, cursor: number, size: number): Promise<{
          list: InscriptionItem[];
          total: number
        }> {
          return provider?.getInscriptions(cursor, size) as any;
        },
      }, address) : Promise.resolve([]),
      listRunes: (outpoints) => network.supportRunes ? listRunes(ordXApi, outpoints) : Promise.resolve({}),
    }).then((b) => {
      console.log('balance', b);
      dispatch.balance.save({ [cacheKey]: b });
    });
  }, [address, cacheKey, dispatch.balance, electrumApi, mempoolApi, network.supportOrdinals, network.supportRunes, ordXApi, provider]);
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
  });
}


export function emptyBalance(): WalletAssetBalance {
  return {
    height: 0,
    scripthash: '',
    address: '',
    atomicalNFTs: [],
    atomicalFTs: [],
    atomicalsValue: 0,
    atomicalsUTXOs: [],
    regularValue: 0,
    regularUTXOs: [],
    ordinalsValue: 0,
    ordinalsUTXOs: [],
    runesValue: 0,
    runesUTXOs: [],
    ordinals: {},
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

