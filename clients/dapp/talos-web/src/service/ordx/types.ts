import { Rune } from '@wizz-btc/provider';

export type RuneDecodePsbt = {
  runes: Rune[];
  inputs: Record<number, Record<string, string>>;
  outputs: Record<number, Record<string, string>>;
  burned: Record<string, string>;
  actions: string[];
};

export type RuneOutputs = {
  runes: Rune[];
  outputs: Record<string, string>[];
};

export type OrdXResponse<T> = {
  success: boolean;
  response: T;
  code?: number;
  message?: string;
};
