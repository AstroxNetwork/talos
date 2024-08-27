use crate::utils::{get_script_from_address, vec_to_u81, vec_to_u82, vec_to_u820, AddressInfo};
use bitcoin::absolute::LockTime;
use bitcoin::hashes::Hash;
use bitcoin::opcodes::all::{OP_CLTV, OP_EQUALVERIFY};
use bitcoin::psbt::{Psbt, PsbtSighashType};
use bitcoin::script::Instruction::Op;
use bitcoin::script::{Instruction, PushBytes};
use bitcoin::string::FromHexStr;
use bitcoin::{
    opcodes, script, OutPoint, Script, ScriptBuf, Sequence, Transaction, TxIn, TxOut, Txid, Witness,
};

use bitcoin::sighash::EcdsaSighashType;
use std::str::FromStr;

type ScriptResult<T> = Result<T, script::Error>;

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct CoreOption {
    pub(crate) version: u8,
    pub(crate) chain_id: u16,
    pub(crate) delegator: Vec<u8>,
    pub(crate) validator: Vec<u8>,
    pub(crate) fee: u8,
    pub(crate) pub_key: String,
    pub(crate) lock_time: u32,
    pub(crate) network: bitcoin::Network,
}

pub struct CoreDao {
    option: CoreOption,
    redeem_script: Option<ScriptBuf>,
    op_return: Option<TxOut>,
    hash160: Option<Vec<u8>>,
}

impl CoreDao {
    pub fn new(option: CoreOption) -> Self {
        Self {
            option,
            redeem_script: None,
            op_return: None,
            hash160: None,
        }
    }

    pub fn get_option(&self) -> &CoreOption {
        &self.option
    }

    pub fn set_option(&mut self, option: CoreOption) {
        self.option = option;
    }

    pub fn set_op_return(&mut self, op_return: TxOut) {
        self.op_return = Some(op_return);
    }

    pub fn set_redeem_script(&mut self, redeem_script: ScriptBuf) {
        self.redeem_script = Some(redeem_script);
    }

    pub fn set_hash160(&mut self, hash160: Vec<u8>) {
        self.hash160 = Some(hash160);
    }

    pub fn get_redeem_script(&self) -> Option<ScriptBuf> {
        self.redeem_script.clone()
    }

    pub fn construct(&mut self) -> (TxOut, ScriptBuf, ScriptBuf) {
        let pubkey = bitcoin::PublicKey::from_slice(
            hex::decode(self.option.pub_key.clone()).unwrap().as_slice(),
        )
            .unwrap();
        let wpubkey_hash = pubkey.wpubkey_hash().unwrap();

        self.set_hash160(wpubkey_hash.clone().as_byte_array().to_vec());

        let redeem_script = script::Builder::new()
            .push_int(self.option.lock_time.clone() as i64)
            .push_opcode(opcodes::all::OP_CLTV)
            .push_opcode(opcodes::all::OP_DROP)
            .push_opcode(opcodes::all::OP_DUP)
            .push_opcode(opcodes::all::OP_HASH160)
            .push_slice(&wpubkey_hash.clone())
            .push_opcode(opcodes::all::OP_EQUALVERIFY)
            .push_opcode(opcodes::all::OP_CHECKSIG)
            .into_script();

        let mut p = vec![];
        p.extend_from_slice("SAT+".as_bytes());
        p.extend_from_slice(self.option.version.clone().to_be_bytes().as_slice());
        p.extend_from_slice(self.option.chain_id.clone().to_be_bytes().as_slice());
        p.extend_from_slice(self.option.delegator.clone().as_slice());
        p.extend_from_slice(self.option.validator.clone().as_slice());
        p.extend_from_slice(self.option.fee.clone().to_be_bytes().as_slice());
        p.extend_from_slice(redeem_script.as_bytes());

        let script_pubkey = script::Builder::new()
            .push_opcode(opcodes::all::OP_RETURN)
            .push_slice::<&PushBytes>(p.as_slice().try_into().unwrap())
            .into_script();

        let new_script_buf = redeem_script.to_v0_p2wsh();

        let op_return = TxOut {
            script_pubkey,
            value: 0,
        };
        self.set_op_return(op_return.clone());
        self.set_redeem_script(new_script_buf.clone());
        (
            op_return.clone(),
            new_script_buf.clone(),
            redeem_script.clone(),
        )
    }

