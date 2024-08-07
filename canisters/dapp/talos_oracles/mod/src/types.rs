use candid::CandidType;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

use crate::memory::{USERS, WALLETS};
use candid::{Decode, Encode};
use ego_types::app_info::AppInfo;
use ego_types::registry::Registry;
use ego_types::user::User;
use itertools::Itertools;

#[allow(dead_code)]
const MAX_STATE_SIZE: u32 = 2 * 1024 * 1024;
const MAX_USER_PROFILE_SIZE: u32 = 1 * 1024 * 1024;
const MAX_USER_WALLET_SIZE: u32 = 1 * 1024 * 1024;

#[derive(CandidType, Serialize, Deserialize)]
pub struct StableState {
    pub users: Option<User>,
    pub registry: Option<Registry>,
    pub app_info: Option<AppInfo>,
}

impl Storable for StableState {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_USER_WALLET_SIZE,
        is_fixed_size: false,
    };
}

impl Default for StableState {
    fn default() -> Self {
        StableState {
            users: None,
            registry: None,
            app_info: None,
        }
    }
}

#[derive(CandidType, Deserialize)]
pub struct UserProfile {
    user_id: u16,
    user_name: String,
}

impl Storable for UserProfile {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_USER_PROFILE_SIZE,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Deserialize)]
pub struct UserWallet {
    user_id: u16,
    balance: u32,
}

impl Storable for UserWallet {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_USER_WALLET_SIZE,
        is_fixed_size: false,
    };
}

pub struct Example {}

impl Example {
    pub fn add_user(user_id: u16, user_name: String) -> UserProfile {
        USERS.with(|users| {
            let mut user_borrow_mut = users.borrow_mut();

            // if !user_borrow_mut.contains_key(&user_id) {
            user_borrow_mut.insert(user_id, UserProfile { user_id, user_name });
            // }

            user_borrow_mut.get(&user_id).unwrap()
        })
    }

    pub fn get_user(user_id: u16) -> Option<UserProfile> {
        USERS.with(|users| users.borrow().get(&user_id))
    }

    pub fn get_all_users() -> Vec<UserProfile> {
        USERS.with(|users| {
            users
                .borrow()
                .iter()
                .map(|(_, user_profile)| user_profile)
                .collect_vec()
        })
    }

    pub fn add_wallet(user_id: u16, balance: u32) -> UserWallet {
        WALLETS.with(|wallets| {
            let mut user_borrow_mut = wallets.borrow_mut();

            if !user_borrow_mut.contains_key(&user_id) {
                user_borrow_mut.insert(user_id, UserWallet { user_id, balance });
            }

            user_borrow_mut.get(&user_id).unwrap()
        })
    }

    pub fn get_wallet(user_id: u16) -> Option<UserWallet> {
        WALLETS.with(|wallets| wallets.borrow().get(&user_id))
    }

    pub fn get_all_wallets() -> Vec<UserWallet> {
        WALLETS.with(|wallets| {
            wallets
                .borrow()
                .iter()
                .map(|(_, user_profile)| user_profile)
                .collect_vec()
        })
    }
}

/// We define an example key with String
/// because String is expandable, cannot store in stable structure directly,
/// so we use a struct to wrap it.
#[derive(CandidType, Serialize, Deserialize, Ord, PartialOrd, Eq, PartialEq, Clone)]
pub struct BtreeKey(pub String);

impl Storable for BtreeKey {
    fn to_bytes(&self) -> Cow<[u8]> {
        self.0.to_bytes()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self(String::from_bytes(bytes))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 64 * 2,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct BtreeValue {
    /// key is expandable,
    /// but we have to give it a boundary
    /// say 128 bytes
    pub key: String,
    /// value is expandable,
    /// but we have to give it a boundary
    /// say 896 bytes
    pub value: Vec<u8>,
}

impl Storable for BtreeValue {
    // serialize the struct to bytes
    fn to_bytes(&self) -> Cow<[u8]> {
        candid::encode_one::<&BtreeValue>(self)
            .expect("Error: Candid Serializing BtreeValue")
            .into()
    }

    // deserialize the bytes to struct
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one::<BtreeValue>(bytes.as_ref())
            .expect("Error: Candid DeSerializing BtreeValue")
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 64 * 2,
        is_fixed_size: false,
    };
}
