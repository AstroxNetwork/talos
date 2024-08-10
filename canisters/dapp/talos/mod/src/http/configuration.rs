use candid::CandidType;
use ic_cdk::api::management_canister::http_request::HttpHeader;
use serde::Deserialize;

#[derive(CandidType, Debug, Clone, Deserialize)]
pub struct Configuration {
    pub base_path: String,
    pub sub_path: String,
    pub basic_auth: Option<BasicAuth>,
    pub oauth_access_token: Option<String>,
    pub bearer_access_token: Option<String>,
    pub headers: Vec<HttpHeader>,
    pub api_key: Option<ApiKey>,
    pub cycles: Option<u64>, // TODO: take an oauth2 token source, similar to the go one
}

pub type BasicAuth = (String, Option<String>);

#[derive(CandidType, Debug, Clone, Deserialize)]
pub struct ApiKey {
    pub prefix: Option<String>,
    pub key: String,
}

impl Configuration {
    pub fn new() -> Configuration {
        Configuration::default()
    }
}

impl Default for Configuration {
    fn default() -> Self {
        let low = ic_cdk::api::time();
        let high = ic_cdk::api::time();
        let headers = vec![
            HttpHeader {
                name: "Accept".to_string(),
                value: "application/json".to_string(),
            },
            HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/json".to_string(),
            },
            HttpHeader {
                name: "Host".to_string(),
                value: "talos-canister".to_string(),
            },
            HttpHeader {
                name: "User-Agent".to_string(),
                value: "talos".to_string(),
            },
            HttpHeader {
                name: "Idempotency-Key".to_string(),
                value: uuid::Uuid::from_u64_pair(low, high)
                    .hyphenated()
                    .to_string(),
            },
        ];

        Configuration {
            base_path: "https://oracle.wizz.cash/mp".to_owned(),
            sub_path: "oracle".to_owned(),
            basic_auth: None,
            oauth_access_token: None,
            bearer_access_token: None,
            headers,
            cycles: Some(21000000000u64),
            api_key: None,
        }
    }
}

impl Configuration {
    pub fn set_config(&mut self, config: Configuration) {
        self.base_path = config.base_path;
        self.basic_auth = config.basic_auth;
        self.oauth_access_token = config.oauth_access_token;
        self.bearer_access_token = config.bearer_access_token;
        self.api_key = config.api_key;
    }
}
