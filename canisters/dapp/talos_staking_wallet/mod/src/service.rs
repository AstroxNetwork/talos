use std::collections::BTreeMap;

use bitcoin::ecdsa::Signature;
use bitcoin::key::{Secp256k1, XOnlyPublicKey};
use bitcoin::psbt::Psbt;
use bitcoin::script::PushBytes;
use bitcoin::secp256k1::ThirtyTwoByteHash;
use bitcoin::sighash::{EcdsaSighashType, SighashCache};
use bitcoin::{consensus, script, secp256k1, Network, PublicKey, Witness};
use candid::Principal;
use ic_stable_structures::Storable;

use ic_tss::ecdsa::{sign_pre_hash, EcdsaKeyIds};
use ic_tss::schnorr::{SchnorrAlgorithm, SchnorrKeyIds};
use talos_types::types::{StakingTarget, StakingWallet, StakingWalletCreateReq};

use crate::core_dao::{CoreDao, CoreOption};
use crate::memory::{TXS, WALLETS};
use crate::types::{SignedTx, TxDetail, TxID, TxState, TxType};
use crate::utils::{get_script_from_address, vec_to_u832, AddressInfo};

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

        let (stake_address, pub_key_hex) = match stake_target {
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
            pub_key_hex,
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

    pub async fn create_and_sign_core_dao_tx(
        wallet_id: String,
        stake_amount: u64,
        txid: String,
        vout: u32,
        value: u64,
        stake_lock_time: u32,
        key_string: String,
        export_psbt: bool,
    ) -> Result<(SignedTx, SignedTx), String> {
        let wallet = Self::get_staking_wallet(wallet_id.clone())
            .map_or_else(|| Err("Wallet not found".to_string()), |v| Ok(v))?;

        let AddressInfo {
            network,
            script_buf,
            ..
        } = get_script_from_address(wallet.stake_address.clone())?;

        let option = CoreOption {
            version: 1,
            chain_id: 1,
            delegator: vec![0; 20],
            validator: vec![0; 20],
            fee: 1,
            pub_key: wallet.pub_key_hex.clone(),
            lock_time: stake_lock_time.clone(),
            network,
        };

        let mut core_dao = CoreDao::new(option.clone());

        // lock tx

        let psbt =
            core_dao.create_lock_tx(stake_amount.clone(), script_buf, txid.clone(), vout, value)?;
        let res = sign_segwit0_tx(
            psbt,
            wallet.pub_key_hex.clone(),
            key_string.clone(),
            wallet.bytes,
            export_psbt,
        )
        .await
        .map_err(|e| e.to_string())?;

        let tx_detail = TxDetail {
            tx_type: TxType::Lock,
            txid: res.txid.clone(),
            tx_bytes: hex::decode(res.tx_hex.clone()).unwrap(),
            tx_state: TxState::Stashed,
            wallet_id: wallet_id.clone(),
            lock_time: stake_lock_time.clone(),
        };

        TXS.with(|t| {
            t.borrow_mut()
                .insert(tx_detail.get_txid(), tx_detail.clone())
        });

        // unlock tx
        let psbt_unlock = core_dao.create_unlock_tx(
            txid.clone(),
            vout + 1,
            stake_lock_time.clone(),
            stake_amount.clone(),
            stake_amount.clone() - 300,
            wallet.stake_address.clone(),
        )?;
        let res_unlock = sign_segwit0_tx_unlock(
            psbt_unlock,
            wallet.pub_key_hex.clone(),
            key_string.clone(),
            wallet.bytes,
            export_psbt,
        )
        .await
        .map_err(|e| e.to_string())?;

        let tx_detail_unlock = TxDetail {
            tx_type: TxType::Withdraw,
            txid: res_unlock.txid.clone(),
            tx_bytes: hex::decode(res_unlock.tx_hex.clone()).unwrap(),
            tx_state: TxState::Stashed,
            wallet_id: wallet_id.clone(),
            lock_time: stake_lock_time.clone(),
        };

        TXS.with(|t| {
            t.borrow_mut()
                .insert(tx_detail_unlock.get_txid(), tx_detail_unlock.clone())
        });

        Ok((res.clone(), res_unlock.clone()))
    }

    pub async fn create_and_sign_core_dao_tx_unlock(
        wallet_id: String,
        stake_amount: u64,
        txid: String,
        vout: u32,
        value: u64,
        stake_lock_time: u32,
        key_string: String,
        export_psbt: bool,
    ) -> Result<SignedTx, String> {
        let wallet = Self::get_staking_wallet(wallet_id.clone())
            .map_or_else(|| Err("Wallet not found".to_string()), |v| Ok(v))?;

        let AddressInfo {
            network,
            script_buf,
            ..
        } = get_script_from_address(wallet.stake_address.clone())?;

        let option = CoreOption {
            version: 1,
            chain_id: 1,
            delegator: vec![0; 20],
            validator: vec![0; 20],
            fee: 1,
            pub_key: wallet.pub_key_hex.clone(),
            lock_time: stake_lock_time.clone(),
            network,
        };

        let mut core_dao = CoreDao::new(option.clone());

        // lock tx

        // unlock tx
        let psbt_unlock = core_dao.create_unlock_tx(
            txid.clone(),
            vout,
            stake_lock_time.clone(),
            stake_amount.clone(),
            value.clone(), // should calculate it
            wallet.stake_address.clone(),
        )?;
        let res_unlock = sign_segwit0_tx_unlock(
            psbt_unlock,
            wallet.pub_key_hex.clone(),
            key_string.clone(),
            wallet.bytes,
            export_psbt,
        )
        .await
        .map_err(|e| e.to_string())?;

        let tx_detail_unlock = TxDetail {
            tx_type: TxType::Withdraw,
            txid: res_unlock.txid.clone(),
            tx_bytes: hex::decode(res_unlock.tx_hex.clone()).unwrap(),
            tx_state: TxState::Stashed,
            wallet_id: wallet_id.clone(),
            lock_time: stake_lock_time.clone(),
        };

        TXS.with(|t| {
            t.borrow_mut()
                .insert(tx_detail_unlock.get_txid(), tx_detail_unlock.clone())
        });

        Ok(res_unlock.clone())
    }

    pub fn get_tx_detail(txid: TxID) -> Option<TxDetail> {
        TXS.with(|t| t.borrow().get(&txid))
    }

    pub fn get_txs_by_state(tx_state: TxState) -> Vec<TxDetail> {
        TXS.with(|t| {
            t.borrow()
                .iter()
                .filter(|(_, v)| v.tx_state == tx_state)
                .map(|(_, v)| v.clone())
                .collect()
        })
    }
    pub fn get_txs_by_wallet_id(wallet_id: String) -> Vec<TxDetail> {
        TXS.with(|t| {
            t.borrow()
                .iter()
                .filter(|(_, v)| v.wallet_id == wallet_id)
                .map(|(_, v)| v.clone())
                .collect()
        })
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
) -> Result<(String, String), String> {
    let pubkey = ic_tss::ecdsa::public_key(
        canister_id.into(),
        bytes.to_vec(),
        EcdsaKeyIds::from_str(&key_string),
    )
    .await?;
    let pubkey_hex = hex::decode(pubkey.public_key_hex).map_err(|e| e.to_string())?;
    assert_eq!(pubkey_hex.len(), 33);
    let mut pub_key_hex = [0u8; 33]; //should be 33 bytes length
    pub_key_hex.copy_from_slice(&pubkey_hex);
    let pk = PublicKey::from_slice(&pubkey_hex).map_err(|e| e.to_string())?;

    let address = bitcoin::Address::p2wpkh(&pk, network).map_err(|e| e.to_string())?;
    Ok((address.to_string(), hex::encode(pub_key_hex)))
}

pub async fn get_p2tr_address_from_tss(
    bytes: [u8; 32],
    canister_id: Principal,
    key_string: String,
    network: Network,
) -> Result<(String, String), String> {
    let pubkey = ic_tss::schnorr::public_key(
        SchnorrAlgorithm::Bip340Secp256k1,
        canister_id.into(),
        bytes.to_vec(),
        SchnorrKeyIds::from_str(&key_string),
    )
    .await?;
    let pubkey_hex = hex::decode(pubkey.public_key_hex).map_err(|e| e.to_string())?;
    assert_eq!(pubkey_hex.len(), 33);
    let mut pub_key_hex = [0u8; 33]; //should be 33 bytes length
    pub_key_hex.copy_from_slice(&pubkey_hex);
    let pk = PublicKey::from_slice(&pubkey_hex).map_err(|e| e.to_string())?;
    let secp = Secp256k1::verification_only();
    let xonly_pubkey = XOnlyPublicKey::from(pk.inner);
    Ok((
        bitcoin::Address::p2tr(&secp, xonly_pubkey, None, network).to_string(),
        hex::encode(pub_key_hex),
    ))
}

pub async fn sign_segwit0_tx(
    mut psbt_to_sign: Psbt,
    pub_key_hex: String,
    key_string: String,
    key_bytes: [u8; 32],
    psbt_b64: bool,
) -> Result<SignedTx, String> {
    let mut cache = SighashCache::new(&psbt_to_sign.unsigned_tx);
    let mut err = None;

    let pubkey = PublicKey::from_slice(
        &hex::decode(pub_key_hex).map_err(|_| "pubkey is not correct".to_string())?,
    )
    .map_err(|v| v.to_string())?;

    for (i, input) in psbt_to_sign.inputs.iter_mut().enumerate() {
        if input.witness_utxo.is_none() {
            err = Some("witness_utxo is not present".to_string());
            continue;
        }
        let value = input.clone().witness_utxo.unwrap().value;
        let output_script = input.clone().witness_utxo.unwrap().script_pubkey;
        match output_script.p2wpkh_script_code() {
            Some(code) => match cache.segwit_signature_hash(i, &code, value, EcdsaSighashType::All)
            {
                Ok(sighash) => {
                    let message = sighash.into_32().to_vec();
                    #[allow(unused_assignments)]
                    let mut signature = None;
                    match sign_pre_hash(
                        message,
                        key_bytes.to_vec(),
                        EcdsaKeyIds::from_str(&key_string),
                    )
                    .await
                    {
                        Ok(r) => signature = Some(r.signature_hex),
                        Err(_) => {
                            err = Some("Failed to sign".to_string());
                            continue;
                        }
                    };
                    if signature.is_none() {
                        continue;
                    } else {
                        let sig = hex::decode(signature.clone().unwrap())
                            .map_err(|_| "cannot decode signature".to_string())?;

                        let ecdsa_sig = secp256k1::ecdsa::Signature::from_compact(sig.as_slice())
                            .map_err(|e| {
                            format!(
                                "Failed to parse compact signature {:?}, reason: {:?}",
                                signature.clone().unwrap(),
                                e.to_string()
                            )
                        })?;

                        let signature = Signature {
                            sig: ecdsa_sig,
                            hash_ty: EcdsaSighashType::All,
                        };

                        let mut witness = Witness::new();
                        witness.push(&signature.serialize());
                        witness.push(&pubkey.to_bytes());
                        input.final_script_witness = Some(witness);
                        input.partial_sigs.insert(pubkey, signature);
                    }
                }
                Err(_) => {
                    err = Some("Failed to construct message".to_string());
                }
            },
            None => {
                err = Some("Output script is not correct".to_string());
            }
        }
        if psbt_b64 == false {
            input.partial_sigs = BTreeMap::new();
            input.sighash_type = None;
            input.redeem_script = None;
            input.witness_script = None;
            input.bip32_derivation = BTreeMap::new();
        }
    }
    let signed_tx = psbt_to_sign.clone().extract_tx();
    let serialized_signed_tx = consensus::encode::serialize_hex(&signed_tx);
    let mut _psbt = None;
    if psbt_b64 == true {
        _psbt = Some(psbt_to_sign.clone().to_string());
    }
    return match err {
        Some(e) => Err(e),
        None => Ok(SignedTx {
            tx_hex: serialized_signed_tx,
            psbt_b64: _psbt,
            txid: signed_tx.txid().to_string(),
        }),
    };
}

pub async fn sign_segwit0_tx_unlock(
    mut psbt_to_sign: Psbt,
    pub_key_hex: String,
    key_string: String,
    key_bytes: [u8; 32],
    psbt_b64: bool,
) -> Result<SignedTx, String> {
    let mut cache = SighashCache::new(&psbt_to_sign.unsigned_tx);
    let mut err = None;

    let pubkey = PublicKey::from_slice(
        &hex::decode(pub_key_hex).map_err(|_| "pubkey is not correct".to_string())?,
    )
    .map_err(|v| v.to_string())?;

    for (i, input) in psbt_to_sign.inputs.iter_mut().enumerate() {
        if input.witness_utxo.is_none() {
            err = Some("unlock witness_utxo is not present".to_string());
            continue;
        }
        let value = input.clone().witness_utxo.unwrap().value;
        let output_script = input.clone().witness_script.unwrap();
        match cache.segwit_signature_hash(i, &output_script, value, EcdsaSighashType::All) {
            Ok(sighash) => {
                let message = sighash.into_32().to_vec();
                #[allow(unused_assignments)]
                let mut signature = None;
                match sign_pre_hash(
                    message.clone(),
                    key_bytes.to_vec(),
                    EcdsaKeyIds::from_str(&key_string),
                )
                .await
                {
                    Ok(r) => signature = Some(r.signature_hex),
                    Err(_) => {
                        err = Some("Failed to sign unlock".to_string());
                        continue;
                    }
                };
                if signature.is_none() {
                    continue;
                } else {
                    let sig = hex::decode(signature.clone().unwrap())
                        .map_err(|_| "cannot decode unlock signature".to_string())?;

                    let ecdsa_sig = secp256k1::ecdsa::Signature::from_compact(sig.as_slice())
                        .map_err(|e| {
                            format!(
                                "Failed to parse unlock compact signature {:?}, reason: {:?}",
                                signature.clone().unwrap(),
                                e.to_string()
                            )
                        })?;

                    let signature = Signature {
                        sig: ecdsa_sig,
                        hash_ty: EcdsaSighashType::All,
                    };

                    let witness = {
                        let mut script_witness = Witness::new();
                        script_witness.push(signature.serialize());
                        script_witness.push(&pubkey.to_bytes());
                        script_witness.push(input.witness_script.clone().unwrap().as_bytes());
                        script_witness
                    };
                    input.final_script_witness = Some(witness);
                    input.partial_sigs.insert(pubkey, signature);
                }
            }
            Err(_) => {
                err = Some("Failed to construct unlock message".to_string());
            }
        };
        if psbt_b64 == false {
            input.partial_sigs = BTreeMap::new();
            input.sighash_type = None;
            input.redeem_script = None;
            input.witness_script = None;
            input.bip32_derivation = BTreeMap::new();
        }
    }
    let signed_tx = psbt_to_sign.clone().extract_tx();
    let serialized_signed_tx = consensus::encode::serialize_hex(&signed_tx);
    let mut _psbt = None;
    if psbt_b64 == true {
        _psbt = Some(psbt_to_sign.clone().to_string());
    }
    return match err {
        Some(e) => Err(e),
        None => Ok(SignedTx {
            tx_hex: serialized_signed_tx,
            psbt_b64: _psbt,
            txid: signed_tx.txid().to_string(),
        }),
    };
}
