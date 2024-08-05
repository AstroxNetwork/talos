use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, Memory, StableBTreeMap,
};

use crate::types::*;
use candid::Principal;
use ic_cdk::trap;
use std::cell::RefCell;

const USER_PROFILE_MEM_ID: MemoryId = MemoryId::new(0);
const USER_WALLET_MEM_ID: MemoryId = MemoryId::new(1);

const UPGRADES: MemoryId = MemoryId::new(3);

const BTREE_ID: MemoryId = MemoryId::new(91);

#[allow(dead_code)]
const METADATA_PAGES: u64 = 16;

type VM = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
   pub static CONFIG:RefCell<StableState> = RefCell::new(StableState::default());

    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    pub static USERS: RefCell<StableBTreeMap<u16, UserProfile, VM>> = MEMORY_MANAGER.with(|mm| {
        RefCell::new(StableBTreeMap::init(mm.borrow().get(USER_PROFILE_MEM_ID)))
    });

    pub static WALLETS: RefCell<StableBTreeMap<u16, UserWallet, VM>> = MEMORY_MANAGER.with(|mm| {
        RefCell::new(StableBTreeMap::init(mm.borrow().get(USER_WALLET_MEM_ID)))
    });

    pub static BTREES: RefCell<StableBTreeMap<BtreeKey, BtreeValue, VM>> = RefCell::new(StableBTreeMap::init(get_btree_memory()));
}

pub fn get_upgrades_memory() -> VirtualMemory<DefaultMemoryImpl> {
    MEMORY_MANAGER.with(|m| m.borrow().get(UPGRADES))
}
pub fn get_btree_memory() -> VirtualMemory<DefaultMemoryImpl> {
    MEMORY_MANAGER.with(|m| m.borrow().get(BTREE_ID))
}
pub fn insert_btree(key: String, value: BtreeValue) {
    BTREES.with(|m| m.borrow_mut().insert(BtreeKey(key), value));
}
pub fn get_btree(key: String) -> Option<BtreeValue> {
    BTREES.with(|m| m.borrow().get(&BtreeKey(key)))
}
pub fn get_all_btree() -> Vec<BtreeValue> {
    BTREES.with(|m| {
        m.borrow()
            .iter()
            .map(|f| f.1.clone())
            .collect::<Vec<BtreeValue>>()
    })
}

pub type Salt = [u8; 32];

pub fn get_salt() -> Option<BtreeValue> {
    get_btree("salt".to_string())
}
pub fn set_salt(value: Salt) {
    insert_btree(
        "salt".to_string(),
        BtreeValue {
            key: "salt".to_string(),
            value: value.to_vec(),
        },
    )
}

pub async fn ensure_salt_set() -> Vec<u8> {
    match get_salt() {
        None => {
            let res: Vec<u8> =
                match ic_cdk::call(Principal::management_canister(), "raw_rand", ()).await {
                    Ok((res,)) => res,
                    Err((_, err)) => trap(&format!("failed to get salt: {}", err)),
                };
            let salt: Salt = res[..].try_into().unwrap_or_else(|_| {
                trap(&format!(
                    "expected raw randomness to be of length 32, got {}",
                    res.len()
                ));
            });
            set_salt(salt.clone());
            salt.clone().to_vec()
        }
        Some(r) => r.value.clone(),
    }
}

const WASM_PAGE_SIZE: u64 = 65536;
/// Write memory and increase memory size if necessary.
/// use page size 64kb
pub fn write<M: Memory>(memory: &M, offset: u64, bytes: &[u8]) {
    let last_byte = offset
        .checked_add(bytes.len() as u64)
        .expect("Address space overflow");

    let size_pages = memory.size();
    let size_bytes = size_pages
        .checked_mul(WASM_PAGE_SIZE)
        .expect("Address space overflow");

    if size_bytes < last_byte {
        let diff_bytes = last_byte - size_bytes;
        let diff_pages = diff_bytes
            .checked_add(WASM_PAGE_SIZE - 1)
            .expect("Address space overflow")
            / WASM_PAGE_SIZE;
        if memory.grow(diff_pages) == -1 {
            panic!(
                "Failed to grow memory from {} pages to {} pages (delta = {} pages).",
                size_pages,
                size_pages + diff_pages,
                diff_pages
            );
        }
    }
    memory.write(offset, bytes);
}
