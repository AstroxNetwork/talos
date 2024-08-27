use crate::memory::{
    insert_btree, BTC_ADDRESS_USER, BTC_ORDERS, BTREES, LISTED_RUNES_MAP, ORACLE_ORDERS,
    PRINCIPAL_USER, RUNES_ORDERS,
};
use crate::types::{
    BtreeKey, BtreeValue, OracleOrder, OracleOrderKey, OracleOrderSave,
    TalosSetting, UserAddress,
};
use crate::utils::{new_order_id, vec_to_u832, vec_to_u84};
use candid::{Nat, Principal};
use ic_cdk::api::call::RejectionCode;
use ic_stable_structures::storable::Blob;
use ic_stable_structures::Storable;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{NumTokens, TransferArg, TransferError};
use std::str::FromStr;
use talos_types::ordinals::RuneId;
use talos_types::types::{BTCStakePayload, RunesKey, RunesStatus, StakePayload, StakeStatus, StakingTarget, StakingWallet, StakingWalletCreateReq, TalosRunes, TalosUser, UpdateUserStakedRunes, UserStakedBTC, UserStakedRunes, UserStatus};

pub static DEFAULT_BTC_PROTOCOL: u128 = 0;
pub static DEFAULT_RUNES_PROTOCOL: u128 = 1;
pub static DEFAULT_STAKING_VERSION: u128 = 0;

pub static DEFAULT_VOUT: u32 = 0;

pub const GET_TX_BYTES: u64 = 3u64;

pub struct TalosService {}

impl TalosService {
    pub fn add_setting(talos_setting: TalosSetting) {
        insert_btree(
            "setting".to_string(),
            BtreeValue {
                key: "setting".to_string(),
                value: talos_setting.to_bytes().to_vec(),
            },
        );
    }
    pub fn get_setting() -> Option<TalosSetting> {
        BTREES.with(|m| {
            m.borrow()
                .get(&BtreeKey("setting".to_string()))
                .map(|f| TalosSetting::from_bytes(f.value.to_bytes()))
        })
    }

    pub fn get_staking_wallet_canister() -> Option<Principal> {
        Self::get_setting().map(|setting| setting.staking_wallet_canister)
    }

    pub fn add_user(talos_user: TalosUser) -> Result<(), String> {
        let blob: Blob<29> = talos_user.principal.as_slice()[..29]
            .try_into()
            .map_err(|_| "failed to convert principal".to_string())?;
        PRINCIPAL_USER.with(|m| {
            m.borrow_mut().insert(blob, talos_user.clone());
        });

        BTC_ADDRESS_USER.with(|m| {
            m.borrow_mut().insert(
                UserAddress(talos_user.btc_address.clone()),
                talos_user.clone(),
            );
        });

        Ok(())
    }

    pub fn get_user(principal: &Principal) -> Result<TalosUser, String> {
        let blob: Blob<29> = principal.as_slice()[..29]
            .try_into()
            .map_err(|_| "failed to convert principal".to_string())?;
        let res = PRINCIPAL_USER.with(|m| m.borrow().get(&blob));
        if res.is_none() {
            return Err("User not found".to_string());
        } else {
            Ok(res.unwrap())
        }
    }

    pub fn get_user_by_address(address: &str) -> Result<TalosUser, String> {
        let res = BTC_ADDRESS_USER.with(|m| m.borrow().get(&UserAddress(address.to_string())));
        if res.is_none() {
            return Err("User not found".to_string());
        } else {
            Ok(res.unwrap())
        }
    }

    pub fn get_all_users() -> Vec<TalosUser> {
        PRINCIPAL_USER.with(|m| {
            m.borrow()
                .iter()
                .map(|f| f.1.clone())
                .collect::<Vec<TalosUser>>()
        })
    }

    pub fn block_user(principal: &Principal) -> Result<(), String> {
        let user = Self::get_user(principal);
        if user.is_err() {
            return Err("User not found".to_string());
        } else {
            let mut _user = user.unwrap();
            _user.status = UserStatus::Blocked;
            Self::add_user(_user)
        }
    }

