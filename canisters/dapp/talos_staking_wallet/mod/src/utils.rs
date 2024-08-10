use bitcoin::Network::{Bitcoin, Testnet};
use bitcoin::{Address, AddressType, Network, ScriptBuf};
use std::str::FromStr;

pub struct AddressInfo {
    pub address: String,
    pub script_buf: ScriptBuf,
    pub network: Network,
    pub address_type: AddressType,
}

pub fn get_script_from_address(address: String) -> Result<AddressInfo, String> {
    let mut network = Bitcoin;
    let mut address_type = AddressType::P2tr;

    if address.starts_with("bc1q") {
        address_type = AddressType::P2wpkh;
        network = Bitcoin;
    } else if address.starts_with("bc1p") {
        address_type = AddressType::P2tr;
        network = Bitcoin;
    } else if address.starts_with('1') {
        address_type = AddressType::P2pkh;
        network = Bitcoin;
    } else if address.starts_with('3') {
        address_type = AddressType::P2sh;
        network = Bitcoin;
    } else if address.starts_with("tb1q") {
        address_type = AddressType::P2wpkh;
        network = Testnet;
    } else if address.starts_with('m') || address.starts_with('n') {
        address_type = AddressType::P2pkh;
        network = Testnet;
    } else if address.starts_with('2') {
        address_type = AddressType::P2sh;
        network = Testnet;
    } else if address.starts_with("tb1p") {
        address_type = AddressType::P2tr;
        network = Testnet;
    }
    let addr = Address::from_str(address.as_str())
        .map_err(|e| format!("Cannot gen address {:?}", e).to_string())?;

    let addr_checked = addr
        .clone()
        .require_network(network)
        .map_err(|e| format!("Cannot require network {:?}", e).to_string())?;

    Ok(AddressInfo {
        address: addr_checked.to_string(),
        script_buf: addr_checked.script_pubkey(),
        network,
        address_type,
    })
}

pub(crate) fn vec_to_u81(req: Vec<u8>) -> Result<[u8; 1], String> {
    if req.len() != 1 {
        return Err("Salt length should be 1".to_string());
    }
    let mut salt_bytes = [0u8; 1];

    for i in 0..1 {
        salt_bytes[i] = req[i.clone()]
    }
    Ok(salt_bytes.clone())
}

pub(crate) fn vec_to_u82(req: Vec<u8>) -> Result<[u8; 2], String> {
    if req.len() != 2 {
        return Err("Salt length should be 2".to_string());
    }
    let mut salt_bytes = [0u8; 2];

    for i in 0..2 {
        salt_bytes[i] = req[i.clone()]
    }
    Ok(salt_bytes.clone())
}

pub(crate) fn vec_to_u832(req: Vec<u8>) -> Result<[u8; 32], String> {
    if req.len() != 32 {
        return Err("Salt length should be 32".to_string());
    }
    let mut salt_bytes = [0u8; 32];

    for i in 0..32 {
        salt_bytes[i] = req[i.clone()]
    }
    Ok(salt_bytes.clone())
}

pub(crate) fn vec_to_u820(req: Vec<u8>) -> Result<[u8; 20], String> {
    if req.len() != 20 {
        return Err("Salt length should be 20".to_string());
    }
    let mut salt_bytes = [0u8; 20];

    for i in 0..20 {
        salt_bytes[i] = req[i.clone()]
    }
    Ok(salt_bytes.clone())
}
