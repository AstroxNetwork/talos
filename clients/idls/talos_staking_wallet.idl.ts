export const idlFactory = ({ IDL }) => {
  const CreateCoreDaoTxReq = IDL.Record({
    'key_string' : IDL.Text,
    'value' : IDL.Nat64,
    'validator' : IDL.Text,
    'txid' : IDL.Text,
    'vout' : IDL.Nat32,
    'delegator' : IDL.Text,
    'chain_id' : IDL.Nat16,
    'stake_amount' : IDL.Nat64,
    'reveal_fee' : IDL.Nat64,
    'stake_lock_time' : IDL.Nat32,
    'wallet_id' : IDL.Text,
    'export_psbt' : IDL.Bool,
  });
  const SignedTx = IDL.Record({
    'txid' : IDL.Text,
    'tx_hex' : IDL.Text,
    'psbt_b64' : IDL.Opt(IDL.Text),
  });
  const CreateCoreDaoTxRes = IDL.Record({
    'signed_tx_commit' : SignedTx,
    'redeem_script' : IDL.Vec(IDL.Nat8),
  });
  const Result = IDL.Variant({ 'Ok' : CreateCoreDaoTxRes, 'Err' : IDL.Text });
  const Result_1 = IDL.Variant({ 'Ok' : SignedTx, 'Err' : IDL.Text });
  const StakingTarget = IDL.Variant({
    'CoreDao' : IDL.Null,
    'Babylon' : IDL.Null,
  });
  const StakingWalletCreateReq = IDL.Record({
    'key' : IDL.Text,
    'user_principal' : IDL.Principal,
    'user_btc_address' : IDL.Text,
    'stake_target' : StakingTarget,
    'order_id' : IDL.Vec(IDL.Nat8),
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
  const Result_2 = IDL.Variant({ 'Ok' : StakingWallet, 'Err' : IDL.Text });
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
  const Result_4 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const Result_5 = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
    'Err' : IDL.Text,
  });
  const Result_6 = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : IDL.Text });
  const LogEntry = IDL.Record({
    'ts' : IDL.Nat64,
    'msg' : IDL.Text,
    'kind' : IDL.Text,
  });
  const Result_7 = IDL.Variant({ 'Ok' : IDL.Vec(LogEntry), 'Err' : IDL.Text });
  const Result_8 = IDL.Variant({
    'Ok' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Text))),
    'Err' : IDL.Text,
  });
  const TxType = IDL.Variant({
    'Withdraw' : IDL.Null,
    'Lock' : IDL.Null,
    'Deposit' : IDL.Null,
    'Transfer' : IDL.Null,
  });
  const TxState = IDL.Variant({
    'Stashed' : IDL.Null,
    'Confirmed' : IDL.Nat64,
    'Pending' : IDL.Nat64,
  });
  const TxDetail = IDL.Record({
    'tx_bytes' : IDL.Vec(IDL.Nat8),
    'txid' : IDL.Text,
    'lock_time' : IDL.Nat32,
    'tx_type' : TxType,
    'wallet_id' : IDL.Text,
    'tx_state' : TxState,
  });
  return IDL.Service({
    'create_core_dao_tx' : IDL.Func([CreateCoreDaoTxReq], [Result], []),
    'create_core_dao_tx_unlock' : IDL.Func(
        [CreateCoreDaoTxReq],
        [Result_1],
        [],
      ),
    'create_staking_wallet' : IDL.Func(
        [StakingWalletCreateReq],
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
    'ego_canister_add' : IDL.Func([IDL.Text, IDL.Principal], [Result_4], []),
    'ego_canister_delete' : IDL.Func([], [Result_4], []),
    'ego_canister_list' : IDL.Func([], [Result_5], []),
    'ego_canister_remove' : IDL.Func([IDL.Text, IDL.Principal], [Result_4], []),
    'ego_canister_track' : IDL.Func([], [Result_4], []),
    'ego_canister_untrack' : IDL.Func([], [Result_4], []),
    'ego_canister_upgrade' : IDL.Func([], [Result_4], []),
    'ego_controller_add' : IDL.Func([IDL.Principal], [Result_4], []),
    'ego_controller_remove' : IDL.Func([IDL.Principal], [Result_4], []),
    'ego_controller_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result_4], []),
    'ego_is_op' : IDL.Func([], [Result_6], ['query']),
    'ego_is_owner' : IDL.Func([], [Result_6], ['query']),
    'ego_is_user' : IDL.Func([], [Result_6], ['query']),
    'ego_log_list' : IDL.Func([IDL.Nat64], [Result_7], ['query']),
    'ego_op_add' : IDL.Func([IDL.Principal], [Result_4], []),
    'ego_op_list' : IDL.Func([], [Result_8], []),
    'ego_op_remove' : IDL.Func([IDL.Principal], [Result_4], []),
    'ego_owner_add' : IDL.Func([IDL.Principal], [Result_4], []),
    'ego_owner_add_with_name' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result_4],
        [],
      ),
    'ego_owner_list' : IDL.Func([], [Result_8], []),
    'ego_owner_remove' : IDL.Func([IDL.Principal], [Result_4], []),
    'ego_owner_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result_4], []),
    'ego_user_add' : IDL.Func([IDL.Principal], [Result_4], []),
    'ego_user_list' : IDL.Func([], [Result_8], []),
    'ego_user_remove' : IDL.Func([IDL.Principal], [Result_4], []),
    'ego_user_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result_4], []),
    'get_core_txs_by_wallet_id' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(TxDetail)],
        ['query'],
      ),
    'get_staking_wallet' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(StakingWallet)],
        ['query'],
      ),
    'get_staking_wallet_by_btc_address' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(StakingWallet)],
        ['query'],
      ),
    'get_staking_wallet_by_principal' : IDL.Func(
        [IDL.Principal],
        [IDL.Vec(StakingWallet)],
        ['query'],
      ),
    'remove_staking_wallet' : IDL.Func([IDL.Text], [], []),
    'set_talos' : IDL.Func([IDL.Principal], [], []),
    'update_staking_wallet' : IDL.Func([StakingWallet], [Result_4], []),
    'whoAmI' : IDL.Func([], [IDL.Principal], []),
  });
};
export const init = ({ IDL }) => { return []; };