    pub fn remove_user(principal: &Principal) -> Result<(), String> {
        let user = Self::get_user(principal);
        if user.is_err() {
            return Err("User not found".to_string());
        } else {
            let blob: Blob<29> = principal.as_slice()[..29]
                .try_into()
                .map_err(|_| "failed to convert principal".to_string())?;
            PRINCIPAL_USER.with(|m| {
                m.borrow_mut().remove(&blob);
            });

            BTC_ADDRESS_USER.with(|m| {
                m.borrow_mut()
                    .remove(&UserAddress(user.unwrap().btc_address.clone()));
            });
            Ok(())
        }
    }

    pub fn add_runes(runes: TalosRunes) -> Result<(), String> {
        let key = runes.get_key();
        let runes_id = RuneId::from_str(runes.rune_id.as_str()).map_err(|e| e.to_string())?;
        if Self::get_runes(&runes_id).is_some() {
            return Err("Runes already exists".to_string());
        }
        LISTED_RUNES_MAP.with(|m| {
            m.borrow_mut().insert(key, runes.clone());
        });
        Ok(())
    }

    pub fn get_runes(rune_id: &RuneId) -> Option<TalosRunes> {
        LISTED_RUNES_MAP.with(|m| m.borrow().get(&RunesKey(format!("{}", rune_id))))
    }

    pub fn get_runes_list() -> Vec<TalosRunes> {
        LISTED_RUNES_MAP.with(|m| {
            m.borrow()
                .iter()
                .map(|f| f.1.clone())
                .collect::<Vec<TalosRunes>>()
        })
    }

    pub fn remove_runes(rune_id: &str) -> Result<(), String> {
        let key = RunesKey(rune_id.to_string());
        let runes_id = RuneId::from_str(rune_id).map_err(|e| e.to_string())?;
        if Self::get_runes(&runes_id).is_none() {
            return Err("Runes not found".to_string());
        }
        LISTED_RUNES_MAP.with(|m| {
            m.borrow_mut().remove(&key);
        });
        Ok(())
    }

    pub fn create_runes_order(
        caller: &Principal,
        rune_id: &str,
        lock_time: u32,
        stake_amount: u128,
        oracle_ts: u64,
    ) -> Result<[u8; 4], String> {
        let user = Self::get_user(&caller)?;

        if user.status == UserStatus::Blocked {
            return Err("User is blocked".to_string());
        }
        let rune_id = RuneId::from_str(rune_id).map_err(|e| e.to_string())?;

        match Self::get_runes(&rune_id) {
            None => return Err("Runes not found".to_string()),
            Some(runes) => {
                if runes.runes_status == RunesStatus::Inactive {
                    return Err("Runes is inactive".to_string());
                }
                if runes.min_stake > stake_amount {
                    return Err("Stake amount is less than minimum stake".to_string());
                }
                let runes_id = RuneId::from_str(runes.rune_id.as_str());
                if runes_id.is_err() {
                    return Err("Cannot decode rune id".to_string());
                }
                let xonly = user.btc_pubkey.xonly;
                let staker = vec_to_u832(xonly.clone()).unwrap();
                let id = new_order_id();
                let runes_order = UserStakedRunes {
                    stake_payload: StakePayload {
                        id: id.clone(),
                        staker,
                        protocol: DEFAULT_RUNES_PROTOCOL, // runes protocol
                        version: DEFAULT_STAKING_VERSION, // default version
                        vout: DEFAULT_VOUT,
                        lock_time,
                    },
                    stake_amount,
                    rune_id: rune_id.to_string(),
                    rune_name: runes.rune_name.clone(),
                    rune_divisibility: runes.rune_divisibility,
                    rune_symbol: runes.rune_symbol,
                    status: StakeStatus::Created,
                    btc_address: user.btc_address,
                    oracle_ts,
                    create_time: ic_cdk::api::time(),
                    lock_txid: None,
                    unlock_txid: None,
                };
                RUNES_ORDERS.with(|m| {
                    m.borrow_mut().insert(id.clone(), runes_order);
                });

                Ok(id.clone())
            }
        }
    }