    pub fn create_lock_tx(
        &mut self,
        stake_amount: u64,
        address_script_buf: ScriptBuf,
        txid: String,
        vout: u32,
        value: u64,
    ) -> Result<(Psbt, String), String> {
        let (op_return, script_pubkey, _) = self.construct();
        let out = OutPoint {
            txid: Txid::from_str(txid.as_str()).map_err(|v| v.to_string())?,
            vout,
        };
        let tx = Transaction {
            version: 1,
            lock_time: LockTime::ZERO,
            input: vec![TxIn {
                previous_output: out,
                script_sig: ScriptBuf::new(),
                sequence: Sequence::from_hex_str("0xffffffff").map_err(|e| e.to_string())?,
                witness: Witness::default(),
            }],
            output: vec![
                TxOut {
                    script_pubkey,
                    value: stake_amount,
                },
                op_return,
            ],
        };
        let mut psbt = Psbt::from_unsigned_tx(tx.clone()).map_err(|e| e.to_string())?;
        psbt.inputs[0].witness_utxo = Some(TxOut {
            script_pubkey: address_script_buf,
            value,
        });
        psbt.inputs[0].sighash_type = Some(PsbtSighashType::from(EcdsaSighashType::All));
        Ok((psbt, tx.txid().to_string()))
    }

    pub fn create_unlock_tx(
        &mut self,
        txid: String,
        vout: u32,
        stake_lock_time: u32,
        locked_amount: u64,
        output_value: u64,
        output_address: String,
    ) -> Result<Psbt, String> {
        let (_, _script_pubkey, _raw_redeem) = self.construct();
        let AddressInfo {
            script_buf: output_script_pubkey,
            ..
        } = get_script_from_address(output_address)?;

        let prev_out = OutPoint {
            txid: Txid::from_str(txid.as_str()).map_err(|v| v.to_string())?,
            vout,
        };

        let input = TxIn {
            previous_output: prev_out,
            script_sig: Default::default(),
            sequence: Sequence::from_hex_str("0xfffffffe").map_err(|e| e.to_string())?,
            witness: Default::default(),
        };

        let tx = Transaction {
            version: 2,
            lock_time: LockTime::from_time(stake_lock_time)
                .map_err(|e| e.to_string())
                .unwrap(),
            input: vec![input],
            output: vec![TxOut {
                script_pubkey: output_script_pubkey,
                value: output_value,
            }],
        };

        let mut psbt = Psbt::from_unsigned_tx(tx).map_err(|e| e.to_string())?;
        psbt.inputs[0].witness_utxo = Some(TxOut {
            script_pubkey: _script_pubkey,
            value: locked_amount,
        });
        psbt.inputs[0].sighash_type = Some(PsbtSighashType::from(EcdsaSighashType::All));
        psbt.inputs[0].witness_script = Some(_raw_redeem);
        Ok(psbt)
    }

