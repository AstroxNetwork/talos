use bitcoin::script::{Builder, PushBytes};
use bitcoin::{opcodes, script, ScriptBuf};

pub static PK_LENGTH: u32 = 32;
pub static MAGIC_BYTES_LEN: u32 = 4;

pub struct BabylonStakingScript {
    pub staker_key: Vec<u8>,
    // A list of public keys without the coordinate bytes corresponding to the finality providers
    // the stake will be delegated to.
    // Currently, Babylon does not support restaking, so this should contain only a single item.
    pub finality_provider_keys: Vec<Vec<u8>>,
    // A list of the public keys without the coordinate bytes corresponding to
    // the covenant emulators.
    // This is a parameter of the Babylon system and should be retrieved from there.
    pub covenant_keys: Vec<Vec<u8>>,
    // The number of covenant emulator signatures required for a transaction
    // to be valid.
    // This is a parameter of the Babylon system and should be retrieved from there.
    pub covenant_threshold: u64,
    // The staking period denoted as a number of BTC blocks.
    pub staking_time_lock: u64,
    // The unbonding period denoted as a number of BTC blocks.
    // This value should be more than equal than the minimum unbonding time of the
    // Babylon system.
    pub unbonding_time_lock: u64,
    // The magic bytes used to identify the staking transaction on Babylon
    // through the data return script
    pub magic_bytes: Vec<u8>,
}

impl BabylonStakingScript {
    pub fn validate(&self) -> bool {
        // check that staker key is the correct length
        // if (self.staker_key.len() != PK_LENGTH) {
        //     return false;
        // }
        if self.staker_key.len() != PK_LENGTH as usize {
            return false;
        }

        // check that finalityProvider keys are the correct length

        if self
            .finality_provider_keys
            .iter()
            .any(|finality_provider_key| finality_provider_key.len() != PK_LENGTH as usize)
        {
            return false;
        }

        // check that covenant keys are the correct length

        if self
            .covenant_keys
            .iter()
            .any(|covenant_key| covenant_key.len() != PK_LENGTH as usize)
        {
            return false;
        }

        // Check whether we have any duplicate keys
        if self._has_duplicated_keys() {
            return false;
        }

        //
        // check that the threshold is above 0 and less than or equal to
        // the size of the covenant emulators set
        if self.covenant_threshold == 0 || self.covenant_threshold > self.covenant_keys.len() as u64
        {
            return false;
        }

        //
        // check that maximum value for staking time is not greater than uint16 and above 0
        if self.staking_time_lock == 0 || self.staking_time_lock > 65535 {
            return false;
        }

        //
        // check that maximum value for unbonding time is not greater than uint16 and above 0
        if self.unbonding_time_lock == 0 || self.unbonding_time_lock > 65535 {
            return false;
        }

        //
        // check that the magic bytes are 4 in length

        if self.magic_bytes.len() != MAGIC_BYTES_LEN as usize {
            return false;
        }

        true
    }

    pub fn _has_duplicated_keys(&self) -> bool {
        let mut keys = vec![];
        keys.push(self.staker_key.clone());
        keys.extend(self.finality_provider_keys.clone());
        keys.extend(self.covenant_keys.clone());

        let mut sorted_keys = keys.clone();
        sorted_keys.sort();
        for i in 0..sorted_keys.len() - 1 {
            if sorted_keys[i] == sorted_keys[i + 1] {
                return true;
            }
        }
        false
    }

    // The staking script allows for multiple finality provider public keys
    // to support (re)stake to multiple finality providers
    // Covenant members are going to have multiple keys

    /**
     * Builds a timelock script.
     * @param timelock - The timelock value to encode in the script.
     * @returns {Buffer} containing the compiled timelock script.
     */
    // buildTimelockScript(timelock: number): Buffer {
    // return script.compile([
    // this.#stakerKey,
    // opcodes.OP_CHECKSIGVERIFY,
    // script.number.encode(timelock),
    // opcodes.OP_CHECKSEQUENCEVERIFY,
    // ]);
    // }
    pub fn build_timelock_script(&self, time_lock: u64) -> ScriptBuf {
        Builder::new()
            .push_slice::<&PushBytes>(self.staker_key.clone().as_slice().try_into().unwrap())
            .push_opcode(opcodes::all::OP_CHECKSIGVERIFY)
            .push_int(time_lock.clone() as i64)
            .push_opcode(opcodes::all::OP_CSV)
            .into_script()
    }

    pub fn build_staking_timelock_script(&self) -> ScriptBuf {
        self.build_timelock_script(self.staking_time_lock)
    }

