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
export interface LogEntry { 'ts' : bigint, 'msg' : string, 'kind' : string }
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : TalosUser } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : string } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : AppInfo } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : Array<[string, Array<Principal>]> } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : boolean } |
  { 'Err' : string };
export type Result_6 = { 'Ok' : Array<LogEntry> } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : [] | [Array<[Principal, string]>] } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : Array<UserStakedRunes> } |
  { 'Err' : string };
export interface RuneId { 'tx' : number, 'block' : bigint }
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
  'rune_id' : RuneId,
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
  'runes_id' : RuneId,
}
export type UserStatus = { 'Blocked' : null } |
  { 'Normal' : null };
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface _SERVICE {
  'add_rune' : ActorMethod<[TalosRunes], Result>,
  'admin_block_user' : ActorMethod<[Principal], Result>,
  'admin_get_all_users' : ActorMethod<[], Array<TalosUser>>,
  'admin_get_user' : ActorMethod<[Principal], Result_1>,
  'admin_get_user_by_btc_address' : ActorMethod<[string], Result_1>,
  'create_runes_order' : ActorMethod<[RuneId, number, bigint], Result_2>,
  'ego_app_info_get' : ActorMethod<[], Result_3>,
  'ego_app_info_update' : ActorMethod<
    [[] | [Principal], string, Version],
    undefined,
  >,
  'ego_app_version_check' : ActorMethod<[], Result_3>,
  'ego_canister_add' : ActorMethod<[string, Principal], Result>,
  'ego_canister_delete' : ActorMethod<[], Result>,
  'ego_canister_list' : ActorMethod<[], Result_4>,
  'ego_canister_remove' : ActorMethod<[string, Principal], Result>,
  'ego_canister_track' : ActorMethod<[], Result>,
  'ego_canister_untrack' : ActorMethod<[], Result>,
  'ego_canister_upgrade' : ActorMethod<[], Result>,
  'ego_controller_add' : ActorMethod<[Principal], Result>,
  'ego_controller_remove' : ActorMethod<[Principal], Result>,
  'ego_controller_set' : ActorMethod<[Array<Principal>], Result>,
  'ego_is_op' : ActorMethod<[], Result_5>,
  'ego_is_owner' : ActorMethod<[], Result_5>,
  'ego_is_user' : ActorMethod<[], Result_5>,
  'ego_log_list' : ActorMethod<[bigint], Result_6>,
  'ego_op_add' : ActorMethod<[Principal], Result>,
  'ego_op_list' : ActorMethod<[], Result_7>,
  'ego_op_remove' : ActorMethod<[Principal], Result>,
  'ego_owner_add' : ActorMethod<[Principal], Result>,
  'ego_owner_add_with_name' : ActorMethod<[string, Principal], Result>,
  'ego_owner_list' : ActorMethod<[], Result_7>,
  'ego_owner_remove' : ActorMethod<[Principal], Result>,
  'ego_owner_set' : ActorMethod<[Array<Principal>], Result>,
  'ego_user_add' : ActorMethod<[Principal], Result>,
  'ego_user_list' : ActorMethod<[], Result_7>,
  'ego_user_remove' : ActorMethod<[Principal], Result>,
  'ego_user_set' : ActorMethod<[Array<Principal>], Result>,
  'get_btc_lp_reward' : ActorMethod<[bigint, bigint], bigint>,
  'get_rune_list' : ActorMethod<[], Array<TalosRunes>>,
  'get_rune_price' : ActorMethod<[RuneId], bigint>,
  'get_user_runes_order' : ActorMethod<[], Result_8>,
  'user_register' : ActorMethod<[string, BtcPubkey], Result_1>,
  'whoAmI' : ActorMethod<[], [] | [TalosUser]>,
}
