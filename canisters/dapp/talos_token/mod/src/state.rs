use ego_macros::{inject_app_info, inject_ego_data};
use std::cell::RefCell;
use ic_stable_structures::Memory;
use crate::types::StableState;
use crate::memory::CONFIG;

inject_ego_data!();
inject_app_info!();

/********************  methods for canister_registry_macro   ********************/
fn on_canister_added(name: &str, canister_id: Principal) {
    info_log_add(
        format!(
            "on_canister_added name: {}, canister_id: {}",
            name, canister_id
        )
            .as_str(),
    );
}


/// Preupdate hook for stable state, we don't need stable save anymore
/// use memory to save state
/// ciborium as a serilizer to make state save more efficient
/// and use memory to manage all states, see crate::memory
/// here we use upgrades_memory as the upgrades hook management.
/// we use bytes len as the first 4 bytes to save the state length
/// and then save the state bytes
pub fn pre_upgrade() {
    info_log_add("enter example pre_upgrade");

    info_log_add("enter omni_wallet pre_upgrade");

    // composite StableState
    let stable_state = StableState {
        users: Some(users_pre_upgrade()),
        registry: Some(registry_pre_upgrade()),
        app_info: Some(app_info_pre_upgrade()),
    };

    let mut state_bytes = vec![];

    ciborium::ser::into_writer(&stable_state, &mut state_bytes).expect("failed to serialize state");
    let len = state_bytes.len() as u32;
    let memory = crate::memory::get_upgrades_memory();
    crate::memory::write(&memory, 0, &len.to_le_bytes());
    crate::memory::write(&memory, 4, &state_bytes);


}

/// Postupgrade hook is used to restore state
/// we use upgrades_memory to restore state
/// first read the state length from the first 4 bytes
/// and then read the state bytes
pub fn post_upgrade() {
    info_log_add("enter example post_upgrade");

    let memory = crate::memory::get_upgrades_memory();

    // Read the length of the state bytes.
    let mut state_len_bytes = [0; 4];
    memory.read(0, &mut state_len_bytes);
    let state_len = u32::from_le_bytes(state_len_bytes) as usize;

    // Read the bytes
    let mut state_bytes = vec![0; state_len];
    memory.read(4, &mut state_bytes);

    // Deserialize and set the state.
    let state: StableState =
        ciborium::de::from_reader(&*state_bytes).expect("failed to decode state");

    // let (state,): (StableState,) =
    //     ic_cdk::storage::stable_restore().expect("failed to restore stable state");
    //
    match state.users {
        None => {}
        Some(users) => {
            users_post_upgrade(users);
        }
    }

    match state.registry {
        None => {}
        Some(registry) => {
            registry_post_upgrade(registry);
        }
    }

    match state.app_info {
        None => {}
        Some(app_info) => {
            app_info_post_upgrade(app_info);
        }
    }


}