    pub fn build_unbounding_timelock_script(&self) -> ScriptBuf {
        self.build_timelock_script(self.unbonding_time_lock)
    }

    pub fn build_unbounding_script(&self) -> ScriptBuf {
        let single = self
            .build_single_key_script(self.staker_key.clone(), true)
            .unwrap();
        let multi =
            self.build_multi_key_script(self.covenant_keys.clone(), self.covenant_threshold, false);

        let mut concated = vec![];
        concated.extend(single.to_bytes());
        concated.extend(multi.to_bytes());

        bitcoin::script::Builder::from(concated).into_script()
    }

    pub fn build_single_key_script(
        &self,
        pk: Vec<u8>,
        with_verify: bool,
    ) -> Result<ScriptBuf, String> {
        if pk.len() != PK_LENGTH as usize {
            return Err("Invalid key length".to_string());
        };

        let mut script = script::Builder::new();

        if with_verify {
            script = script.push_slice::<&PushBytes>(pk.as_slice().try_into().unwrap());
            script = script.push_opcode(opcodes::all::OP_CHECKSIGVERIFY);
            Ok(script.into_script())
        } else {
            script = script.push_slice::<&PushBytes>(pk.as_slice().try_into().unwrap());
            script = script.push_opcode(opcodes::all::OP_CHECKSIG);
            Ok(script.into_script())
        }
    }

    pub fn build_multi_key_script(
        &self,
        pks: Vec<Vec<u8>>,
        threshold: u64,
        with_verify: bool,
    ) -> ScriptBuf {
        // Verify that pks is not empty
        if pks.is_empty() {
            panic!("No keys provided");
        }
        // Check buffer object have expected lengths like checking pks.length
        if pks.iter().any(|pk| pk.len() != PK_LENGTH as usize) {
            panic!("Invalid key length");
        }
        // Verify that threshold <= len(pks)
        if threshold > pks.len() as u64 {
            panic!("Required number of valid signers is greater than number of provided keys");
        }
        // if pks.len() == 1 {
        //     return self.build_single_key_script(pks[0].clone(), with_verify);
        // }
        // keys must be sorted
        let mut sorted_pks = pks.clone();
        sorted_pks.sort_by(|a, b| a.cmp(b));
        // verify there are no duplicates
        for i in 0..sorted_pks.len() - 1 {
            if sorted_pks[i] == sorted_pks[i + 1] {
                panic!("Duplicate keys provided");
            }
        }

        let mut script = Builder::new();

        script =
            script.push_slice::<&PushBytes>(sorted_pks[0].clone().as_slice().try_into().unwrap());
        script = script.push_opcode(opcodes::all::OP_CHECKSIG);

        for i in 1..sorted_pks.len() {
            script = script
                .push_slice::<&PushBytes>(sorted_pks[i].clone().as_slice().try_into().unwrap());
            script = script.push_opcode(opcodes::all::OP_CHECKSIGADD);
        }
        script = script.push_int(threshold as i64);
        if with_verify {
            script = script.push_opcode(opcodes::all::OP_NUMEQUALVERIFY);
        } else {
            script = script.push_opcode(opcodes::all::OP_NUMEQUAL);
        }
        script.into_script()
    }

    /**
     * Builds a data embed script for staking in the form:
     *    OP_RETURN || <serializedStakingData>
     * where serializedStakingData is the concatenation of:
     *    MagicBytes || Version || StakerPublicKey || FinalityProviderPublicKey || StakingTimeLock
     * Note: Only a single finality provider key is supported for now in phase 1
     * @throws {Error} If the number of finality provider keys is not equal to 1.
     * @returns {Buffer} The compiled data embed script.
     */
    pub fn build_data_embed_script(&self) -> Result<ScriptBuf, String> {
        if self.finality_provider_keys.len() != 1 {
            return Err("Only a single finality provider key is supported".to_string());
        }

        let version = 0u8;
        let staking_time_lock = self.staking_time_lock as u16;
        let mut serialized_staking_data = vec![];
        serialized_staking_data.extend(self.magic_bytes.clone());
        serialized_staking_data.push(version);
        serialized_staking_data.extend(self.staker_key.clone());
        serialized_staking_data.extend(self.finality_provider_keys[0].clone());
        serialized_staking_data.extend(staking_time_lock.to_be_bytes().to_vec());

        let s = Builder::new()
            .push_opcode(opcodes::all::OP_RETURN)
            .push_slice::<&PushBytes>(serialized_staking_data.as_slice().try_into().unwrap())
            .into_script();
        Ok(s)
    }
}

