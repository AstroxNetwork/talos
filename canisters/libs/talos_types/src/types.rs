use candid::{CandidType, Decode, Deserialize, Encode, Principal};
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::Serialize;
use std::borrow::Cow;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum RunesStatus {
    Active,
    Inactive,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct TalosRunes {
    pub rune_id: String,
    pub rune_name: String,
    pub rune_symbol: String,
    pub rune_divisibility: u8,
    pub runes_status: RunesStatus,
    pub min_stake: u128,
}

impl Storable for TalosRunes {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
    const BOUND: Bound = Bound::Bounded {
        max_size: 512,
        is_fixed_size: false,
    };
}

impl TalosRunes {
    pub fn get_key(&self) -> RunesKey {
        RunesKey(self.rune_id.clone())
    }
}

#[derive(CandidType, Deserialize, Clone, Debug, Ord, PartialOrd, Eq, PartialEq)]
pub struct RunesKey(pub String);

impl Storable for RunesKey {
    fn to_bytes(&self) -> Cow<[u8]> {
        self.0.to_bytes()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self(String::from_bytes(bytes))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 512,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum UserStatus {
    Normal,
    Blocked, // Blocked users are not allowed to stake, and cannot be re-enabled by user
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TalosUser {
    pub principal: Principal,
    pub btc_address: String,
    pub btc_pubkey: BtcPubkey,
    pub status: UserStatus,
}

#[derive(CandidType, Clone, Debug, Eq, PartialEq, Deserialize)]
pub struct BtcPubkey {
    pub pubkey: Vec<u8>,
    pub xonly: Vec<u8>,
    pub hash160: Vec<u8>,
}

impl Storable for TalosUser {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
    const BOUND: Bound = Bound::Bounded {
        max_size: 512,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum StakeStatus {
    Created,
    Locking,
    Unlocked,
    Error(String),
}

impl StakeStatus {
    pub fn is_live(&self) -> bool {
        match self {
            StakeStatus::Locking | StakeStatus::Unlocked => true,
            _ => false,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserStakedRunes {
    pub stake_payload: StakePayload,
    pub stake_amount: u128,
    pub rune_id: String,
    pub rune_name: String,
    pub rune_symbol: String,
    pub rune_divisibility: u8,
    pub status: StakeStatus,
    pub btc_address: String,
    pub oracle_ts: u64,
    pub create_time: u64,
    pub lock_txid: Option<String>,
    pub unlock_txid: Option<String>,
}

impl Storable for UserStakedRunes {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
    const BOUND: Bound = Bound::Bounded {
        max_size: 1024,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpdateUserStakedRunes {
    pub status: StakeStatus,
    pub lock_txid: Option<String>,
    pub unlock_txid: Option<String>,
}

#[derive(CandidType, Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct StakePayload {
    pub id: [u8; 4],
    pub staker: [u8; 32],
    pub protocol: u128,
    pub version: u128,
    pub vout: u32,
    pub lock_time: u32,
}

#[derive(CandidType, Clone, Debug, Eq, PartialEq, Serialize, Deserialize, Ord, PartialOrd)]
pub enum StakingTarget {
    Babylon,
    CoreDao,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct StakeParams {
    pub order_id: [u8; 4],
    pub wallet_id: String,
    pub stake_amount: u64,
    pub reveal_fee: u64,
    pub txid: String,
    pub vout: u32,
    pub value: u64,
    pub chain_id: u16,
    pub delegator: String,
    pub validator: String,
    pub stake_lock_time: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserStakedBTC {
    pub stake_payload: BTCStakePayload,
    pub stake_amount: u128,
    pub status: StakeStatus,
    pub btc_address: String,
    pub stake_target: StakingTarget,
    pub create_time: u64,
    pub stake_params: Option<StakeParams>,
}

impl Storable for UserStakedBTC {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
    const BOUND: Bound = Bound::Bounded {
        max_size: 2048,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct BTCStakePayload {
    pub id: [u8; 4],
    pub staker: [u8; 32],
    pub protocol: u128,
    pub version: u128,
    pub vout: u32,
    pub lock_time: u32,
}

#[derive(CandidType, Clone, Debug, Ord, PartialOrd, Eq, PartialEq, Serialize, Deserialize)]
pub struct StakingWallet {
    pub user_principal: Principal,
    pub user_btc_address: String,
    pub stake_target: StakingTarget,
    pub stake_address: String,
    pub bytes: [u8; 32],
    pub pub_key_hex: String,
    pub order_id: [u8; 4],
}

#[derive(CandidType, Clone, Debug, Ord, PartialOrd, Eq, PartialEq, Serialize, Deserialize)]
pub struct StakingWalletReq {
    pub user_principal: Principal,
    pub user_btc_address: String,
    pub stake_target: StakingTarget,
    pub stake_address: String,
    pub bytes: String,
}

impl Storable for StakingWallet {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
    const BOUND: Bound = Bound::Bounded {
        max_size: 1024,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Clone, Serialize, Deserialize)]
pub struct StakingWalletCreateReq {
    pub user_principal: Principal,
    pub user_btc_address: String,
    pub stake_target: StakingTarget,
    pub order_id: [u8; 4],
    pub key: String,
}
