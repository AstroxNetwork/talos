// ------------------
//
// **Here are ego dependencies, needed for ego injections**
//
// ------------------
// BTreeMap
use std::collections::BTreeMap;

// ego_macros
use ego_macros::{inject_app_info_api, inject_ego_api};

// ic_cdk
use candid::candid_method;
use candid::Principal;
use ic_cdk::api::management_canister::bitcoin::BitcoinAddress;
use ic_cdk::caller;
use ic_cdk_macros::*;
use talos_mod::service::TalosService;
// ------------------
//
// **Project dependencies
//
// ------------------
// injected macros
use talos_mod::state::*;
use talos_mod::types::{CreateStakeRunesReq, TalosSetting};
use talos_mod::utils::vec_to_u84;
use talos_types::ordinals::RuneId;
use talos_types::types::{BtcPubkey, TalosRunes, TalosUser, UserStakedRunes, UserStatus};

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
    talos_mod::state::pre_upgrade()
}

#[post_upgrade]
pub fn post_upgrade() {
    talos_mod::state::post_upgrade();
}

#[cfg(not(feature = "no_candid"))]
#[query(name = "whoAmI")]
#[candid_method(query, rename = "whoAmI")]
pub fn who_am_i() -> Option<TalosUser> {
    TalosService::get_user(&caller()).ok()
}

// admin functions
#[cfg(not(feature = "no_candid"))]
#[update(name = "admin_add_setting")]
#[candid_method(update, rename = "admin_add_setting")]
pub fn admin_add_setting(talos_setting: TalosSetting) -> Result<(), String> {
    TalosService::add_setting(talos_setting);
    Ok(())
}

#[cfg(not(feature = "no_candid"))]
#[query(name = "admin_get_user", guard = "owner_guard")]
#[candid_method(query, rename = "admin_get_user")]
pub fn admin_get_user(user: Principal) -> Result<TalosUser, String> {
    TalosService::get_user(&user)
}

#[cfg(not(feature = "no_candid"))]
#[query(name = "admin_get_user_by_btc_address", guard = "owner_guard")]
#[candid_method(query, rename = "admin_get_user_by_btc_address")]
pub fn admin_get_user_by_btc_address(btc_address: String) -> Result<TalosUser, String> {
    TalosService::get_user_by_address(&btc_address)
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "admin_remove_user", guard = "owner_guard")]
#[candid_method(update, rename = "admin_remove_user")]
pub fn admin_remove_user(principal: Principal) -> Result<(), String> {
    let user = TalosService::get_user(&principal)?;
    TalosService::remove_user(&user.principal)
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "admin_remove_user_by_address", guard = "owner_guard")]
#[candid_method(update, rename = "admin_remove_user_by_address")]
pub fn admin_remove_user_by_address(btc_address: String) -> Result<(), String> {
    let user = TalosService::get_user_by_address(&btc_address)?;
    TalosService::remove_user(&user.principal)
}

#[cfg(not(feature = "no_candid"))]
#[query(name = "admin_get_all_users", guard = "owner_guard")]
#[candid_method(query, rename = "admin_get_all_users")]
pub fn admin_get_all_users() -> Vec<TalosUser> {
    TalosService::get_all_users()
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "admin_block_user", guard = "owner_guard")]
#[candid_method(update, rename = "admin_block_user")]
pub fn admin_block_user(principal: Principal) -> Result<(), String> {
    TalosService::block_user(&principal)
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "admin_add_runes", guard = "owner_guard")]
#[candid_method(update, rename = "admin_add_runes")]
pub fn admin_add_runes(talos_runes: TalosRunes) -> Result<(), String> {
    TalosService::add_runes(talos_runes)
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "admin_remove_runes", guard = "owner_guard")]
#[candid_method(update, rename = "admin_remove_runes")]
pub fn admin_remove_runes(runes_id: String) -> Result<(), String> {
    TalosService::remove_runes(runes_id.as_str())
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "admin_create_runes_order", guard = "owner_guard")]
#[candid_method(update, rename = "admin_create_runes_order")]
pub fn admin_create_runes_order(
    principal: Principal,
    req: CreateStakeRunesReq,
) -> Result<String, String> {
    let order =
        TalosService::create_runes_order(&principal, &req.rune_id, req.lock_time, req.amount)?;
    Ok(hex::encode(order))
}

