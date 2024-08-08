export const idlFactory = ({ IDL }) => {
  const RunesStatus = IDL.Variant({
    'Inactive' : IDL.Null,
    'Active' : IDL.Null,
  });
  const RuneId = IDL.Record({ 'tx' : IDL.Nat32, 'block' : IDL.Nat64 });
  const TalosRunes = IDL.Record({
    'runes_status' : RunesStatus,
    'min_stake' : IDL.Nat,
    'rune_id' : RuneId,
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
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
  const Result_1 = IDL.Variant({ 'Ok' : TalosUser, 'Err' : IDL.Text });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
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
  const Result_3 = IDL.Variant({ 'Ok' : AppInfo, 'Err' : IDL.Text });
  const Result_4 = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
    'Err' : IDL.Text,
  });
  const Result_5 = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : IDL.Text });
  const LogEntry = IDL.Record({
    'ts' : IDL.Nat64,
    'msg' : IDL.Text,
    'kind' : IDL.Text,
  });
  const Result_6 = IDL.Variant({ 'Ok' : IDL.Vec(LogEntry), 'Err' : IDL.Text });
  const Result_7 = IDL.Variant({
    'Ok' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Text))),
    'Err' : IDL.Text,
  });
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
  const UserStakedRunes = IDL.Record({
    'status' : StakeStatus,
    'stake_payload' : StakePayload,
    'stake_amount' : IDL.Nat,
    'btc_address' : IDL.Text,
    'runes_id' : RuneId,
  });
  const Result_8 = IDL.Variant({
    'Ok' : IDL.Vec(UserStakedRunes),
    'Err' : IDL.Text,
  });
  return IDL.Service({
    'add_rune' : IDL.Func([TalosRunes], [Result], []),
    'admin_block_user' : IDL.Func([IDL.Principal], [Result], []),
    'admin_get_all_users' : IDL.Func([], [IDL.Vec(TalosUser)], ['query']),
    'admin_get_user' : IDL.Func([IDL.Principal], [Result_1], ['query']),
    'admin_get_user_by_btc_address' : IDL.Func(
        [IDL.Text],
        [Result_1],
        ['query'],
      ),
    'create_runes_order' : IDL.Func(
        [RuneId, IDL.Nat32, IDL.Nat],
        [Result_2],
        [],
      ),
    'ego_app_info_get' : IDL.Func([], [Result_3], ['query']),
    'ego_app_info_update' : IDL.Func(
        [IDL.Opt(IDL.Principal), IDL.Text, Version],
        [],
        [],
      ),
    'ego_app_version_check' : IDL.Func([], [Result_3], []),
    'ego_canister_add' : IDL.Func([IDL.Text, IDL.Principal], [Result], []),
    'ego_canister_delete' : IDL.Func([], [Result], []),
    'ego_canister_list' : IDL.Func([], [Result_4], []),
    'ego_canister_remove' : IDL.Func([IDL.Text, IDL.Principal], [Result], []),
    'ego_canister_track' : IDL.Func([], [Result], []),
    'ego_canister_untrack' : IDL.Func([], [Result], []),
    'ego_canister_upgrade' : IDL.Func([], [Result], []),
    'ego_controller_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_controller_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_controller_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'ego_is_op' : IDL.Func([], [Result_5], ['query']),
    'ego_is_owner' : IDL.Func([], [Result_5], ['query']),
    'ego_is_user' : IDL.Func([], [Result_5], ['query']),
    'ego_log_list' : IDL.Func([IDL.Nat64], [Result_6], ['query']),
    'ego_op_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_op_list' : IDL.Func([], [Result_7], []),
    'ego_op_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_add_with_name' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result],
        [],
      ),
    'ego_owner_list' : IDL.Func([], [Result_7], []),
    'ego_owner_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'ego_user_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_user_list' : IDL.Func([], [Result_7], []),
    'ego_user_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_user_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'get_btc_lp_reward' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [IDL.Nat64],
        ['query'],
      ),
    'get_rune_list' : IDL.Func([], [IDL.Vec(TalosRunes)], ['query']),
    'get_rune_price' : IDL.Func([RuneId], [IDL.Nat64], ['query']),
    'get_user_runes_order' : IDL.Func([], [Result_8], ['query']),
    'user_register' : IDL.Func([IDL.Text, BtcPubkey], [Result_1], []),
    'whoAmI' : IDL.Func([], [IDL.Opt(TalosUser)], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
