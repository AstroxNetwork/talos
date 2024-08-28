use std::collections::BTreeMap;

use bitcoin::ecdsa::Signature;
use bitcoin::key::{Secp256k1, XOnlyPublicKey};
use bitcoin::psbt::Psbt;
use bitcoin::secp256k1::ThirtyTwoByteHash;
use bitcoin::sighash::{EcdsaSighashType, SighashCache};
use bitcoin::{consensus, secp256k1, Network, PublicKey, Witness};
use candid::Principal;
use ic_stable_structures::Storable;

use ic_tss::ecdsa::{sign_pre_hash, EcdsaKeyIds};
use ic_tss::schnorr::{SchnorrAlgorithm, SchnorrKeyIds};
use talos_types::types::{StakeParams, StakingTarget, StakingWallet, StakingWalletCreateReq};

use crate::core_dao::{CoreDao, CoreOption};
use crate::memory::{BTREES, TXS, WALLETS};
use crate::types::{
    BtreeKey, BtreeValue, CreateCoreDaoTxRes, SignedTx, TxDetail, TxID, TxState, TxType,
};
use crate::utils::{get_script_from_address, vec_to_u832, AddressInfo};

pub struct WalletService {}

impl WalletService {
    pub fn set_talos(canister: Principal) {
        BTREES.with(|b| {
            b.borrow_mut().insert(
                BtreeKey("talos".to_string()),
                BtreeValue {
                    key: "talos".to_string(),
                    value: canister.as_slice().to_vec(),
                },
            )
        });
    }

