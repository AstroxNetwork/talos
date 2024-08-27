// ------------------
//
// **Here are ego dependencies, needed for ego injections**
//
// ------------------
// BTreeMap
use std::collections::BTreeMap;

// ic_cdk
use candid::candid_method;
use candid::Principal;
// ego_macros
use ego_macros::{inject_app_info_api, inject_ego_api};
use ic_cdk::caller;
use ic_cdk_macros::*;

use talos_staking_wallet_mod::service::WalletService;
// ------------------
//
// **Project dependencies
//
// ------------------
// injected macros
use talos_staking_wallet_mod::state::*;
use talos_staking_wallet_mod::types::{CreateCoreDaoTxReq, CreateCoreDaoTxRes, SignedTx, TxDetail};
use talos_types::types::{StakingWallet, StakingWalletCreateReq};

// ------------------
//
// ** injections
//
// ------------------
// injection ego apis
inject_ego_api!();
inject_app_info_api!();

#[cfg(not(feature = "no_candid"))]
#[init]
#[candid_method(init, rename = "init")]
fn canister_init() {
    let caller = caller();
    info_log_add(format!("talos: init, caller is {}", caller.clone()).as_str());
    owner_add(caller);
}

#[pre_upgrade]
pub fn pre_upgrade() {
    talos_staking_wallet_mod::state::pre_upgrade()
}

#[post_upgrade]
pub fn post_upgrade() {
    talos_staking_wallet_mod::state::post_upgrade();
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "whoAmI", guard = "owner_guard")]
#[candid_method(update, rename = "whoAmI")]
pub fn who_am_i() -> Principal {
    ic_cdk::api::caller()
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "create_staking_wallet")]
#[candid_method(update, rename = "create_staking_wallet")]
pub async fn create_staking_wallet(req: StakingWalletCreateReq) -> Result<StakingWallet, String> {
    WalletService::create_staking_wallet(req).await
}

#[cfg(not(feature = "no_candid"))]
#[query(name = "get_staking_wallet")]
#[candid_method(query, rename = "get_staking_wallet")]
pub fn get_staking_wallet(bytes: String) -> Option<StakingWallet> {
    WalletService::get_staking_wallet(bytes)
}

#[cfg(not(feature = "no_candid"))]
#[query(name = "get_staking_wallet_by_principal", guard = "owner_guard")]
#[candid_method(query, rename = "get_staking_wallet_by_principal")]
pub fn get_staking_wallet_by_principal(principal: Principal) -> Vec<StakingWallet> {
    WalletService::get_staking_wallet_by_user_principal(principal)
}

#[cfg(not(feature = "no_candid"))]
#[query(name = "get_staking_wallet_by_btc_address", guard = "owner_guard")]
#[candid_method(query, rename = "get_staking_wallet_by_btc_address")]
pub fn get_staking_wallet_by_btc_address(user_btc_address: String) -> Vec<StakingWallet> {
    WalletService::get_staking_wallet_by_user_btc_wallet(user_btc_address)
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "remove_staking_wallet", guard = "owner_guard")]
#[candid_method(update, rename = "remove_staking_wallet")]
pub fn remove_staking_wallet(bytes: String) {
    WalletService::remove_staking_wallet(bytes);
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "update_staking_wallet", guard = "owner_guard")]
#[candid_method(update, rename = "update_staking_wallet")]
pub fn update_staking_wallet(wallet: StakingWallet) -> Result<(), String> {
    WalletService::update_staking_wallet(wallet)
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "set_talos", guard = "owner_guard")]
#[candid_method(update, rename = "set_talos")]
pub fn set_talos(canister: Principal) {
    WalletService::set_talos(canister)
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "create_core_dao_tx")]
#[candid_method(update, rename = "create_core_dao_tx")]
pub async fn create_core_dao_tx(req: CreateCoreDaoTxReq) -> Result<CreateCoreDaoTxRes, String> {
    WalletService::create_and_sign_core_dao_tx(
        req.wallet_id,
        req.stake_amount,
        req.reveal_fee,
        req.txid,
        req.vout,
        req.value,
        req.chain_id,
        req.delegator,
        req.validator,
        req.stake_lock_time,
        req.key_string,
        req.export_psbt,
    )
    .await
}

#[cfg(not(feature = "no_candid"))]
#[query(name = "get_core_txs_by_wallet_id")]
#[candid_method(query, rename = "get_core_txs_by_wallet_id")]
pub fn get_core_dao_txs_by_wallet_id(wallet_id: String) -> Vec<TxDetail> {
    WalletService::get_txs_by_wallet_id(wallet_id)
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "create_core_dao_tx_unlock")]
#[candid_method(update, rename = "create_core_dao_tx_unlock")]
pub async fn create_core_dao_tx_unlock(req: CreateCoreDaoTxReq) -> Result<SignedTx, String> {
    WalletService::create_and_sign_core_dao_tx_unlock(
        req.wallet_id,
        req.stake_amount,
        req.reveal_fee,
        req.txid,
        req.vout,
        req.value,
        req.chain_id,
        req.delegator,
        req.validator,
        req.stake_lock_time,
        req.key_string,
        req.export_psbt,
    )
    .await
}
