use bitcoin::hashes::Hash;
use bitcoin::Txid;
use candid::CandidType;
use candid::{Decode, Encode};
use ego_types::app_info::AppInfo;
use ego_types::registry::Registry;
use ego_types::user::User;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

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

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct CreateCoreDaoTxReq {
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
    pub key_string: String,
    pub export_psbt: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct CreateCoreDaoTxRes {
    pub signed_tx_commit: SignedTx,
    // pub signed_tx_reveal: SignedTx,
    pub redeem_script: Vec<u8>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SignedTx {
    pub(crate) tx_hex: String,
    pub(crate) psbt_b64: Option<String>,
    pub(crate) txid: String,
}

#[derive(CandidType, Serialize, Deserialize, Ord, PartialOrd, Eq, PartialEq, Clone)]
pub enum TxType {
    Lock,
    Transfer,
    Deposit,
    Withdraw,
}

#[derive(CandidType, Serialize, Deserialize, Ord, PartialOrd, Eq, PartialEq, Clone)]
pub enum TxState {
    Stashed,
    Pending(u64),   // broadcast time
    Confirmed(u64), // confirmed blockheight
}

pub type TxID = [u8; 32];

#[derive(CandidType, Serialize, Deserialize, Ord, PartialOrd, Eq, PartialEq, Clone)]
pub struct TxDetail {
    pub tx_type: TxType,
    pub txid: String,
    pub tx_bytes: Vec<u8>,
    pub tx_state: TxState,
    pub wallet_id: String,
    pub lock_time: u32,
}

impl TxDetail {
    pub fn get_txid(&self) -> TxID {
        let mut txid = [0u8; 32];
        txid.copy_from_slice(
            &Txid::from_slice(&hex::decode(self.txid.clone()).unwrap())
                .unwrap()
                .as_ref(),
        );
        txid
    }
}

impl Storable for TxDetail {
    // serialize the struct to bytes
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