    pub fn get_talos() -> Option<Principal> {
        let res = BTREES.with(|b| b.borrow().get(&BtreeKey("talos".to_string())));
        match res {
            Some(v) => {
                let principal = Principal::from_slice(v.value.as_slice());
                Some(principal)
            }
            None => None,
        }
    }
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
            order_id,
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
        reveal_fee: u64,
        txid: String,
        vout: u32,
        value: u64,
        chain_id: u16,
        delegator: String,
        validator: String,
        stake_lock_time: u32,
        key_string: String,
        export_psbt: bool,
    ) -> Result<CreateCoreDaoTxRes, String> {
        let wallet = Self::get_staking_wallet(wallet_id.clone())
            .map_or_else(|| Err("Wallet not found".to_string()), |v| Ok(v))?;

        if Self::get_talos().is_none() {
            return Err("Talos not set".to_string());
        }

        let AddressInfo {
            network,
            script_buf,
            ..
        } = get_script_from_address(wallet.stake_address.clone())?;

        let option = CoreOption {
            version: 1,
            chain_id,
            delegator: hex::decode(delegator.clone()).map_err(|e| e.to_string())?,
            validator: hex::decode(validator.clone()).map_err(|e| e.to_string())?,
            fee: 0,
            pub_key: wallet.pub_key_hex.clone(),
            lock_time: stake_lock_time.clone(),
            network,
        };

        let mut core_dao = CoreDao::new(option.clone());

        // lock tx

        let (psbt, commit_txid) =
            core_dao.create_lock_tx(stake_amount.clone(), script_buf, txid.clone(), vout, value)?;

        let redeem_script = core_dao.get_redeem_script();

        if redeem_script.is_none() {
            return Err("redeem script is not present".to_string());
        }

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
        // let psbt_unlock = core_dao.create_unlock_tx(
        //     commit_txid.clone(),
        //     0,
        //     stake_lock_time.clone(),
        //     stake_amount.clone(),
        //     stake_amount.clone() - reveal_fee.clone(),
        //     wallet.stake_address.clone(),
        // )?;
        // let res_unlock = sign_segwit0_tx_unlock(
        //     psbt_unlock,
        //     wallet.pub_key_hex.clone(),
        //     key_string.clone(),
        //     wallet.bytes,
        //     export_psbt,
        // )
        // .await
        // .map_err(|e| e.to_string())?;
        //
        // let tx_detail_unlock = TxDetail {
        //     tx_type: TxType::Withdraw,
        //     txid: res_unlock.txid.clone(),
        //     tx_bytes: hex::decode(res_unlock.tx_hex.clone()).unwrap(),
        //     tx_state: TxState::Stashed,
        //     wallet_id: wallet_id.clone(),
        //     lock_time: stake_lock_time.clone(),
        // };
        //
        // TXS.with(|t| {
        //     t.borrow_mut()
        //         .insert(tx_detail_unlock.get_txid(), tx_detail_unlock.clone())
        // });

        ic_cdk::api::call::notify(
            Self::get_talos().unwrap(),
            "update_btc_order_stake_params",
            (StakeParams {
                order_id: wallet.order_id,
                wallet_id: wallet_id.clone(),
                stake_amount,
                reveal_fee,
                txid: commit_txid,
                vout: 0,
                value: stake_amount,
                chain_id: chain_id.clone(),
                delegator: delegator.clone(),
                validator: validator.clone(),
                stake_lock_time: stake_lock_time.clone(),
            },),
        )
        .map_err(|_| "Can not notify talos update_btc_order_stake_params".to_string())?;

        Ok(CreateCoreDaoTxRes {
            signed_tx_commit: res,
            // signed_tx_reveal: res_unlock,
            redeem_script: redeem_script.unwrap().clone().to_bytes(),
        })
    }

    pub async fn create_and_sign_core_dao_tx_unlock(
        wallet_id: String,
        stake_amount: u64,
        reveal_fee: u64,
        txid: String,
        vout: u32,
        value: u64,
        chain_id: u16,
        delegator: String,
        validator: String,
        stake_lock_time: u32,
        key_string: String,
        export_psbt: bool,
    ) -> Result<SignedTx, String> {
        let wallet = Self::get_staking_wallet(wallet_id.clone())
            .map_or_else(|| Err("Wallet not found".to_string()), |v| Ok(v))?;

        let AddressInfo { network, .. } = get_script_from_address(wallet.stake_address.clone())?;

        let option = CoreOption {
            version: 1,
            chain_id: chain_id.clone(),
            delegator: hex::decode(delegator).map_err(|e| e.to_string())?,
            validator: hex::decode(validator).map_err(|e| e.to_string())?,
            fee: 0,
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
            value.clone() - reveal_fee,
            wallet.user_btc_address.clone(),
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

    pub fn set_tx_state(txid: TxID, tx_state: TxState) -> Result<TxDetail, String> {
        let tx = Self::get_tx_detail(txid);
        if tx.is_none() {
            Err("Tx not found".to_string())
        } else {
            let mut tx = tx.unwrap();
            tx.tx_state = tx_state;
            TXS.with(|t| {
                t.borrow_mut().insert(txid, tx.clone());
            });
            Ok(tx)
        }
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
    match err {
        Some(e) => Err(e),
        None => Ok(SignedTx {
            tx_hex: serialized_signed_tx,
            psbt_b64: _psbt,
            txid: signed_tx.txid().to_string(),
        }),
    }
}

#[cfg(test)]
mod test {
    use crate::types::SignedTx;
    use crate::utils::{get_script_from_address, AddressInfo};
    use bitcoin::absolute::LockTime;
    use bitcoin::bip32::KeySource;
    use bitcoin::ecdsa::Signature;
    use bitcoin::key::{Secp256k1, TapTweak, XOnlyPublicKey};
    use bitcoin::opcodes::OP_TRUE;
    use bitcoin::psbt::{Psbt, PsbtSighashType};
    use bitcoin::sighash::{EcdsaSighashType, SighashCache, TapSighash, TapSighashType};
    use bitcoin::string::FromHexStr;
    use bitcoin::taproot::{LeafVersion, TapLeafHash, TaprootBuilder};
    use bitcoin::{
        consensus, opcodes, psbt, script, secp256k1, sighash, taproot, Address, PublicKey,
        ScriptBuf, Sequence, TxIn, TxOut, Witness,
    };
    use serde::Serialize;
    use std::collections::BTreeMap;
    use std::str::FromStr;

    #[test]
    pub fn test_composing_script() {
        let staker =
            hex::decode("afee55a2cdcb6c47a593d629b04e13399354d348a3d84ad19310e2b6396e7237")
                .unwrap();

        let xonly = XOnlyPublicKey::from_slice(staker.as_slice()).unwrap();
        let pubkey = bitcoin::PublicKey::from_slice(
            hex::decode("02afee55a2cdcb6c47a593d629b04e13399354d348a3d84ad19310e2b6396e7237")
                .unwrap()
                .as_slice(),
        )
        .unwrap();
        let wpubkey_hash = pubkey.wpubkey_hash().unwrap();

        let script = script::Builder::new()
            .push_opcode(OP_TRUE)
            .push_opcode(opcodes::all::OP_IF)
            .push_x_only_key(&xonly)
            .push_opcode(opcodes::all::OP_CHECKSIG)
            .push_opcode(opcodes::all::OP_ELSE)
            .push_opcode(opcodes::all::OP_HASH160)
            .push_slice(&wpubkey_hash.clone())
            .push_opcode(opcodes::all::OP_EQUALVERIFY)
            .push_opcode(opcodes::all::OP_CHECKSIG)
            .push_opcode(opcodes::all::OP_ENDIF)
            .into_script();

        println!("scriptb {:?}", script.to_hex_string());

        println!("script {:?}", script.to_asm_string());

        let secp = Secp256k1::new();

        let _new_script_buf = script.to_v1_p2tr(&secp, xonly);
        // let _segwit_script_buf = script.to_v0_p2wsh();

        println!(
            "p2tr_address {:?}",
            Address::from_script(&_new_script_buf.clone(), bitcoin::Network::Testnet).unwrap()
        );

        let AddressInfo {
            script_buf: script_output,
            ..
        } = get_script_from_address(
            "tb1pv8cz8vvj2s95pdzeax4x9tkuawr5um49n9er6gd2wf6wthwrh6ysqnkcq9".to_string(),
        )
        .unwrap();
        // let d = r#"{"txid":"f63fb586347d1a90324a4c7655c833adf021b2db6f20e4f1740abda0576b3216","vout":0,"index":0,"value":1798}""#;
        let txin = TxIn {
            previous_output: bitcoin::OutPoint {
                txid: bitcoin::Txid::from_str(
                    "d0c0580bf3d484215d6f346f2f439646d98c8538f91011fc15c4c387b96fdeb6",
                )
                .unwrap(),
                vout: 0,
            },
            script_sig: ScriptBuf::new(),
            sequence: Sequence::from_hex_str("0xfffffffd")
                .map_err(|e| e.to_string())
                .unwrap(),
            witness: Witness::default(),
        };

        let txout = TxOut {
            value: 2300,
            script_pubkey: _new_script_buf.clone(),
        };

        let commit_tx = bitcoin::Transaction {
            version: 1,
            lock_time: LockTime::ZERO,
            input: vec![txin],
            output: vec![txout.clone()],
        };

        let key =
            bitcoin::PrivateKey::from_wif("cVQWacDuqR3jxJP6zzDiC8kw4E1oaWoMahK6kCVjthdC5RZMDeCK")
                .unwrap();

        let mut psbt = Psbt::from_unsigned_tx(commit_tx).unwrap();
        let unsigned_tx = psbt.unsigned_tx.clone();
        let mut input_txouts = vec![TxOut {
            value: 2798,
            script_pubkey: script_output.clone(),
        }];

        psbt.inputs
            .iter_mut()
            .enumerate()
            .try_for_each::<_, Result<(), Box<dyn std::error::Error>>>(|(vout, input)| {
                let mut origins = BTreeMap::new();
                origins.insert(xonly, (vec![], KeySource::default()));
                input.tap_internal_key = Some(xonly);
                input.tap_key_origins = origins;

                let sighash_type = input
                    .sighash_type
                    .and_then(|psbt_sighash_type| psbt_sighash_type.taproot_hash_ty().ok())
                    .unwrap_or(TapSighashType::All);
                let hash = SighashCache::new(&unsigned_tx)
                    .taproot_key_spend_signature_hash(
                        vout,
                        &sighash::Prevouts::All(input_txouts.as_slice()),
                        sighash_type,
                    )
                    .unwrap();

                let (_, (_, derivation_path)) = input
                    .tap_key_origins
                    .get(
                        &input
                            .tap_internal_key
                            .ok_or("internal key missing in PSBT")?,
                    )
                    .ok_or("missing Taproot key origin")?;

                let secret_key = key.inner;
                sign_psbt_taproot(secret_key, xonly, None, input, hash, sighash_type, &secp);
                Ok(())
            })
            .unwrap();
        psbt.inputs.iter_mut().for_each(|input| {
            let mut script_witness: Witness = Witness::new();
            script_witness.push(input.tap_key_sig.unwrap().to_vec());
            input.final_script_witness = Some(script_witness);
            // Clear all the data fields as per the spec.
            input.partial_sigs = BTreeMap::new();
            input.sighash_type = None;
            input.redeem_script = None;
            input.witness_script = None;
            input.bip32_derivation = BTreeMap::new();
        });
        println!("signed psbt {:?}", psbt);
        println!("signed commit_tx psbt bytes {:?}", psbt.to_string());
        let commit_tx_ = psbt.extract_tx();
        println!(
            "commit_tx bytes {:?}",
            consensus::encode::serialize_hex(&commit_tx_)
        );
        let commit_tx_id = commit_tx_.txid();
        println!("commit_tx {:?}", commit_tx_.txid());

        let txin_unlock = TxIn {
            previous_output: bitcoin::OutPoint {
                txid: commit_tx_id,
                vout: 0,
            },
            script_sig: ScriptBuf::new(),
            sequence: Sequence::from_hex_str("0xfffffffd")
                .map_err(|e| e.to_string())
                .unwrap(),
            witness: Witness::default(),
        };

        let txout_unlock = TxOut {
            value: 1600,
            script_pubkey: script_output.clone(),
        };

        let reveal_tx_unlock = bitcoin::Transaction {
            version: 2,
            lock_time: LockTime::ZERO,
            input: vec![txin_unlock],
            output: vec![txout_unlock],
        };

        let mut reveal_psbt = Psbt::from_unsigned_tx(reveal_tx_unlock).unwrap();

        // reveal_psbt.inputs[0].witness_utxo = Some(txout2.clone());
        // reveal_psbt.inputs[0].sighash_type = Some(PsbtSighashType::from(EcdsaSighashType::All));
        // reveal_psbt.inputs[0].witness_script = Some(s);
        //
        // let res = sign_segwit0_tx_unlock(
        //     reveal_psbt,
        //     &key.inner,
        //     "02afee55a2cdcb6c47a593d629b04e13399354d348a3d84ad19310e2b6396e7237".to_string(),
        // )
        // .map_err(|e| e.to_string())
        // .unwrap();
        // println!("res {:?}", res);

        reveal_psbt.inputs[0].witness_utxo = Some(txout.clone());
        // reveal_psbt.inputs[0].sighash_type = Some(PsbtSighashType::from(EcdsaSighashType::All));
        // reveal_psbt.inputs[0].witness_script = Some(script.clone());

        let input_txouts_reveal = vec![txout.clone()];
        let leaf_hash = script.clone().tapscript_leaf_hash();
        let taproot_spend_info = TaprootBuilder::new()
            .add_leaf(0, script.clone())
            .unwrap()
            .finalize(&secp, xonly)
            .expect("should be finalizable");

        reveal_psbt
            .inputs
            .iter_mut()
            .enumerate()
            .try_for_each::<_, Result<(), Box<dyn std::error::Error>>>(|(vout, input)| {
                let mut origins = BTreeMap::new();
                origins.insert(xonly, (vec![leaf_hash], KeySource::default()));
                input.tap_internal_key = Some(xonly);
                input.tap_key_origins = origins;
                input.tap_merkle_root = taproot_spend_info.merkle_root();
                let ty = PsbtSighashType::from_str("SIGHASH_ALL")?;
                let mut tap_scripts = BTreeMap::new();
                tap_scripts.insert(
                    taproot_spend_info
                        .control_block(&(script.clone(), LeafVersion::TapScript))
                        .unwrap(),
                    (script.clone(), LeafVersion::TapScript),
                );
                input.tap_scripts = tap_scripts;
                input.sighash_type = Some(ty);

                println!("input {:?}\n", input);

                for (x_only_pubkey, (leaf_hashes, (_, derivation_path))) in
                    &input.tap_key_origins.clone()
                {
                    let secret_key = key.inner;
                    for lh in leaf_hashes {
                        let sighash_type = TapSighashType::All;
                        let hash = SighashCache::new(&reveal_psbt.unsigned_tx)
                            .taproot_script_spend_signature_hash(
                                vout,
                                &sighash::Prevouts::All(&input_txouts_reveal.as_slice()),
                                *lh,
                                sighash_type,
                            )
                            .unwrap();
                        println!("taphash {:?} \n", hash);
                        sign_psbt_taproot(
                            secret_key,
                            *x_only_pubkey,
                            Some(*lh),
                            input,
                            hash,
                            sighash_type,
                            &secp,
                        );
                    }
                }
                Ok(())
            })
            .unwrap();
        reveal_psbt.inputs.iter_mut().for_each(|input| {
            let mut script_witness: Witness = Witness::new();
            for (_, signature) in input.tap_script_sigs.iter() {
                println!("e \n");
                script_witness.push(signature.to_vec());
            }
            for (control_block, (scriptb, _)) in input.tap_scripts.iter() {
                script_witness.push(scriptb.to_bytes());
                script_witness.push(control_block.serialize());
            }

            println!("script_witness {:?}", script_witness);

            input.final_script_witness = Some(script_witness);

            // Clear all the data fields as per the spec.
            // input.partial_sigs = BTreeMap::new();
            // input.sighash_type = None;
            // input.redeem_script = None;
            // input.witness_script = None;
            // input.bip32_derivation = BTreeMap::new();
            // input.tap_script_sigs = BTreeMap::new();
            // input.tap_scripts = BTreeMap::new();
            // input.tap_key_sig = None;
        });
        println!("signed psbt {:?}", reveal_psbt);
        println!("signed reveal_tx psbt bytes {:?}", reveal_psbt.to_string());
        let revealtx = reveal_psbt.extract_tx();

        // revealtx.verify(|_| {
        //     Some(TxOut {
        //         value: 1000,
        //         script_pubkey: script_output.clone(),
        //     })
        // });
        // println!(
        //     "revealtx bytes {:?}",
        //     consensus::encode::serialize_hex(&revealtx)
        // );
        let revealtx_id = revealtx.txid();
        println!("revealtx {:?}", revealtx.txid());
    }

    fn sign_psbt_taproot(
        secret_key: secp256k1::SecretKey,
        pubkey: XOnlyPublicKey,
        leaf_hash: Option<TapLeafHash>,
        psbt_input: &mut psbt::Input,
        hash: TapSighash,
        sighash_type: TapSighashType,
        secp: &Secp256k1<secp256k1::All>,
    ) {
        let keypair = bitcoin::key::KeyPair::from_seckey_slice(secp, secret_key.as_ref()).unwrap();
        let keypair = match leaf_hash {
            None => keypair
                .tap_tweak(secp, psbt_input.tap_merkle_root)
                .to_inner(),
            Some(_) => keypair, // no tweak for script spend
        };

        let msg = secp256k1::Message::from(hash);
        let signature = secp.sign_schnorr_no_aux_rand(&msg, &keypair);

        let final_signature = taproot::Signature {
            sig: signature,
            hash_ty: sighash_type,
        };

        if let Some(lh) = leaf_hash {
            psbt_input
                .tap_script_sigs
                .insert((pubkey, lh), final_signature);
        } else {
            psbt_input.tap_key_sig = Some(final_signature);
        }
    }

    pub fn sign_segwit0_tx_unlock(
        mut psbt_to_sign: Psbt,
        sk: &secp256k1::SecretKey,
        pub_key_hex: String,
    ) -> Result<SignedTx, String> {
        let secp = Secp256k1::new();
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
            match cache.segwit_signature_hash(i, &output_script, value, EcdsaSighashType::All) {
                Ok(sighash) => {
                    let message = secp256k1::Message::from(sighash);
                    #[allow(unused_assignments)]
                    let mut signature = None;
                    let sig = secp.sign_ecdsa(&message, &sk);

                    // Update the witness stack.
                    signature = Some(Signature {
                        sig,
                        hash_ty: EcdsaSighashType::All,
                    });
                    if signature.is_none() {
                        continue;
                    } else {
                        let _signature = signature.unwrap();

                        let mut witness = Witness::new();
                        witness.push(&_signature.serialize());
                        witness.push(&pubkey.to_bytes());
                        input.final_script_witness = Some(witness);
                        input.partial_sigs.insert(pubkey, _signature.clone());
                    }
                }
                Err(_) => {
                    err = Some("Failed to construct message".to_string());
                }
            }
            input.partial_sigs = BTreeMap::new();
            input.sighash_type = None;
            input.redeem_script = None;
            input.witness_script = None;
            input.bip32_derivation = BTreeMap::new();
        }
        let signed_tx = psbt_to_sign.clone().extract_tx();
        let serialized_signed_tx = consensus::encode::serialize_hex(&signed_tx);
        let mut _psbt = None;
        _psbt = Some(psbt_to_sign.clone().to_string());
        return match err {
            Some(e) => Err(e),
            None => Ok(SignedTx {
                tx_hex: serialized_signed_tx,
                psbt_b64: _psbt,
                txid: signed_tx.txid().to_string(),
            }),
        };
    }
}