#[cfg(test)]
mod test {
    use crate::babylon::BabylonStakingScript;
    use http_body_util::{BodyExt, Empty};
    use hyper::body::Bytes;
    use hyper_tls::HttpsConnector;
    use hyper_util::{client::legacy::Client, rt::TokioExecutor};
    use ic_stable_structures::Storable;
    use serde::Deserialize;
    use std::str::FromStr;

    #[derive(Deserialize, Debug)]
    struct JsonResponse<T> {
        error: Option<JsonError>,
        id: usize,
        result: Option<T>,
    }

    #[derive(Deserialize, Debug)]
    struct JsonError {
        code: i32,
        message: String,
    }

    #[test]
    pub fn invalid_script_data() {
        let pk1: Vec<u8> =
            hex::decode("6f13a6d104446520d1757caec13eaf6fbcf29f488c31e0107e7351d4994cd068")
                .unwrap();
        let pk2: Vec<u8> =
            hex::decode("f5199efae3f28bb82476163a7e458c7ad445d9bffb0682d10d3bdb2cb41f8e8e")
                .unwrap();
        let pk3: Vec<u8> =
            hex::decode("17921cf156ccb4e73d428f996ed11b245313e37e27c978ac4d2cc21eca4672e4")
                .unwrap();
        let pk4: Vec<u8> =
            hex::decode("76d1ae01f8fb6bf30108731c884cddcf57ef6eef2d9d9559e130894e0e40c62c")
                .unwrap();
        let pk5: Vec<u8> =
            hex::decode("49766ccd9e3cd94343e2040474a77fb37cdfd30530d05f9f1e96ae1e2102c86e")
                .unwrap();
        let pk6: Vec<u8> =
            hex::decode("063deb187a4bf11c114cf825a4726e4c2c35fea5c4c44a20ff08a30a752ec7e0")
                .unwrap();
        let invalid_pk: Vec<u8> =
            hex::decode("6f13a6d104446520d1757caec13eaf6fbcf29f488c31e0107e7351d4994cd0").unwrap();
        let staking_time_lock: u64 = 65535;
        let unbonding_time_lock: u64 = 1000;
        let magic_bytes: Vec<u8> = hex::decode("62626234").unwrap();
        let staking_script_with_invalid_pk = BabylonStakingScript {
            staker_key: invalid_pk.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };
        assert_eq!(staking_script_with_invalid_pk.validate(), false);

        let staking_script_with_invalid_provider_pk = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone(), invalid_pk.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };
        assert_eq!(staking_script_with_invalid_provider_pk.validate(), false);