    pub fn decode_lock_tx(transaction: &Transaction) -> Result<(CoreOption, Vec<u8>), String> {
        let bytes = Self::payload(transaction);
        if bytes.is_none() {
            return Err("No payload found".to_string());
        }
        let mut _bytes = bytes.unwrap();
        let protocol = String::from_utf8(_bytes[0..4].to_vec()).map_err(|e| e.to_string())?;
        if protocol != "SAT+" {
            return Err("Invalid protocol".to_string());
        }
        let version = u8::from_be_bytes(vec_to_u81(_bytes[4..5].to_vec())?);
        let chain_id = u16::from_be_bytes(vec_to_u82(_bytes[5..7].to_vec())?);
        let delegator = _bytes[7..27].to_vec();
        let validator = _bytes[27..47].to_vec();
        let fee = u8::from_be_bytes(vec_to_u81(_bytes[47..48].to_vec())?);
        let rest = _bytes[48..].to_vec();

        let (lock_time, staker) = Self::decode_script(Script::from_bytes(rest.as_slice()))
            .map_err(|_| "Cannot convert script".to_string())?;
        if lock_time.is_none() {
            return Err("No lock time found".to_string());
        }
        if staker.is_none() {
            return Err("No staker found".to_string());
        }
        Ok((
            CoreOption {
                version,
                chain_id,
                delegator,
                validator,
                fee,
                pub_key: "".to_string(),
                lock_time: lock_time.unwrap(),
                network: bitcoin::Network::Bitcoin,
            },
            staker.unwrap().to_vec(),
        ))
    }

    fn decode_script(script: &Script) -> ScriptResult<(Option<u32>, Option<[u8; 20]>)> {
        let mut lock_time = None;
        let mut staker = None;
        let mut instructions = script.instructions().peekable();
        while let Some(instruction) = instructions.next().transpose()? {
            match instruction {
                Instruction::PushBytes(r) => {
                    if r.len() == 20 && instructions.peek() == Some(&Ok(Op(OP_EQUALVERIFY))) {
                        staker = Some(vec_to_u820(r.as_bytes().to_vec()).unwrap());
                    }
                    if r.len() <= 4 && instructions.peek() == Some(&Ok(Op(OP_CLTV))) {
                        let mut b = r.as_bytes().to_vec();
                        b.reverse();
                        lock_time = u32::from_str_radix(hex::encode(b).as_str(), 16)
                            .map_or_else(|_| None, |v| Some(v));
                    }
                }
                _ => {}
            }
        }
        Ok((lock_time, staker))
    }

    fn payload(transaction: &Transaction) -> Option<Vec<u8>> {
        // search transaction outputs for payload

        for (_, output) in transaction.output.iter().enumerate() {
            let mut instructions = output.script_pubkey.instructions();
            // payload starts with OP_RETURN
            if instructions.next() != Some(Ok(Op(opcodes::all::OP_RETURN))) {
                continue;
            }

            // construct the payload by concatenating remaining data pushes
            let mut payload = Vec::new();

            for result in instructions {
                match result {
                    Ok(Instruction::PushBytes(push)) => {
                        payload.extend_from_slice(push.as_bytes());
                    }
                    Ok(Instruction::Op(_)) => {
                        return None;
                    }
                    Err(_) => {
                        return None;
                    }
                }
            }

            return Some(payload);
        }

        None
    }
}

pub fn u8_to_u81(v: u8) -> [u8; 1] {
    let bytes = v.to_be_bytes();
    let mut res = [0u8; 1];
    res.copy_from_slice(&bytes[0..1]);
    res
}

pub fn u16_to_u82(v: u16) -> [u8; 2] {
    let bytes = v.to_be_bytes();
    let mut res = [0u8; 2];
    res.copy_from_slice(&bytes[0..2]);
    res
}
#[cfg(test)]
mod test {
    use crate::core_dao::{u16_to_u82, u8_to_u81, CoreDao, CoreOption};
    use bitcoin::absolute::LockTime;
    use bitcoin::consensus::Decodable;
    use bitcoin::key::{Secp256k1, XOnlyPublicKey};
    use bitcoin::{
        opcodes, script, Address, OutPoint, ScriptBuf, Sequence, Transaction, TxIn,
        Witness,
    };
    use std::io::Cursor;

    #[test]
    pub fn test_convert() {
        let vesion = 1u8;
        let d = 1u16;
        let res = u8_to_u81(vesion);
        assert_eq!(res, [1]);
        let res = u16_to_u82(d);
        assert_eq!(res, [0, 1]);
    }