    pub async fn get_price_from_oracles(runes_id: String) -> Result<OracleOrder, String> {
        let mut price = "".to_string();
        let mut ts = 0u64;
        if runes_id == "2584503:2".to_string() {
            ts = ic_cdk::api::time() / 1000000u64;
            price = "6.00000".to_string();
        } else if runes_id == "2587810:1775".to_string() {
            ts = ic_cdk::api::time() / 1000000u64;
            price = "5.00000".to_string();
        } else if runes_id == "2584592:58".to_string() {
            ts = ic_cdk::api::time() / 1000000u64;
            price = "4.00000".to_string();
        } else if runes_id == "2587737:194".to_string() {
            ts = ic_cdk::api::time() / 1000000u64;
            price = "3.00000".to_string();
        } else if runes_id == "2585371:62".to_string() {
            ts = ic_cdk::api::time() / 1000000u64;
            price = "2.00000".to_string();
        } else {
            return Err("No response from oracles".to_string());
        }

        ORACLE_ORDERS.with(|o| {
            o.borrow_mut().insert(
                OracleOrderKey(format!("{}/{}", ts.clone().to_string(), runes_id.clone())),
                OracleOrderSave {
                    price: price.clone(),
                    token: runes_id.clone(),
                    ts: ts.clone(),
                },
            )
        });
        Ok(OracleOrder {
            ts,
            token: runes_id,
            price: price.parse().unwrap(),
        })

        // let http = HttpService::default();
        // #[derive(CandidType, Serialize)]
        // struct TokenPriceReq {
        //     pub tokens: Vec<String>,
        // }
        //
        // let res = http
        //     .api_call::<OracleResponse>(
        //         GET_TX_BYTES + ic_cdk::api::time() / 1000u64,
        //         "tokenPrices",
        //         serde_json::to_string(&TokenPriceReq {
        //             tokens: vec![runes_id.clone()],
        //         })
        //         .unwrap()
        //         .into_bytes()
        //         .into(),
        //         None,
        //     )
        //     .await;
        // match res {
        //     Err(e) => return Err(e),
        //     Ok(res) => {
        //         if res.data.is_some() && res.data.clone().unwrap().prices.is_empty() == false {
        //             let price = res.data.unwrap().prices.clone();
        //             let first = price[0].clone();
        //             ORACLE_ORDERS.with(|o| {
        //                 o.borrow_mut().insert(
        //                     OracleOrderKey(format!(
        //                         "{}/{}",
        //                         first.clone().ts.to_string(),
        //                         runes_id
        //                     )),
        //                     OracleOrderSave {
        //                         price: first.clone().price.to_string(),
        //                         token: first.clone().token,
        //                         ts: first.clone().ts,
        //                     },
        //                 )
        //             });
        //             Ok(first.clone())
        //         } else {
        //             return Err(format!(
        //                 "No response from oracles: {:?}",
        //                 serde_json::to_string(&res)
        //             ));
        //         }
        //     }
        // }
    }

    pub async fn create_btc_order(
        caller: &Principal,
        lock_time: u32,
        stake_amount: u128,
        staking_target: StakingTarget,
    ) -> Result<([u8; 4], StakingWallet), String> {
        let user = Self::get_user(&caller)?;

        if user.status == UserStatus::Blocked {
            return Err("User is blocked".to_string());
        }

        let staking_wallet = Self::get_staking_wallet_canister();

        if staking_wallet.is_none() {
            return Err("Staking wallet canister not set".to_string());
        }

        let xonly = user.btc_pubkey.xonly;
        let staker = vec_to_u832(xonly.clone()).unwrap();
        let id = new_order_id();
        let btc_order = UserStakedBTC {
            stake_payload: BTCStakePayload {
                id,
                staker,
                protocol: DEFAULT_BTC_PROTOCOL,
                version: DEFAULT_STAKING_VERSION,
                vout: 0,
                lock_time,
            },
            stake_amount,
            status: StakeStatus::Created,
            btc_address: user.btc_address.clone(),
            stake_target: staking_target.clone(),
            create_time: ic_cdk::api::time(),
            stake_params: None,
        };
        BTC_ORDERS.with(|m| {
            m.borrow_mut().insert(id.clone(), btc_order);
        });

        let res = ic_cdk::api::call::call(
            staking_wallet.unwrap(),
            "create_staking_wallet",
            (StakingWalletCreateReq {
                user_principal: user.principal.clone(),
                user_btc_address: user.btc_address.clone(),
                stake_target: staking_target.clone(),
                order_id: id.clone(),
                key: "test_key_1".to_string(),
            },),
        )
            .await;

        let call_res = extract_call_result::<StakingWallet>(res)?;

        Ok((id.clone(), call_res))
    }

