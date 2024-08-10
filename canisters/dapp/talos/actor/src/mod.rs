pub mod actor;

#[allow(unused_imports)]
use candid::Principal;
#[allow(unused_imports)]
use ego_types::app::{AppId, Version};
#[allow(unused_imports)]
use ego_types::app_info::AppInfo;
#[allow(unused_imports)]
use ic_cdk::api::management_canister::http_request::{HttpResponse, TransformArgs};
#[allow(unused_imports)]
use std::collections::BTreeMap;
#[allow(unused_imports)]
use talos_mod::types::*;
#[allow(unused_imports)]
use talos_types::ordinals::*;
#[allow(unused_imports)]
use talos_types::types::*;

candid::export_service!();

#[no_mangle]
pub fn get_candid_pointer() -> *mut std::os::raw::c_char {
    let c_string = std::ffi::CString::new(__export_service()).unwrap();

    c_string.into_raw()
}
