pub mod actor;

#[allow(unused_imports)]
use candid::Principal;
#[allow(unused_imports)]
use ego_types::app::{AppId, Version};
#[allow(unused_imports)]
use ego_types::app_info::AppInfo;
#[allow(unused_imports)]
use std::collections::BTreeMap;
#[allow(unused_imports)]
use talos_staking_wallet_mod::types::*;

candid::export_service!();

#[no_mangle]
pub fn get_candid_pointer() -> *mut std::os::raw::c_char {
    let c_string = std::ffi::CString::new(__export_service()).unwrap();

    c_string.into_raw()
}