    pub fn get_user_runes_orders(caller: &Principal) -> Result<Vec<UserStakedRunes>, String> {
        let user = Self::get_user(&caller)?;
        if user.status == UserStatus::Blocked {
            return Err("User is blocked".to_string());
        }

        let res = RUNES_ORDERS.with(|m| {
            m.borrow()
                .iter()
                .filter(|(_, order)| order.btc_address == user.btc_address && order.status.is_live())
                .map(|f| f.1.clone())
                .collect::<Vec<UserStakedRunes>>()
        });
        Ok(res)
    }

    pub fn get_btc_order_by_id(order_id: String) -> Result<UserStakedBTC, String> {
        let order_id_bytes = hex::decode(order_id.clone()).map_err(|e| e.to_string())?;
        let order_id_u84 = vec_to_u84(order_id_bytes)?;
        let order = BTC_ORDERS.with(|m| m.borrow().get(&order_id_u84));
        if order.is_none() {
            Err("Order not found".to_string())
        } else {
            Ok(order.unwrap())
        }
    }

    pub fn get_runes_order_by_id(order_id: String) -> Result<UserStakedRunes, String> {
        let order_id_bytes = hex::decode(order_id.clone()).map_err(|e| e.to_string())?;
        let order_id_u84 = vec_to_u84(order_id_bytes)?;
        let order = RUNES_ORDERS.with(|m| m.borrow().get(&order_id_u84));
        if order.is_none() {
            Err("Order not found".to_string())
        } else {
            Ok(order.unwrap())
        }
    }

    pub fn update_btc_order_by_id(
        order_id: String,
        btc_order: UserStakedBTC,
    ) -> Result<(), String> {
        let order_id_bytes = hex::decode(order_id.clone()).map_err(|e| e.to_string())?;
        let order_id_u84 = vec_to_u84(order_id_bytes)?;
        BTC_ORDERS.with(|m| {
            m.borrow_mut().insert(order_id_u84, btc_order);
        });
        Ok(())
    }

    pub fn get_user_btc_orders(caller: &Principal) -> Result<Vec<UserStakedBTC>, String> {
        let user = Self::get_user(&caller)?;
        if user.status == UserStatus::Blocked {
            return Err("User is blocked".to_string());
        }

        let res = BTC_ORDERS.with(|m| {
            m.borrow()
                .iter()
                .filter(|(_, order)| {
                    order.btc_address == user.btc_address
                        && order.status.is_live()
                })
                .map(|f| f.1.clone())
                .collect::<Vec<UserStakedBTC>>()
        });
        Ok(res)
    }

    pub fn set_user_btc_order_status(order_id: Vec<u8>, status: StakeStatus) -> Result<(), String> {
        let order_id_u84 = vec_to_u84(order_id.clone())?;
        let order = BTC_ORDERS.with(|m| m.borrow().get(&order_id_u84));
        if order.is_none() {
            Err("Order not found".to_string())
        } else {
            let mut _order = order.unwrap();
            _order.status = status;
            BTC_ORDERS.with(|m| {
                m.borrow_mut().insert(order_id_u84, _order);
            });
            Ok(())
        }
    }

    pub fn set_user_runes_order_status(order_id: Vec<u8>, update: UpdateUserStakedRunes) -> Result<(), String> {
        let order_id_u84 = vec_to_u84(order_id.clone())?;
        let order = RUNES_ORDERS.with(|m| m.borrow().get(&order_id_u84));
        if order.is_none() {
            Err("Order not found".to_string())
        } else {
            let mut _order = order.unwrap();
            match update.status {
                StakeStatus::Locking => {
                    if update.lock_txid.is_none() {
                        return Err("Lock txid is required".to_string());
                    }
                    _order.lock_txid = update.lock_txid;
                }
                StakeStatus::Unlocked => {
                    if update.unlock_txid.is_none() {
                        return Err("Unlock txid is required".to_string());
                    }
                    _order.unlock_txid = update.unlock_txid;
                }
                _ => {}
            }
            _order.status = update.status;
            RUNES_ORDERS.with(|m| {
                m.borrow_mut().insert(order_id_u84, _order);
            });
            Ok(())
        }
    }

