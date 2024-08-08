use candid::Principal;
use ic_stable_structures::storable::Blob;
use ic_stable_structures::Storable;
use std::str::FromStr;

use talos_types::ordinals::RuneId;
use talos_types::types::{
    RunesKey, RunesStatus, StakePayload, StakeStatus, TalosRunes, TalosUser, UserStakedRunes,
    UserStatus,
};

use crate::memory::{
    insert_btree, BTC_ADDRESS_USER, BTREES, LISTED_RUNES_MAP, PRINCIPAL_USER, RUNES_ORDERS,
};
use crate::types::{BtreeKey, BtreeValue, TalosSetting, UserAddress};
use crate::utils::{new_order_id, vec_to_u832};

pub static DEFAULT_RUNES_PROPTOCOL: u128 = 1;
pub static DEFAULT_STAKING_VERSION: u128 = 0;

pub static DEFAULT_VOUT: u32 = 0;

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
                        protocol: DEFAULT_RUNES_PROPTOCOL, // runes protocol
                        version: DEFAULT_STAKING_VERSION,  // default version
                        vout: DEFAULT_VOUT,
                        lock_time,
                    },
                    stake_amount,
                    runes_id: format!("{}", rune_id),
                    status: StakeStatus::Created,
                    btc_address: user.btc_address,
                };
                RUNES_ORDERS.with(|m| {
                    m.borrow_mut().insert(id.clone(), runes_order);
                });

                Ok(id.clone())
            }
        }
    }

    pub fn get_user_runes_orders(caller: &Principal) -> Result<Vec<UserStakedRunes>, String> {
        let user = Self::get_user(&caller)?;
        if user.status == UserStatus::Blocked {
            return Err("User is blocked".to_string());
        }

        let res = RUNES_ORDERS.with(|m| {
            m.borrow()
                .iter()
                .filter(|f| f.1.btc_address == user.btc_address)
                .map(|f| f.1.clone())
                .collect::<Vec<UserStakedRunes>>()
        });
        Ok(res)
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
                .filter(|f| {
                    if let Some(btc_address) = &_found_address {
                        if f.1.btc_address != btc_address.to_string() {
                            return false;
                        }
                    }
                    if let Some(id) = _found_id {
                        if f.1.runes_id != format!("{}", id).to_string() {
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

    pub fn remove_order(order: [u8; 4]) -> Result<(), String> {
        RUNES_ORDERS.with(|m| {
            m.borrow_mut().remove(&order);
        });
        Ok(())
    }
}
