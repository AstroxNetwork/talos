use std::borrow::Cow;

use candid::{CandidType, Principal};
use candid::{Decode, Encode};
use ego_types::app_info::AppInfo;
use ego_types::registry::Registry;
use ego_types::user::User;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Serialize};

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
        max_size: 1024,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct TalosSetting {
    pub oracles_endpoint: String,
    pub staking_wallet_canister: Principal,
    pub token_canister: Principal,
}

impl TalosSetting {
    pub fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    pub fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

#[derive(CandidType, Serialize, Deserialize, Ord, PartialOrd, Eq, PartialEq, Clone)]
pub struct UserAddress(pub String);

impl Storable for UserAddress {
    fn to_bytes(&self) -> Cow<[u8]> {
        self.0.to_bytes()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self(String::from_bytes(bytes))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 128,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct UserDetail {}
