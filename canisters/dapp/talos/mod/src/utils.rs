pub(crate) fn new_order_id() -> [u8; 4] {
    use rand::rngs::StdRng;
    use rand::{RngCore, SeedableRng};
    let mut r_bytes = [0u8; 32];
    let mut rd_vec = [0u8; 32];
    rd_vec[0..8].clone_from_slice(&ic_cdk::api::time().to_le_bytes());
    rd_vec[8..16].clone_from_slice(&ic_cdk::api::time().to_le_bytes());
    rd_vec[16..24].clone_from_slice(&ic_cdk::api::time().to_le_bytes());
    rd_vec[24..32].clone_from_slice(&ic_cdk::api::time().to_le_bytes());

    StdRng::from_seed(rd_vec).fill_bytes(&mut r_bytes);
    let mut final_bytes = [0u8; 4];
    final_bytes.copy_from_slice(&r_bytes[0..4]);
    final_bytes
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

pub fn vec_to_u84(req: Vec<u8>) -> Result<[u8; 4], String> {
    if req.len() != 4 {
        return Err("Salt length should be 4".to_string());
    }
    let mut salt_bytes = [0u8; 4];

    for i in 0..4 {
        salt_bytes[i] = req[i.clone()]
    }
    Ok(salt_bytes.clone())
}