#[cfg(not(feature = "no_candid"))]
#[update(name = "admin_remove_order", guard = "owner_guard")]
#[candid_method(update, rename = "admin_remove_order")]
pub fn admin_remove_order(order: String) -> Result<(), String> {
    let order_bytes =
        hex::decode(order).map_err(|_| "Cannot convert order to bytes".to_string())?;
    let u84 = vec_to_u84(order_bytes)?;
    TalosService::remove_order(u84)
}

#[cfg(not(feature = "no_candid"))]
#[query(name = "admin_get_user_all_runes_orders")]
#[candid_method(query, rename = "admin_get_user_all_runes_orders")]
pub async fn admin_get_user_all_runes_orders(
    principal: Option<Principal>,
    rune_id: Option<String>,
) -> Result<Vec<UserStakedRunes>, String> {
    TalosService::get_all_runes_orders(principal, rune_id)
}

/// 用户注册
/// User Register
#[cfg(not(feature = "no_candid"))]
#[update(name = "user_register")]
#[candid_method(update, rename = "user_register")]
pub fn user_register(btc_address: String, btc_pubkey: BtcPubkey) -> Result<TalosUser, String> {
    let caller = caller();
    match TalosService::get_user(&caller) {
        Ok(_) => return Err("User already exists".to_string()),
        Err(_) => {
            if btc_pubkey.pubkey.len() != 33 {
                return Err("Invalid pubkey".to_string());
            }
            if btc_pubkey.xonly.len() != 32 {
                return Err("Invalid xonly".to_string());
            }
            if btc_pubkey.hash160.len() != 20 {
                return Err("Invalid btc address".to_string());
            }

            let user = TalosUser {
                principal: caller,
                btc_address,
                btc_pubkey,
                status: UserStatus::Normal,
            };
            TalosService::add_user(user.clone())?;
            Ok(user)
        }
    }
}

/// 获取允许质押的rune列表
/// Get Available Runes for staking
/// The list of runes that can be staked
/// Should use admin function to add new runes
/// Then query this function to get the list of runes
/// public query
#[cfg(not(feature = "no_candid"))]
#[query(name = "get_rune_list")]
#[candid_method(query, rename = "get_rune_list")]
pub fn get_rune_list() -> Vec<TalosRunes> {
    TalosService::get_runes_list()
}

/// 获取某个rune实时报价
/// Get rune price from oracle, providing the rune id
/// The price is used to calculate the staking reward
/// The price is calculated in BTC/Satoshi, u64
/// public query, async
#[cfg(not(feature = "no_candid"))]
#[query(name = "get_runes_btc_borrow_amount")]
#[candid_method(query, rename = "get_runes_btc_borrow_amount")]
pub async fn get_runes_btc_borrow_amount(rune_id: String) -> u64 {
    0
}

/// 获取BTC质押周期对应收益
/// Get btc LP Token rewards passing block count
#[cfg(not(feature = "no_candid"))]
#[query(name = "get_btc_lp_reward")]
#[candid_method(query, rename = "get_btc_lp_reward")]
pub async fn get_btc_lp_reward(blocks: u64, amount: u64) -> u64 {
    TalosService::get_lp_rewards(blocks, amount)
}

/// 获取runes质押列表
/// Get user runes staking list
/// Passing user principal, return the list of runes staked by the user
/// Guard by caller principal
#[cfg(not(feature = "no_candid"))]
#[query(name = "get_user_runes_order")]
#[candid_method(query, rename = "get_user_runes_order")]
pub async fn get_user_runes_order() -> Result<Vec<UserStakedRunes>, String> {
    TalosService::get_user_runes_orders(&caller())
}

#[cfg(not(feature = "no_candid"))]
#[query(name = "get_user_all_runes_orders")]
#[candid_method(query, rename = "get_user_all_runes_orders")]
pub async fn get_user_all_runes_orders(
    rune_id: Option<String>,
) -> Result<Vec<UserStakedRunes>, String> {
    let caller = caller();
    TalosService::get_all_runes_orders(Some(caller), rune_id)
}

/// 创建Runes质押
/// Get user BTC staking list
/// Passing user principal, return the list of BTC staked by the user
/// Guard by caller principal
#[cfg(not(feature = "no_candid"))]
#[update(name = "create_runes_order")]
#[candid_method(update, rename = "create_runes_order")]
pub async fn create_runes_order(req: CreateStakeRunesReq) -> Result<String, String> {
    let caller = caller();
    let order_bytes =
        TalosService::create_runes_order(&caller, &req.rune_id, req.lock_time, req.amount)?;
    Ok(hex::encode(order_bytes))
}

// 创建core质押/core质押提交

// 我的lp余额, 查ledger_canister
