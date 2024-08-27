import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface AppInfo {
  'app_id' : string,
  'current_version' : Version,
  'latest_version' : Version,
  'wallet_id' : [] | [Principal],
}
export interface CreateCoreDaoTxReq {
  'key_string' : string,
  'value' : bigint,
  'validator' : string,
  'txid' : string,
  'vout' : number,
  'delegator' : string,
  'chain_id' : number,
  'stake_amount' : bigint,
  'reveal_fee' : bigint,
  'stake_lock_time' : number,
  'wallet_id' : string,
  'export_psbt' : boolean,
}
export interface CreateCoreDaoTxRes {
  'signed_tx_commit' : SignedTx,
  'redeem_script' : Array<number>,
}
export interface LogEntry { 'ts' : bigint, 'msg' : string, 'kind' : string }
export type Result = { 'Ok' : CreateCoreDaoTxRes } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : SignedTx } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : StakingWallet } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : AppInfo } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : Array<[string, Array<Principal>]> } |
  { 'Err' : string };
export type Result_6 = { 'Ok' : boolean } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : Array<LogEntry> } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : [] | [Array<[Principal, string]>] } |
  { 'Err' : string };
export interface SignedTx {
  'txid' : string,
  'tx_hex' : string,
  'psbt_b64' : [] | [string],
}
export type StakingTarget = { 'CoreDao' : null } |
  { 'Babylon' : null };
export interface StakingWallet {
  'user_principal' : Principal,
  'user_btc_address' : string,
  'stake_address' : string,
  'stake_target' : StakingTarget,
  'bytes' : Array<number>,
  'order_id' : Array<number>,
  'pub_key_hex' : string,
}
export interface StakingWalletCreateReq {
  'key' : string,
  'user_principal' : Principal,
  'user_btc_address' : string,
  'stake_target' : StakingTarget,
  'order_id' : Array<number>,
}
export interface TxDetail {
  'tx_bytes' : Array<number>,
  'txid' : string,
  'lock_time' : number,
  'tx_type' : TxType,
  'wallet_id' : string,
  'tx_state' : TxState,
}
export type TxState = { 'Stashed' : null } |
  { 'Confirmed' : bigint } |
  { 'Pending' : bigint };
export type TxType = { 'Withdraw' : null } |
  { 'Lock' : null } |
  { 'Deposit' : null } |
  { 'Transfer' : null };
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface _SERVICE {
  'create_core_dao_tx' : ActorMethod<[CreateCoreDaoTxReq], Result>,
  'create_core_dao_tx_unlock' : ActorMethod<[CreateCoreDaoTxReq], Result_1>,
  'create_staking_wallet' : ActorMethod<[StakingWalletCreateReq], Result_2>,
  'ego_app_info_get' : ActorMethod<[], Result_3>,
  'ego_app_info_update' : ActorMethod<
    [[] | [Principal], string, Version],
    undefined,
  >,
  'ego_app_version_check' : ActorMethod<[], Result_3>,
  'ego_canister_add' : ActorMethod<[string, Principal], Result_4>,
  'ego_canister_delete' : ActorMethod<[], Result_4>,
  'ego_canister_list' : ActorMethod<[], Result_5>,
  'ego_canister_remove' : ActorMethod<[string, Principal], Result_4>,
  'ego_canister_track' : ActorMethod<[], Result_4>,
  'ego_canister_untrack' : ActorMethod<[], Result_4>,
  'ego_canister_upgrade' : ActorMethod<[], Result_4>,
  'ego_controller_add' : ActorMethod<[Principal], Result_4>,
  'ego_controller_remove' : ActorMethod<[Principal], Result_4>,
  'ego_controller_set' : ActorMethod<[Array<Principal>], Result_4>,
  'ego_is_op' : ActorMethod<[], Result_6>,
  'ego_is_owner' : ActorMethod<[], Result_6>,
  'ego_is_user' : ActorMethod<[], Result_6>,
  'ego_log_list' : ActorMethod<[bigint], Result_7>,
  'ego_op_add' : ActorMethod<[Principal], Result_4>,
  'ego_op_list' : ActorMethod<[], Result_8>,
  'ego_op_remove' : ActorMethod<[Principal], Result_4>,
  'ego_owner_add' : ActorMethod<[Principal], Result_4>,
  'ego_owner_add_with_name' : ActorMethod<[string, Principal], Result_4>,
  'ego_owner_list' : ActorMethod<[], Result_8>,
  'ego_owner_remove' : ActorMethod<[Principal], Result_4>,
  'ego_owner_set' : ActorMethod<[Array<Principal>], Result_4>,
  'ego_user_add' : ActorMethod<[Principal], Result_4>,
  'ego_user_list' : ActorMethod<[], Result_8>,
  'ego_user_remove' : ActorMethod<[Principal], Result_4>,
  'ego_user_set' : ActorMethod<[Array<Principal>], Result_4>,
  'get_core_txs_by_wallet_id' : ActorMethod<[string], Array<TxDetail>>,
  'get_staking_wallet' : ActorMethod<[string], [] | [StakingWallet]>,
  'get_staking_wallet_by_btc_address' : ActorMethod<
    [string],
    Array<StakingWallet>,
  >,
  'get_staking_wallet_by_principal' : ActorMethod<
    [Principal],
    Array<StakingWallet>,
  >,
  'remove_staking_wallet' : ActorMethod<[string], undefined>,
  'set_talos' : ActorMethod<[Principal], undefined>,
  'update_staking_wallet' : ActorMethod<[StakingWallet], Result_4>,
  'whoAmI' : ActorMethod<[], Principal>,
}
