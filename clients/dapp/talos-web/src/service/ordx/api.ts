import { RequiredDataPayloadOptions } from '@wizz-btc/api';
import { BaseApi } from '../api.ts';
import { OrdXResponse, RuneDecodePsbt, RuneOutputs } from './types.ts';

export const MAINNET_ORDX_API = 'https://ordx.wizz.cash';
export const TESTNET_ORDX_API = 'https://ordx-test.wizz.cash';

export class OrdXApi extends BaseApi {
  endpoint: string;
  options?: RequestInit;

  constructor(endpoint: string, options?: RequestInit) {
    super(endpoint, options);
    this.endpoint = endpoint;
    this.options = options;
  }

  outputs(options: RequiredDataPayloadOptions<string[]>) {
    return this._fetch<OrdXResponse<RuneOutputs>>('/runes/outputs', {
      ...options,
      method: 'POST',
    });
  }

  decodePsbt(options: RequiredDataPayloadOptions<{ psbtHex: string }>) {
    return this._fetch<OrdXResponse<RuneDecodePsbt>>('/runes/decode/psbt', {
      ...options,
      method: 'POST',
    });
  }
}
