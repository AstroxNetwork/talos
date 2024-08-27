export const idlFactory = ({ IDL }) => {
  const RunesStatus = IDL.Variant({
    'Inactive' : IDL.Null,
    'Active' : IDL.Null,
  });
  const TalosRunes = IDL.Record({
    'runes_status' : RunesStatus,
    'rune_name' : IDL.Text,
    'rune_divisibility' : IDL.Nat8,
    'min_stake' : IDL.Nat,
    'rune_symbol' : IDL.Text,
    'rune_id' : IDL.Text,
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const TalosSetting = IDL.Record({
    'lp_rewards_ratio' : IDL.Float64,
    'token_canister' : IDL.Principal,
    'staking_wallet_canister' : IDL.Principal,
    'oracles_endpoint' : IDL.Text,
  });
  const StakingTarget = IDL.Variant({
    'CoreDao' : IDL.Null,
    'Babylon' : IDL.Null,
  });
  const CreateStakeBTCReq = IDL.Record({
    'target' : StakingTarget,
    'lock_time' : IDL.Nat32,
    'amount' : IDL.Nat,
  });
  const StakingWallet = IDL.Record({
    'user_principal' : IDL.Principal,
    'user_btc_address' : IDL.Text,
    'stake_address' : IDL.Text,
    'stake_target' : StakingTarget,
    'bytes' : IDL.Vec(IDL.Nat8),
    'order_id' : IDL.Vec(IDL.Nat8),
    'pub_key_hex' : IDL.Text,
  });
  const UserStakeOrderType = IDL.Variant({
    'BTC' : StakingTarget,
    'Runes' : IDL.Null,
  });
  const UserStakeOrder = IDL.Record({
    'staking_wallet' : IDL.Opt(StakingWallet),
    'order_type' : UserStakeOrderType,
    'order_id' : IDL.Text,
  });
  const Result_1 = IDL.Variant({ 'Ok' : UserStakeOrder, 'Err' : IDL.Text });
  const CreateStakeRunesReq = IDL.Record({
    'lock_time' : IDL.Nat32,
    'oracle_ts' : IDL.Nat64,
    'amount' : IDL.Nat,
    'rune_id' : IDL.Text,
  });
  const UserStatus = IDL.Variant({ 'Blocked' : IDL.Null, 'Normal' : IDL.Null });
  const BtcPubkey = IDL.Record({
    'hash160' : IDL.Vec(IDL.Nat8),
    'xonly' : IDL.Vec(IDL.Nat8),
    'pubkey' : IDL.Vec(IDL.Nat8),
  });
  const TalosUser = IDL.Record({
    'status' : UserStatus,
    'principal' : IDL.Principal,
    'btc_pubkey' : BtcPubkey,
    'btc_address' : IDL.Text,
  });
  const Result_2 = IDL.Variant({ 'Ok' : TalosUser, 'Err' : IDL.Text });
  const StakeStatus = IDL.Variant({
    'Locking' : IDL.Null,
    'Error' : IDL.Text,
    'Unlocked' : IDL.Null,
    'Created' : IDL.Null,
  });
  const StakePayload = IDL.Record({
    'id' : IDL.Vec(IDL.Nat8),
    'protocol' : IDL.Nat,
    'staker' : IDL.Vec(IDL.Nat8),
    'vout' : IDL.Nat32,
    'version' : IDL.Nat,
    'lock_time' : IDL.Nat32,
  });
  const StakeParams = IDL.Record({
    'value' : IDL.Nat64,
    'validator' : IDL.Text,
    'txid' : IDL.Text,
    'vout' : IDL.Nat32,
    'delegator' : IDL.Text,
    'chain_id' : IDL.Nat16,
    'order_id' : IDL.Vec(IDL.Nat8),
    'stake_amount' : IDL.Nat64,
    'reveal_fee' : IDL.Nat64,
    'stake_lock_time' : IDL.Nat32,
    'wallet_id' : IDL.Text,
  });
  const UserStakedBTC = IDL.Record({
    'status' : StakeStatus,
    'stake_target' : StakingTarget,
    'create_time' : IDL.Nat64,
    'stake_payload' : StakePayload,
    'stake_amount' : IDL.Nat,
    'btc_address' : IDL.Text,
    'stake_params' : IDL.Opt(StakeParams),
  });
  const Result_3 = IDL.Variant({
    'Ok' : IDL.Vec(UserStakedBTC),
    'Err' : IDL.Text,
  });
  const UserStakedRunes = IDL.Record({
    'status' : StakeStatus,
    'unlock_txid' : IDL.Opt(IDL.Text),
    'rune_name' : IDL.Text,
    'rune_divisibility' : IDL.Nat8,
    'create_time' : IDL.Nat64,
    'lock_txid' : IDL.Opt(IDL.Text),
    'stake_payload' : StakePayload,
    'oracle_ts' : IDL.Nat64,
    'stake_amount' : IDL.Nat,
    'rune_symbol' : IDL.Text,
    'btc_address' : IDL.Text,
    'rune_id' : IDL.Text,
  });
  const Result_4 = IDL.Variant({
    'Ok' : IDL.Vec(UserStakedRunes),
    'Err' : IDL.Text,
  });
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const AppInfo = IDL.Record({
    'app_id' : IDL.Text,
    'current_version' : Version,
    'latest_version' : Version,
    'wallet_id' : IDL.Opt(IDL.Principal),
  });
  const Result_5 = IDL.Variant({ 'Ok' : AppInfo, 'Err' : IDL.Text });
  const Result_6 = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
    'Err' : IDL.Text,
  });
  const Result_7 = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : IDL.Text });
  const LogEntry = IDL.Record({
    'ts' : IDL.Nat64,
    'msg' : IDL.Text,
    'kind' : IDL.Text,
  });
  const Result_8 = IDL.Variant({ 'Ok' : IDL.Vec(LogEntry), 'Err' : IDL.Text });
  const Result_9 = IDL.Variant({
    'Ok' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Text))),
    'Err' : IDL.Text,
  });
  const OracleOrder = IDL.Record({
    'ts' : IDL.Nat64,
    'token' : IDL.Text,
    'price' : IDL.Float64,
  });
  const Result_10 = IDL.Variant({ 'Ok' : OracleOrder, 'Err' : IDL.Text });
  const UpdateUserStakedRunes = IDL.Record({
    'status' : StakeStatus,
    'unlock_txid' : IDL.Opt(IDL.Text),
    'lock_txid' : IDL.Opt(IDL.Text),
  });
  const HttpHeader = IDL.Record({ 'value' : IDL.Text, 'name' : IDL.Text });
  const HttpResponse = IDL.Record({
    'status' : IDL.Nat,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HttpHeader),
  });
  const TransformArgs = IDL.Record({
    'context' : IDL.Vec(IDL.Nat8),
    'response' : HttpResponse,
  });
  return IDL.Service({
    'admin_add_runes' : IDL.Func([TalosRunes], [Result], []),
    'admin_add_setting' : IDL.Func([TalosSetting], [Result], []),
    'admin_block_user' : IDL.Func([IDL.Principal], [Result], []),
    'admin_create_btc_order' : IDL.Func(
        [IDL.Principal, CreateStakeBTCReq],
        [Result_1],
        [],
      ),
    'admin_create_runes_order' : IDL.Func(
        [IDL.Principal, CreateStakeRunesReq],
        [Result_1],
        [],
      ),
    'admin_get_all_users' : IDL.Func([], [IDL.Vec(TalosUser)], ['query']),
    'admin_get_user' : IDL.Func([IDL.Principal], [Result_2], ['query']),
    'admin_get_user_all_btc_orders' : IDL.Func(
        [IDL.Opt(IDL.Principal)],
        [Result_3],
        ['query'],
      ),
    'admin_get_user_all_runes_orders' : IDL.Func(
        [IDL.Opt(IDL.Principal), IDL.Opt(IDL.Text)],
        [Result_4],
        ['query'],
      ),
    'admin_get_user_by_btc_address' : IDL.Func(
        [IDL.Text],
        [Result_2],
        ['query'],
      ),
    'admin_remove_order' : IDL.Func([UserStakeOrder], [Result], []),
    'admin_remove_runes' : IDL.Func([IDL.Text], [Result], []),
    'admin_remove_user' : IDL.Func([IDL.Principal], [Result], []),
    'admin_remove_user_by_address' : IDL.Func([IDL.Text], [Result], []),
    'create_btc_order' : IDL.Func([CreateStakeBTCReq], [Result_1], []),
    'create_runes_order' : IDL.Func([CreateStakeRunesReq], [Result_1], []),
    'ego_app_info_get' : IDL.Func([], [Result_5], ['query']),
    'ego_app_info_update' : IDL.Func(
        [IDL.Opt(IDL.Principal), IDL.Text, Version],
        [],
        [],
      ),
    'ego_app_version_check' : IDL.Func([], [Result_5], []),
    'ego_canister_add' : IDL.Func([IDL.Text, IDL.Principal], [Result], []),
    'ego_canister_delete' : IDL.Func([], [Result], []),
    'ego_canister_list' : IDL.Func([], [Result_6], []),
    'ego_canister_remove' : IDL.Func([IDL.Text, IDL.Principal], [Result], []),
    'ego_canister_track' : IDL.Func([], [Result], []),
    'ego_canister_untrack' : IDL.Func([], [Result], []),
    'ego_canister_upgrade' : IDL.Func([], [Result], []),
    'ego_controller_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_controller_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_controller_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'ego_is_op' : IDL.Func([], [Result_7], ['query']),
    'ego_is_owner' : IDL.Func([], [Result_7], ['query']),
    'ego_is_user' : IDL.Func([], [Result_7], ['query']),
    'ego_log_list' : IDL.Func([IDL.Nat64], [Result_8], ['query']),
    'ego_op_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_op_list' : IDL.Func([], [Result_9], []),
    'ego_op_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_add_with_name' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result],
        [],
      ),
    'ego_owner_list' : IDL.Func([], [Result_9], []),
    'ego_owner_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'ego_user_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_user_list' : IDL.Func([], [Result_9], []),
    'ego_user_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_user_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'get_btc_lp_reward' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [IDL.Nat64],
        ['query'],
      ),
    'get_price_from_oracles' : IDL.Func([IDL.Text], [Result_10], []),
    'get_rune_list' : IDL.Func([], [IDL.Vec(TalosRunes)], ['query']),
    'get_runes_btc_borrow_amount' : IDL.Func(
        [IDL.Text],
        [IDL.Nat64],
        ['query'],
      ),
    'get_user_all_btc_orders' : IDL.Func([], [Result_3], ['query']),
    'get_user_all_runes_orders' : IDL.Func(
        [IDL.Opt(IDL.Text)],
        [Result_4],
        ['query'],
      ),
    'get_user_btc_order' : IDL.Func([], [Result_3], ['query']),
    'get_user_runes_order' : IDL.Func([], [Result_4], ['query']),
    'set_btc_order_status' : IDL.Func([IDL.Text, StakeStatus], [Result], []),
    'set_user_runes_order_status' : IDL.Func(
        [IDL.Text, UpdateUserStakedRunes],
        [Result],
        [],
      ),
    'transform' : IDL.Func([TransformArgs], [HttpResponse], ['query']),
    'update_btc_order_stake_params' : IDL.Func([StakeParams], [Result], []),
    'user_register' : IDL.Func([IDL.Text, BtcPubkey], [Result_2], []),
    'whoAmI' : IDL.Func([], [IDL.Opt(TalosUser)], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
