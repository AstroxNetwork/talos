use crate::http::configuration::Configuration;
use crate::http::payload::{CachedPayload, PayloadCached};
use crate::state::info_log_add;
use async_trait::async_trait;
use candid::CandidType;
use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpMethod, TransformContext, TransformFunc,
};
use serde::Deserialize;

pub mod configuration;
pub mod payload;

#[derive(CandidType, Deserialize, Clone)]
pub struct HttpService {
    pub network: String,
    pub config: Configuration,
}

impl Default for HttpService {
    fn default() -> Self {
        HttpService {
            network: "testnet".to_string(),
            config: Configuration::default(),
        }
    }
}

impl HttpService {
    pub fn new(network: String, config: Configuration) -> Self {
        HttpService { network, config }
    }

    pub fn set_endpoint(&mut self, endpoint: String, sub_path: Option<String>) {
        self.config.base_path = endpoint;
        if let Some(sub_path) = sub_path {
            self.config.sub_path = sub_path;
        }
    }

    fn _get_path(&self, path: &str) -> String {
        format!(
            "{}/{}/{}",
            self.config.base_path, self.config.sub_path, path
        )
    }

    fn _get_request_params(&self, url: String) -> CanisterHttpRequestArgument {
        CanisterHttpRequestArgument {
            url,
            max_response_bytes: Some(2000000u64), //optional for request
            method: HttpMethod::GET,
            headers: self.config.headers.clone(),
            body: None,
            transform: Some(TransformContext {
                function: TransformFunc(candid::Func {
                    principal: ic_cdk::api::id(),
                    method: "transform".to_string(),
                }),
                context: vec![],
            }), //optional for request
        }
    }

    fn _get_request_params_post(
        &self,
        url: String,
        body: Option<Vec<u8>>,
    ) -> CanisterHttpRequestArgument {
        CanisterHttpRequestArgument {
            url,
            max_response_bytes: Some(2000000u64), //optional for request
            method: HttpMethod::POST,
            headers: self.config.headers.clone(),
            body,
            transform: Some(TransformContext {
                function: TransformFunc(candid::Func {
                    principal: ic_cdk::api::id(),
                    method: "transform".to_string(),
                }),
                context: vec![],
            }), //optional for request
        }
    }

    fn _get_cycles(&self, cycles: Option<u64>) -> u64 {
        cycles.map_or_else(|| self.config.cycles.unwrap_or(21000000000u64), |c| c)
    }

    fn remove_expired_caches() {
        PayloadCached::remove_expired_caches();
    }
    pub(crate) async fn api_call<T>(
        &self,
        cache_key: u64,
        endpoint: &str,
        body: Option<Vec<u8>>,
        cycles: Option<u64>,
    ) -> Result<T, String>
    where
        T: for<'a> serde::Deserialize<'a> + Clone + candid::CandidType,
    {
        // should use timer to clear cache
        HttpService::remove_expired_caches();
        match PayloadCached::get_cached_payload(cache_key.clone()) {
            None => {
                let path = self._get_path(endpoint);
                let request = if body.is_none() {
                    self._get_request_params(path)
                } else {
                    self._get_request_params_post(path, body)
                };
                let cycles = self._get_cycles(cycles);
                let call_res = http_call::<T>(request, cycles).await?;
                PayloadCached::add_cached_payload(CachedPayload::new(
                    cache_key.clone(),
                    candid::encode_one(&call_res.clone()).unwrap(),
                ));
                Ok(call_res.clone())
            }

            Some(r) => match candid::decode_one::<T>(&r.cached_bytes) {
                Err(e) => Err(e.to_string()),
                Ok(r) => Ok(r.clone()),
            },
        }
    }

    #[allow(unused)]
    async fn api_call_raw(
        &self,
        cache_key: u64,
        endpoint: &str,
        body: Option<Vec<u8>>,
        cycles: Option<u64>,
    ) -> Result<Vec<u8>, String> {
        // should use timer to clear cache
        HttpService::remove_expired_caches();
        match PayloadCached::get_cached_payload(cache_key.clone()) {
            None => {
                let path = self._get_path(endpoint);

                let request = if body.is_none() {
                    self._get_request_params(path)
                } else {
                    self._get_request_params_post(path, body)
                };
                let cycles = self._get_cycles(cycles);
                let call_res = http_call_raw(request, cycles).await?;
                PayloadCached::add_cached_payload(CachedPayload::new(
                    cache_key.clone(),
                    call_res.clone(),
                ));
                Ok(call_res.clone())
            }
            Some(r) => Ok(r.cached_bytes),
        }
    }

    async fn api_call_string(
        &self,
        cache_key: u64,
        endpoint: &str,
        cycles: Option<u64>,
    ) -> Result<String, String> {
        // should use timer to clear cache
        HttpService::remove_expired_caches();
        match PayloadCached::get_cached_payload(cache_key.clone()) {
            None => {
                let path = self._get_path(endpoint);
                let request = self._get_request_params(path);
                let cycles = self._get_cycles(cycles);
                let call_res = http_call_string(request, cycles).await?;
                PayloadCached::add_cached_payload(CachedPayload::new(
                    cache_key.clone(),
                    call_res.clone().into_bytes(),
                ));
                Ok(call_res.clone())
            }
            Some(r) => Ok(String::from_utf8(r.cached_bytes).unwrap()),
        }
    }
}

// http_call is to be used for http requests to other canisters
// `request` is the request to be sent to the other canister
// `CanisterHttpRequestArgument` is a struct that contains the following fields:
//  - method: String
//  - url: String
//  - headers: Vec<(String, String)>
//  - body: Vec<u8>
// `cycles` is the amount of cycles to be sent to the other canister
// `Result<T, String>` is the result of the http call
pub async fn http_call<T>(request: CanisterHttpRequestArgument, cycles: u64) -> Result<T, String>
where
    T: for<'a> serde::Deserialize<'a> + Clone + candid::CandidType,
{
    ic_cdk::println!("http_call: request: {:?}", request);
    info_log_add(format!("url:{:?}, body: {:?}", request.url, request.body).as_str());
    match http_request(request, cycles as u128).await {
        Ok((response,)) => {
            let str_body = String::from_utf8(response.body)
                .expect("Transformed response is not UTF-8 encoded.");
            let res: T = serde_json::from_str(&str_body).map_err(|e| {
                format!(
                    "Couldn't deserilize result {} with string {}",
                    e.to_string(),
                    str_body
                )
            })?;
            Ok(res)
        }
        Err((r, m)) => {
            let message =
                format!("The http_request resulted into error. RejectionCode: {r:?}, Error: {m}");

            //Return the error as a string and end the method
            Err(message)
        }
    }
}

pub async fn http_call_string(
    request: CanisterHttpRequestArgument,
    cycles: u64,
) -> Result<String, String> {
    match http_request(request, cycles as u128).await {
        Ok((response,)) => {
            let str_body = String::from_utf8(response.body)
                .expect("Transformed response is not UTF-8 encoded.");

            Ok(str_body)
        }
        Err((r, m)) => {
            let message =
                format!("The http_request resulted into error. RejectionCode: {r:?}, Error: {m}");

            //Return the error as a string and end the method
            Err(message)
        }
    }
}

pub async fn http_call_raw(
    request: CanisterHttpRequestArgument,
    cycles: u64,
) -> Result<Vec<u8>, String> {
    match http_request(request, cycles as u128).await {
        Ok((response,)) => Ok(response.body),
        Err((r, m)) => {
            let message =
                format!("The http_request resulted into error. RejectionCode: {r:?}, Error: {m}");

            //Return the error as a string and end the method
            Err(message)
        }
    }
}
