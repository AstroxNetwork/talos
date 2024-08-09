import { BasePayloadOptions, RequiredDataPayloadOptions, RequiredParamsPayloadOptions } from '@wizz-btc/api';
import {
  ChallengeResponse,
  CreateStakeOrderRequest,
  CreateStakeOrderResponse,
  ListLaunchesResponse,
  LoginRequest,
  LoginResponse,
  OrderListResponse,
} from './types.ts';
import { BaseApi } from '../api.ts';


export const TEST_STAKE_API = import.meta.env.VITE_TEST_STAKE_API;
export const MAIN_STAKE_API = import.meta.env.VITE_MAIN_STAKE_API;

export class StakeApi extends BaseApi {
  endpoint: string;
  options?: RequestInit;

  constructor(endpoint: string, options?: RequestInit) {
    super(endpoint, options);
    this.endpoint = endpoint;
    this.options = options;
  }

  public challenge(options: RequiredParamsPayloadOptions<{ userAddress: string }>) {
    return this._fetch<ChallengeResponse>('/mint/users/challenge', options);
  }

  public login(options: RequiredDataPayloadOptions<LoginRequest>) {
    return this._fetch<LoginResponse>('/mint/users/login', {
      ...options,
      method: 'POST',
    });
  }

  public listLaunches(options?: BasePayloadOptions) {
    return this._fetch<ListLaunchesResponse>('/mint/stake/listLaunches', {
      ...options,
      method: 'GET',
    });
  }

  public createStakeOrder(options: RequiredDataPayloadOptions<CreateStakeOrderRequest>) {
    return this._fetch<CreateStakeOrderResponse>('/mint/stake/orders', {
      ...options,
      method: 'POST',
    });
  }

  public orderList(options: RequiredParamsPayloadOptions<{
    pageNum: number;
    pageSize: number;
  }>) {
    return this._fetch<OrderListResponse>('/mint/stake/orders/list', {
      ...options,
      method: 'GET',
    });
  }
}
