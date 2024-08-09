import { WalletAssetBalance } from '@wizz-btc/provider';
import { createModel } from '@rematch/core';
import { RootModel } from './index.ts';

type BalanceProps = {
  [key: string]: WalletAssetBalance;
};

export const balance = createModel<RootModel>()({
  state: {} as BalanceProps,
  reducers: {
    save(state: BalanceProps, payload) {
      return {
        ...state,
        ...payload,
      };
    },
  },
});