    pub fn get_all_runes_orders(
        with_principal: Option<Principal>,
        with_rune_id: Option<String>,
    ) -> Result<Vec<UserStakedRunes>, String> {
        let mut _found_id = None;
        if let Some(id) = with_rune_id {
            let id = RuneId::from_str(id.as_str()).map_err(|e| e.to_string());
            match id {
                Ok(_id) => _found_id = Some(_id),
                Err(e) => return Err(e),
            }
        }

        let mut _found_address = None;
        if let Some(principal) = with_principal {
            let user = Self::get_user(&principal)?;
            if user.status == UserStatus::Blocked {
                return Err("User is blocked".to_string());
            }
            _found_address = Some(user.btc_address);
        }

        let res = RUNES_ORDERS.with(|m| {
            m.borrow()
                .iter()
                .filter(|(_, order)| {
                    if !order.status.is_live() {
                        return false;
                    }

                    if let Some(btc_address) = &_found_address {
                        if order.btc_address != btc_address.to_string() {
                            return false;
                        }
                    }

                    if let Some(id) = _found_id {
                        if order.rune_id != id.to_string() {
                            return false;
                        }
                    }

                    true
                })
                .map(|f| f.1.clone())
                .collect::<Vec<UserStakedRunes>>()
        });
        Ok(res)
    }

    pub fn get_all_btc_orders(
        with_principal: Option<Principal>,
    ) -> Result<Vec<UserStakedBTC>, String> {
        let mut _found_address = None;
        if let Some(principal) = with_principal {
            let user = Self::get_user(&principal)?;
            if user.status == UserStatus::Blocked {
                return Err("User is blocked".to_string());
            }
            _found_address = Some(user.btc_address);
        }

        let res = BTC_ORDERS.with(|m| {
            m.borrow()
                .iter()
                .filter(|f| {
                    if let Some(btc_address) = &_found_address {
                        if f.1.btc_address != btc_address.to_string() {
                            return false;
                        }
                    }

                    true
                })
                .map(|f| f.1.clone())
                .collect::<Vec<UserStakedBTC>>()
        });
        Ok(res)
    }

    pub fn remove_btc_order(order: [u8; 4]) -> Result<(), String> {
        BTC_ORDERS.with(|m| {
            m.borrow_mut().remove(&order);
        });
        Ok(())
    }

    pub fn remove_runes_order(order: [u8; 4]) -> Result<(), String> {
        RUNES_ORDERS.with(|m| {
            m.borrow_mut().remove(&order);
        });
        Ok(())
    }

    pub fn get_lp_rewards(blocks: u64, lp_amount: u64) -> u64 {
        let setting = Self::get_setting().unwrap();
        let rewards = setting.lp_rewards_ratio * (blocks as f64) * (lp_amount as f64);
        rewards.floor() as u64
    }

    pub async fn transfer_lp_token(
        wallet_id: [u8; 32],
        ledger: Principal,
        amount: u64,
        to: Account,
    ) -> Result<Nat, String> {
        let amount = NumTokens::from(amount);
        let arg = TransferArg {
            from_subaccount: Some(wallet_id),
            to,
            amount: amount.clone(),
            fee: None,
            memo: None,
            created_at_time: None,
        };

        ic_cdk::println!("transfer arg, {:?}", arg);

        let call_result = ic_cdk::api::call::call(ledger, "icrc1_transfer", (arg.clone(),)).await
            as Result<(Result<Nat, TransferError>,), (RejectionCode, String)>;

        match call_result {
            Ok(resp) => match resp.0 {
                Ok(_resp) => Ok(_resp),
                Err(msg) => {
                    ic_cdk::println!(
                        "{}",
                        format!("Error calling transfer_lp_token msg: {}", msg)
                    );
                    Err(format!("Error calling transfer_lp_token msg: {}", msg))
                }
            },
            Err((code, msg)) => {
                ic_cdk::println!("{}", format!("call_result error msg: {}", msg));
                let code = code as u16;
                Err(format!(
                    "Error calling transfer_lp_token code: {}, msg: {}",
                    code, msg
                ))
            }
        }
    }
}

pub fn extract_call_result<T: Clone>(
    call_result: Result<(Result<T, String>,), (RejectionCode, String)>,
) -> Result<T, String> {
    match call_result {
        Ok(resp) => match resp.0 {
            Ok(r) => Ok(r.clone()),
            Err(e) => Err(e),
        },
        Err((_, msg)) => Err(msg),
    }
}
