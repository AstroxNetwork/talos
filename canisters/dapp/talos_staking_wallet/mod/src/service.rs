use crate::memory::WALLETS;
use crate::utils::{get_script_from_address, vec_to_u832, AddressInfo};
use bitcoin::key::{Secp256k1, XOnlyPublicKey};
use bitcoin::{Network, Script};
use candid::Principal;
use ic_stable_structures::Storable;
use ic_tss::ecdsa::EcdsaKeyIds;
use ic_tss::schnorr::{SchnorrAlgorithm, SchnorrKeyIds};
use talos_types::types::{StakingTarget, StakingWallet, StakingWalletCreateReq};

pub struct WalletService {}

impl WalletService {
    pub async fn create_staking_wallet(
        req: StakingWalletCreateReq,
    ) -> Result<StakingWallet, String> {
        let user_principal = req.user_principal;
        let order_id = req.order_id;
        let stake_target = req.stake_target;
        let bytes = create_bytes(stake_target.clone(), order_id, user_principal.clone());
        let AddressInfo { network, .. } = get_script_from_address(req.user_btc_address.clone())?;

        let found = Self::get_staking_wallet(hex::encode(bytes));
        if found.is_some() {
            return Ok(found.unwrap());
        }

        let stake_address = match stake_target {
            StakingTarget::Babylon => {
                get_p2tr_address_from_tss(bytes, ic_cdk::id(), req.key, network.clone()).await?
            }
            StakingTarget::CoreDao => {
                get_p2wsh_address_from_tss(bytes, ic_cdk::id(), req.key, network.clone()).await?
            }
        };

        let wallet = StakingWallet {
            user_principal: user_principal.clone(),
            user_btc_address: req.user_btc_address.clone(),
            stake_target: stake_target.clone(),
            stake_address,
            bytes,
        };

        WALLETS.with(|w| w.borrow_mut().insert(bytes, wallet.clone()));
        Ok(wallet.clone())
    }

    pub fn get_staking_wallet(bytes: String) -> Option<StakingWallet> {
        let v = hex::decode(bytes).map_err(|e| e.to_string()).ok()?;
        let _bytes = vec_to_u832(v).ok()?;
        WALLETS.with(|w| w.borrow().get(&_bytes))
    }

    pub fn get_staking_wallet_by_user_principal(principal: Principal) -> Vec<StakingWallet> {
        WALLETS.with(|w| {
            w.borrow()
                .iter()
                .filter(|(_, v)| v.user_principal == principal)
                .map(|(_, v)| v.clone())
                .collect()
        })
    }
    pub fn get_staking_wallet_by_user_btc_wallet(user_btc_address: String) -> Vec<StakingWallet> {
        WALLETS.with(|w| {
            w.borrow()
                .iter()
                .filter(|(_, v)| v.user_btc_address == user_btc_address)
                .map(|(_, v)| v.clone())
                .collect()
        })
    }

    pub fn remove_staking_wallet(bytes: String) -> Option<StakingWallet> {
        let v = hex::decode(bytes).map_err(|e| e.to_string()).ok()?;
        let _bytes = vec_to_u832(v).ok()?;
        WALLETS.with(|w| w.borrow_mut().remove(&_bytes))
    }

    pub fn update_staking_wallet(wallet: StakingWallet) -> Result<(), String> {
        let _bytes = vec_to_u832(wallet.bytes.to_vec())?;
        let found = Self::get_staking_wallet(hex::encode(_bytes.clone()));
        if found.is_none() {
            return Err("Wallet not found".to_string());
        }
        WALLETS.with(|w| w.borrow_mut().insert(_bytes.clone(), wallet.clone()));
        Ok(())
    }
}

pub fn create_bytes(stake_target: StakingTarget, order_id: [u8; 4], user: Principal) -> [u8; 32] {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    let principal_bytes = user.as_slice().to_vec();
    let target_bytes = match stake_target {
        StakingTarget::Babylon => vec![0x00],
        StakingTarget::CoreDao => vec![0x01],
    };
    let order_id_bytes = order_id.to_vec();
    let mut deriviation_bytes = Vec::new();
    deriviation_bytes.extend_from_slice(order_id_bytes.as_slice());
    deriviation_bytes.extend_from_slice(target_bytes.as_slice());
    deriviation_bytes.extend_from_slice(principal_bytes.as_slice());
    hasher.update(deriviation_bytes.to_bytes().to_vec());
    hasher.finalize().into()
}

pub async fn get_p2wsh_address_from_tss(
    bytes: [u8; 32],
    canister_id: Principal,
    key_string: String,
    network: Network,
) -> Result<String, String> {
    let pubkey = ic_tss::ecdsa::public_key(
        canister_id.into(),
        bytes.to_vec(),
        EcdsaKeyIds::from_str(&key_string),
    )
    .await?;
    let pubkey_hex = hex::decode(pubkey.public_key_hex).map_err(|e| e.to_string())?;
    let pk = bitcoin::key::PublicKey::from_slice(&pubkey_hex).map_err(|e| e.to_string())?;

    let address = bitcoin::Address::p2wpkh(&pk, network).map_err(|e| e.to_string())?;
    Ok(address.to_string())
}

pub async fn get_p2tr_address_from_tss(
    bytes: [u8; 32],
    canister_id: Principal,
    key_string: String,
    network: Network,
) -> Result<String, String> {
    let pubkey = ic_tss::schnorr::public_key(
        SchnorrAlgorithm::Bip340Secp256k1,
        canister_id.into(),
        bytes.to_vec(),
        SchnorrKeyIds::from_str(&key_string),
    )
    .await?;
    let pubkey_hex = hex::decode(pubkey.public_key_hex).map_err(|e| e.to_string())?; //should be 33 bytes length
    assert_eq!(pubkey_hex.len(), 33);
    let pk = bitcoin::key::PublicKey::from_slice(&pubkey_hex).map_err(|e| e.to_string())?;
    let secp = Secp256k1::verification_only();
    let xonly_pubkey = XOnlyPublicKey::from(pk.inner);
    Ok(bitcoin::Address::p2tr(&secp, xonly_pubkey, None, network).to_string())
}
