use candid::{CandidType, Principal};
use ic_cdk::api::management_canister::ecdsa::{
    ecdsa_public_key, sign_with_ecdsa, EcdsaCurve, EcdsaKeyId, EcdsaPublicKeyArgument,
    SignWithEcdsaArgument,
};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Debug)]
pub struct PublicKeyReply {
    pub public_key_hex: String,
}

#[derive(CandidType, Serialize, Debug)]
pub struct SignatureReply {
    pub signature_hex: String,
}

#[derive(CandidType, Serialize, Debug)]
pub struct SignatureVerificationReply {
    pub is_signature_valid: bool,
}

pub async fn public_key(
    canister_id: Option<Principal>,
    derivation_path_bytes: Vec<u8>,
    key: EcdsaKeyIds,
) -> Result<PublicKeyReply, String> {
    let request = EcdsaPublicKeyArgument {
        canister_id,
        derivation_path: vec![derivation_path_bytes],
        key_id: key.to_key_id(),
    };

    let (response,) = ecdsa_public_key(request)
        .await
        .map_err(|e| format!("ecdsa_public_key failed {}", e.1))?;

    Ok(PublicKeyReply {
        public_key_hex: hex::encode(response.public_key),
    })
}

pub async fn sign(
    message: String,
    derivation_path_bytes: Vec<u8>,
    key: EcdsaKeyIds,
) -> Result<SignatureReply, String> {
    let request = SignWithEcdsaArgument {
        message_hash: sha256(&message).to_vec(),
        derivation_path: vec![derivation_path_bytes],
        key_id: key.to_key_id(),
    };

    let (response,) = sign_with_ecdsa(request)
        .await
        .map_err(|e| format!("sign_with_ecdsa failed {}", e.1))?;

    Ok(SignatureReply {
        signature_hex: hex::encode(response.signature),
    })
}

pub async fn sign_pre_hash(
    message_hash: Vec<u8>,
    derivation_path_bytes: Vec<u8>,
    key: EcdsaKeyIds,
) -> Result<SignatureReply, String> {
    let request = SignWithEcdsaArgument {
        message_hash,
        derivation_path: vec![derivation_path_bytes],
        key_id: key.to_key_id(),
    };

    let (response,) = sign_with_ecdsa(request)
        .await
        .map_err(|e| format!("sign_with_ecdsa failed {}", e.1))?;

    Ok(SignatureReply {
        signature_hex: hex::encode(response.signature),
    })
}

//
// pub async fn verify(
//     signature_hex: String,
//     message: String,
//     public_key_hex: String,
// ) -> Result<SignatureVerificationReply, String> {
//     let signature_bytes = hex::decode(signature_hex).expect("failed to hex-decode signature");
//     let pubkey_bytes = hex::decode(public_key_hex).expect("failed to hex-decode public key");
//     let message_bytes = message.as_bytes();
//
//     use k256::ecdsa::signature::Verifier;
//     let signature = k256::ecdsa::Signature::try_from(signature_bytes.as_slice())
//         .expect("failed to deserialize signature");
//     let is_signature_valid = k256::ecdsa::VerifyingKey::from_sec1_bytes(&pubkey_bytes)
//         .expect("failed to deserialize sec1 encoding into public key")
//         .verify(message_bytes, &signature)
//         .is_ok();
//
//     Ok(SignatureVerificationReply { is_signature_valid })
// }

pub fn sha256(input: &String) -> [u8; 32] {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(input.as_bytes());
    hasher.finalize().into()
}

#[derive(CandidType, Clone, Serialize, Deserialize)]
pub enum EcdsaKeyIds {
    #[allow(unused)]
    TestKeyLocalDevelopment,
    #[allow(unused)]
    TestKey1,
    #[allow(unused)]
    ProductionKey1,
}

impl EcdsaKeyIds {
    pub fn to_key_id(&self) -> EcdsaKeyId {
        EcdsaKeyId {
            curve: EcdsaCurve::Secp256k1,
            name: match self {
                Self::TestKeyLocalDevelopment => "dfx_test_key",
                Self::TestKey1 => "test_key_1",
                Self::ProductionKey1 => "key_1",
            }
            .to_string(),
        }
    }
    pub fn from_str(s: &str) -> EcdsaKeyIds {
        match s {
            "dfx_test_key" => EcdsaKeyIds::TestKeyLocalDevelopment,
            "test_key_1" => EcdsaKeyIds::TestKey1,
            "key_1" => EcdsaKeyIds::ProductionKey1,
            _ => panic!("Invalid EcdsaKeyId"),
        }
    }
}