    #[test]
    pub fn create_new_option_script() {
        let option = CoreOption {
            version: 1,
            chain_id: 1,
            delegator: vec![0; 20],
            validator: vec![0; 20],
            fee: 1,
            pub_key: "02afee55a2cdcb6c47a593d629b04e13399354d348a3d84ad19310e2b6396e7237"
                .to_string(),
            lock_time: 848484,
            network: bitcoin::Network::Bitcoin,
        };
        let mut core_dao = CoreDao::new(option.clone());
        let (op_return, script, _) = core_dao.construct();
        assert_eq!(op_return.script_pubkey.is_op_return(), true);
        assert_eq!(script.is_v0_p2wsh(), true);

        let tx_in = TxIn {
            previous_output: OutPoint::null(),
            script_sig: ScriptBuf::new(),
            sequence: Sequence::ENABLE_RBF_NO_LOCKTIME,
            witness: Witness::from_slice(&[script.into_bytes(), Vec::new()]),
        };
        let mut input = Vec::new();
        input.push(tx_in);

        let mut output = Vec::new();
        output.push(op_return);

        let tx = Transaction {
            version: 2,
            lock_time: LockTime::ZERO,
            input,
            output,
        };
        let (_option, staker) = CoreDao::decode_lock_tx(&tx).unwrap();
        assert_eq!(_option.version, option.version.clone());
        assert_eq!(_option.chain_id, option.chain_id.clone());
        assert_eq!(_option.delegator, option.delegator.clone());
        assert_eq!(_option.validator, option.validator.clone());
        assert_eq!(_option.fee, option.fee.clone());
        assert_eq!(_option.lock_time, option.lock_time.clone());
        assert_eq!(_option.network, option.network.clone());
        assert_eq!(core_dao.hash160.unwrap(), staker)
    }

    #[test]
    pub fn test_decode() {
        let tx_bytes = "0200000000010179ab9cd8fcc5665afe94490afee8504512bb755224d0e882d6b448d0dac82fc20100000000feffffff01fc020000000000001600141bb0f5257a82f042853e1bddf8f2dba9f9f8a17403483045022100e6c879e9b80abe874de8ecca6ae7b34d0f3cc1d769ac99ca1363d45eae96be5c02204d5606b6397faa9c4b2d88d9d695c37955a204bb57ba0057477d9ac38ee2febd01210288e3b6465e45dc9f4322e422d96d60552de08b94bf790f745b8f2911059b619c20046191cd66b17576a9141bb0f5257a82f042853e1bddf8f2dba9f9f8a17488ac6191cd66";
        let mut decoder = Cursor::new(hex::decode(tx_bytes).unwrap());
        let tx: Transaction =
            Transaction::consensus_decode_from_finite_reader(&mut decoder).unwrap();

        tx.input.iter().for_each(|v| {
            println!("tx {:?}", v.witness.len());
        });
        let s = bitcoin::script::ScriptBuf::from_hex(
            "046a94a466b17576a91414906c96c9c1ee97e2457f3ab9f80757075d78df88ac",
        )
            .unwrap();
        println!("script {:?}", s.to_asm_string());

        // println!("tx {:?}", tx);
        // let (_option, staker) = CoreDao::decode_lock_tx(&tx).unwrap();
        // println!("option {:?}", _option);
    }

    #[test]
    pub fn try_lock_time() {
        let lock_time = 1723332363u32;
        let lt = LockTime::from_time(lock_time).unwrap();
        println!("locktime len {}", lock_time.to_be_bytes().len())
    }

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

        let s = script::Builder::new()
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

        println!("script {:?}", s.to_asm_string());

        let secp = Secp256k1::new();

        let _new_script_buf = s.to_v1_p2tr(&secp, xonly);

        println!("_new_script_buf: {:?}", _new_script_buf.to_bytes().len());

        println!(
            "p2tr_address {:?}",
            Address::from_script(&_new_script_buf, bitcoin::Network::Testnet).unwrap()
        );
    }
}