        let cant_build_script_with_finality_providers_more_than_1 = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone(), pk6.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };

        assert_eq!(
            cant_build_script_with_finality_providers_more_than_1
                .build_data_embed_script()
                .is_err(),
            true
        );

        let invalid_convenant_pk = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone(), pk3.clone()],
            covenant_keys: vec![pk3.clone(), invalid_pk.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };

        assert_eq!(invalid_convenant_pk.validate(), false);

        let invalid_zero_covenant_threshold = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 0,
            staking_time_lock,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };

        assert_eq!(invalid_zero_covenant_threshold.validate(), false);

        let invalid_more_covenant_threshold = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 4,
            staking_time_lock,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };

        assert_eq!(invalid_more_covenant_threshold.validate(), false);

        let invalid_zero_time_lock = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock: 0,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };

        assert_eq!(invalid_zero_time_lock.validate(), false);

        let invalid_over_time_lock = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock: 65536,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };

        assert_eq!(invalid_over_time_lock.validate(), false);

        let invalid_zero_time_lock_unbounding = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock,
            unbonding_time_lock: 0,
            magic_bytes: magic_bytes.clone(),
        };

        assert_eq!(invalid_zero_time_lock_unbounding.validate(), false);

        let invalid_over_time_lock_unbounding = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock,
            unbonding_time_lock: 65536,
            magic_bytes: magic_bytes.clone(),
        };

        assert_eq!(invalid_over_time_lock_unbounding.validate(), false);

        let staker_key_is_in_covenant = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk1.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };

        assert_eq!(staker_key_is_in_covenant.validate(), false);

        let magic_bytes_is_not_correct = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk1.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock,
            unbonding_time_lock,
            magic_bytes: vec![0, 0, 0, 0, 0],
        };

        assert_eq!(magic_bytes_is_not_correct.validate(), false);

        let valid_input_data = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };
        assert_eq!(valid_input_data.validate(), true);

        let staking_timelock_script = valid_input_data.build_staking_timelock_script();
        assert_eq!(
            staking_timelock_script.to_hex_string(),
            "206f13a6d104446520d1757caec13eaf6fbcf29f488c31e0107e7351d4994cd068ad03ffff00b2"
                .to_string()
        );

        let unbounding_timelock_script = valid_input_data.build_unbounding_timelock_script();
        assert_eq!(
            unbounding_timelock_script.to_hex_string(),
            "206f13a6d104446520d1757caec13eaf6fbcf29f488c31e0107e7351d4994cd068ad02e803b2"
                .to_string()
        );

        let should_build_unbounding_script = BabylonStakingScript {
            staker_key: pk1.clone(),
            finality_provider_keys: vec![pk2.clone()],
            covenant_keys: vec![pk3.clone(), pk4.clone(), pk5.clone()],
            covenant_threshold: 2,
            staking_time_lock,
            unbonding_time_lock,
            magic_bytes: magic_bytes.clone(),
        };

        assert_eq!(should_build_unbounding_script.build_unbounding_script().to_hex_string(),"206f13a6d104446520d1757caec13eaf6fbcf29f488c31e0107e7351d4994cd068ad2017921cf156ccb4e73d428f996ed11b245313e37e27c978ac4d2cc21eca4672e4ac2049766ccd9e3cd94343e2040474a77fb37cdfd30530d05f9f1e96ae1e2102c86eba2076d1ae01f8fb6bf30108731c884cddcf57ef6eef2d9d9559e130894e0e40c62cba529c".to_string())
    }

    #[test]
    pub fn decode_op_return() {
        let hex="6a47626274340012891845c36530ec3eba196f9de3d029b5ea2c029dddeb38f76fd575d6600f0088b32b005d5b7e29e6f82998aff023bff7b600c6a1a74ffac984b3aa0579b384fa00".to_string();
        let script = hex::decode(hex).unwrap();
        let binding = script.clone();

        let _script = bitcoin::Script::from_bytes(binding.as_slice());

        println!("{:?}", _script.to_asm_string());

        let hex_2 = "626274340012891845c36530ec3eba196f9de3d029b5ea2c029dddeb38f76fd575d6600f0088b32b005d5b7e29e6f82998aff023bff7b600c6a1a74ffac984b3aa0579b384fa00";
        let script_2 = hex::decode(hex_2).unwrap();
        let binding_2 = script_2.clone();

        let magic = binding_2[0..4].to_vec();
        let version = binding_2[4].to_bytes().to_vec();
        let staker = binding_2[5..37].to_vec();
        let finality = binding_2[37..69].to_vec();
        let lock_time = binding_2[69..71].to_vec();

        println!("magic {:?}", magic);
        println!("version {:?}", version);
        println!("staker {:?}, length {:?}", staker, staker.len());
        println!("finality {:?}, length {:?}", finality, finality.len());
        println!("lock_time {:?}, length {:?}", lock_time, lock_time.len());
        println!("total_length {:?}", binding_2.len());
    }

    #[tokio::test]
    async fn get_global_params() {
        #[derive(Deserialize, Debug)]
        struct GlobalParamsVersion {
            version: u64,
            activation_height: u64,
            staking_cap: u64,
            tag: String,
            covenant_pks: Vec<String>,
            covenant_quorum: u64,
            unbonding_time: u64,
            unbonding_fee: u64,
            max_staking_amount: u64,
            min_staking_amount: u64,
            max_staking_time: u64,
            min_staking_time: u64,
            confirmation_depth: u64,
        }

        #[derive(Deserialize, Debug)]
        pub struct GlobalResponse {
            data: Data,
        }

        #[derive(Deserialize, Debug)]
        pub struct Data {
            versions: Vec<GlobalParamsVersion>,
        }

        let endpoint = "/v1/global-params";
        let next_public_api_url = "https://staking-api.testnet.babylonchain.io";
        let url = format!("{}{}", next_public_api_url, endpoint);

        println!("url: {:?}", url);

        let https = HttpsConnector::new();
        let client = Client::builder(TokioExecutor::new()).build::<_, Empty<Bytes>>(https);

        let mut response = client.get(url.as_str().parse().unwrap()).await.unwrap();

        let mut response_bytes = vec![];

        while let Some(next) = response.frame().await {
            let frame = next.unwrap();
            if let Some(chunk) = frame.data_ref() {
                println!("response_bytes: {:?}", chunk);
                response_bytes.extend(chunk.to_vec())
            }
        }

        let res_json: GlobalResponse = serde_json::from_slice(response_bytes.as_slice()).unwrap();
        println!("res_json :{:?}", res_json);
    }
}
