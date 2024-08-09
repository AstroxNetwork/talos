import { init, Models, RematchDispatch, RematchRootState } from '@rematch/core';

import persistPlugin from '@rematch/persist';
import localForage from 'localforage';
import { global } from './global.ts';
import { balance } from './balance.ts';


function storage(dbName: string) {
  const db = localForage.createInstance({
    name: dbName,
    storeName: 'global',
  });
  return {
    db,
    getItem: db.getItem,
    setItem: db.setItem,
    removeItem: db.removeItem,
  };
}


(
  () => {
    const ser = JSON.stringify;
    JSON.stringify = function(value: any, replacer?: (key: string, value: any) => any, space?: string | number) {
      replacer = replacer || ((_, value) => {
        if (typeof value == 'bigint') {
          return value.toString(10) + '/n/';
        }
        return value;
      });
      return ser(value, replacer, space);
    } as any;
    const des = JSON.parse;
    JSON.parse = function(text: string, reviver?: (this: any, key: any, value: any) => any) {
      reviver = reviver || ((_, value) => {
        if (typeof value == 'string' && value.endsWith('/n/') && /^\d+\/n\/$/.test(value)) {
          return BigInt(value.slice(0, -3));
        }
        return value;
      });
      return des(text, reviver);
    };
    const dbs: string[] = [];
    for (const name of dbs) {
      localForage.createInstance({ name }).dropInstance().catch(console.error);
    }
  }
)();


export const models: RootModel = { global, balance };


export const store = init<RootModel, RootModel>({
  models,
  plugins: [
    persistPlugin({
      key: 'store',
      storage: storage('staking'),
    }),
  ],
});

export type Store = typeof store;
export type RootDispatch = RematchDispatch<RootModel>;
export type RootState = RematchRootState<RootModel, RootModel>;

export interface RootModel extends Models<RootModel> {
  global: typeof global;
  balance: typeof balance;
}

