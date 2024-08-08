import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface AppInfo {
  'app_id' : string,
  'current_version' : Version,
  'latest_version' : Version,
  'wallet_id' : [] | [Principal],
}
export interface BtcPubkey {
  'hash160' : Array<number>,
  'xonly' : Array<number>,
  'pubkey' : Array<number>,
}
export interface CreateStakeRunesReq {
  'lock_time' : number,
  'amount' : bigint,
  'rune_id' : string,
}
export interface LogEntry { 'ts' : bigint, 'msg' : string, 'kind' : string }
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : string } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : TalosUser } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : Array<UserStakedRunes> } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : AppInfo } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : Array<[string, Array<Principal>]> } |
  { 'Err' : string };
export type Result_6 = { 'Ok' : boolean } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : Array<LogEntry> } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : [] | [Array<[Principal, string]>] } |
  { 'Err' : string };
export type RunesStatus = { 'Inactive' : null } |
  { 'Active' : null };
export interface StakePayload {
  'id' : Array<number>,
  'protocol' : bigint,
  'staker' : Array<number>,
  'vout' : number,
  'version' : bigint,
  'lock_time' : number,
}
export type StakeStatus = { 'Locking' : null } |
  { 'Error' : string } |
  { 'Unlocked' : null } |
  { 'Created' : null };
export interface TalosRunes {
  'runes_status' : RunesStatus,
  'min_stake' : bigint,
  'rune_id' : string,
}
export interface TalosSetting {
  'lp_rewards_ratio' : number,
  'token_canister' : Principal,
  'staking_wallet_canister' : Principal,
  'oracles_endpoint' : string,
}
export interface TalosUser {
  'status' : UserStatus,
  'principal' : Principal,
  'btc_pubkey' : BtcPubkey,
  'btc_address' : string,
}
export interface UserStakedRunes {
  'status' : StakeStatus,
  'stake_payload' : StakePayload,
  'stake_amount' : bigint,
  'btc_address' : string,
  'runes_id' : string,
}
export type UserStatus = { 'Blocked' : null } |
  { 'Normal' : null };
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface _SERVICE {
  'admin_add_runes' : ActorMethod<[TalosRunes], Result>,
  'admin_add_setting' : ActorMethod<[TalosSetting], Result>,
  'admin_block_user' : ActorMethod<[Principal], Result>,
  'admin_create_runes_order' : ActorMethod<
    [Principal, CreateStakeRunesReq],
    Result_1,
  >,
  'admin_get_all_users' : ActorMethod<[], Array<TalosUser>>,
  'admin_get_user' : ActorMethod<[Principal], Result_2>,
  'admin_get_user_all_runes_orders' : ActorMethod<
    [[] | [Principal], [] | [string]],
    Result_3,
  >,
  'admin_get_user_by_btc_address' : ActorMethod<[string], Result_2>,
  'admin_remove_order' : ActorMethod<[string], Result>,
  'admin_remove_runes' : ActorMethod<[string], Result>,
  'admin_remove_user' : ActorMethod<[Principal], Result>,
  'admin_remove_user_by_address' : ActorMethod<[string], Result>,
  'create_runes_order' : ActorMethod<[CreateStakeRunesReq], Result_1>,
  'ego_app_info_get' : ActorMethod<[], Result_4>,
  'ego_app_info_update' : ActorMethod<
    [[] | [Principal], string, Version],
    undefined,
  >,
  'ego_app_version_check' : ActorMethod<[], Result_4>,
  'ego_canister_add' : ActorMethod<[string, Principal], Result>,
  'ego_canister_delete' : ActorMethod<[], Result>,
  'ego_canister_list' : ActorMethod<[], Result_5>,
  'ego_canister_remove' : ActorMethod<[string, Principal], Result>,
  'ego_canister_track' : ActorMethod<[], Result>,
  'ego_canister_untrack' : ActorMethod<[], Result>,
  'ego_canister_upgrade' : ActorMethod<[], Result>,
  'ego_controller_add' : ActorMethod<[Principal], Result>,
  'ego_controller_remove' : ActorMethod<[Principal], Result>,
  'ego_controller_set' : ActorMethod<[Array<Principal>], Result>,
  'ego_is_op' : ActorMethod<[], Result_6>,
  'ego_is_owner' : ActorMethod<[], Result_6>,
  'ego_is_user' : ActorMethod<[], Result_6>,
  'ego_log_list' : ActorMethod<[bigint], Result_7>,
  'ego_op_add' : ActorMethod<[Principal], Result>,
  'ego_op_list' : ActorMethod<[], Result_8>,
  'ego_op_remove' : ActorMethod<[Principal], Result>,
  'ego_owner_add' : ActorMethod<[Principal], Result>,
  'ego_owner_add_with_name' : ActorMethod<[string, Principal], Result>,
  'ego_owner_list' : ActorMethod<[], Result_8>,
  'ego_owner_remove' : ActorMethod<[Principal], Result>,
  'ego_owner_set' : ActorMethod<[Array<Principal>], Result>,
  'ego_user_add' : ActorMethod<[Principal], Result>,
  'ego_user_list' : ActorMethod<[], Result_8>,
  'ego_user_remove' : ActorMethod<[Principal], Result>,
  'ego_user_set' : ActorMethod<[Array<Principal>], Result>,
  'get_btc_lp_reward' : ActorMethod<[bigint, bigint], bigint>,
  'get_rune_list' : ActorMethod<[], Array<TalosRunes>>,
  'get_runes_btc_borrow_amount' : ActorMethod<[string], bigint>,
  'get_user_all_runes_orders' : ActorMethod<[[] | [string]], Result_3>,
  'get_user_runes_order' : ActorMethod<[], Result_3>,
  'user_register' : ActorMethod<[string, BtcPubkey], Result_2>,
  'whoAmI' : ActorMethod<[], [] | [TalosUser]>,
}
