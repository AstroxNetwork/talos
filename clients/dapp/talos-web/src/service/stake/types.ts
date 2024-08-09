export interface BaseResponse<T> {
  code: number;
  data: T;
  message: string;
  success: boolean;
}


export type ChallengeResponse = BaseResponse<string>;


export interface LoginRequest {
  pubKey: string;
  signature: string;
  userAddress: string;
}


export type LoginResponse = BaseResponse<string>;


export interface Paged<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export type ListLaunchesResponse = BaseResponse<Paged<LaunchItem>>;


export interface LaunchItem {
  id: number
  name: string
  startHeight: number
  endHeight: number
  rules: LaunchRule[]
}

export interface LaunchRule {
  id: number
  launchId: number
  lockBlockAmount: number
  rateOfReturn: number
  redemBlockAmount: number
  tokenId: number
  minAmount: number
  maxAmount: number
  times: number
  price: number
  token: Token
}

export interface Token {
  id: number
  chain: string
  protocol: string
  name: string
  tokenId?: string
  icon: any
  price: number
  dueAt: string
}


export interface CreateStakeOrderRequest {
  launchId: number;
  tokenId: number;
  amount: number;
  launchRuleId: number;
  version: number;
  vout: number;
}

export type CreateStakeOrderResponse = BaseResponse<{
  orderNumber: string;
}>;

export type OrderListResponse = BaseResponse<Paged<{
  createTime: string
}>>;