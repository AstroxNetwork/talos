use std::borrow::Cow;

use candid::{CandidType, Decode, Encode};
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use itertools::Itertools;
use serde::Deserialize;

use crate::memory::CACHES;

const MAX_CACHE_SIZE: u32 = 2 * 1024 * 1024;
#[derive(CandidType, Deserialize, Clone)]
pub struct CachedPayload {
    method_id: u64,
    cached_time: u64,
    pub cached_bytes: Vec<u8>,
}

impl Storable for CachedPayload {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_CACHE_SIZE,
        is_fixed_size: false,
    };
}

impl CachedPayload {
    pub fn new(method_id: u64, cached_bytes: Vec<u8>) -> CachedPayload {
        let cached_time = ic_cdk::api::time();
        PayloadCached::add_cached_payload(CachedPayload {
            method_id,
            cached_time,
            cached_bytes,
        })
    }
}

pub struct PayloadCached {}

impl PayloadCached {
    pub fn get_life_time() -> u64 {
        5 * 60 * 1000000000u64
    }

    pub fn get_cached_payload(method_id: u64) -> Option<CachedPayload> {
        // Get the user from the USERS map
        CACHES.with(|cache| {
            cache
                .borrow()
                .get(&method_id)
                .map(|cached_payload| cached_payload.clone())
        })
    }

    pub fn add_cached_payload(cached_payload: CachedPayload) -> CachedPayload {
        // Create a new user profile
        CACHES.with(|cache| {
            // Get a mutable reference to the cache
            let mut user_borrow_mut = cache.borrow_mut();

            // Insert the new user into the users
            user_borrow_mut.insert(cached_payload.method_id.clone(), cached_payload.clone());

            // Return the user
            user_borrow_mut
                .get(&cached_payload.method_id.clone())
                .unwrap()
                .clone()
        })
    }

    pub fn remove_cached_payload(method_id: u64) {
        // Create a new user profile
        CACHES.with(|cache| {
            // Get a mutable reference to the cache
            let mut user_borrow_mut = cache.borrow_mut();

            // Insert the new user into the users
            user_borrow_mut.remove(&method_id);
        })
    }

    pub fn get_all_cached_payloads() -> Vec<CachedPayload> {
        // Get the users from the USERS map
        CACHES.with(|cache| {
            // Iterate through the users and map the user profile
            cache
                .borrow()
                .iter()
                .map(|(_, cached_payload)| cached_payload)
                // Collect the user profiles into a vector
                .collect_vec()
        })
    }

    pub fn clear_cached_payloads() {
        // Get the users from the USERS map
        CACHES.with(|cache| {
            // Iterate through the users and map the user profile
            cache.borrow().iter().for_each(|s| {
                cache.borrow_mut().remove(&s.0);
            })
        })
    }

    pub fn remove_expired_caches() {
        PayloadCached::get_expiored_caches().iter().for_each(|s| {
            PayloadCached::remove_cached_payload(s.clone());
        })
    }

    pub fn get_expiored_caches() -> Vec<u64> {
        let now = ic_cdk::api::time();
        CACHES.with(|cache| {
            // Iterate through the users and map the user profile
            cache
                .borrow()
                .iter()
                .filter(|s| {
                    let cached_time = s.1.cached_time;
                    let cached_life_time = PayloadCached::get_life_time();
                    let expired_time = cached_time + cached_life_time;
                    now > expired_time
                })
                .map(|(v, _)| v.clone())
                .collect_vec()
        })
    }
}
