import {
  bitcoin,
  buildTx,
  calculateAmountRequiredForReveal,
  detectAddressTypeToScripthash,
  DUST_AMOUNT,
  Output,
  toPsbt,
  toXOnly,
  UTXO,
} from '@wizz-btc/wallet';
import { Tag } from './op.ts';
import { RuneValueWithUTXOs } from '@wizz-btc/provider';
import { WalletBalance } from '../hook';
import { Edict, RuneId, Runestone } from '@wizz-btc/ordx-wasm';


export function convertScriptSigAsm(script: string | Buffer): string {
  const buf = Buffer.isBuffer(script) ? script : Buffer.from(script, 'hex');

  const b: string[] = [];

  let i = 0;
  while (i < buf.length) {
    const op = buf[i];
    if (op >= 0x01 && op <= 0x4e) {
      i++;
      let push: number;
      if (op === 0x4c) {
        push = buf.readUInt8(i);
        b.push('OP_PUSHDATA1');
        i += 1;
      } else if (op === 0x4d) {
        push = buf.readUInt16LE(i);
        b.push('OP_PUSHDATA2');
        i += 2;
      } else if (op === 0x4e) {
        push = buf.readUInt32LE(i);
        b.push('OP_PUSHDATA4');
        i += 4;
      } else {
        push = op;
        b.push('OP_PUSHBYTES_' + push);
      }

      const data = buf.slice(i, i + push);
      if (data.length !== push) {
        break;
      }

      b.push(data.toString('hex'));
      i += data.length;
    } else {
      if (op === 0x00) {
        b.push('OP_0');
      } else if (op === 0x4f) {
        b.push('OP_PUSHNUM_NEG1');
      } else if (op === 0xb1) {
        b.push('OP_CLTV');
      } else if (op === 0xb2) {
        b.push('OP_CSV');
      } else if (op === 0xba) {
        b.push('OP_CHECKSIGADD');
      } else {
        const opcode = bitcoin.script.toASM([op]);
        if (opcode && op < 0xfd) {
          if (/^OP_(\d+)$/.test(opcode)) {
            b.push(opcode.replace(/^OP_(\d+)$/, 'OP_PUSHNUM_$1'));
          } else {
            b.push(opcode);
          }
        } else {
          b.push('OP_RETURN_' + op);
        }
      }
      i += 1;
    }
  }

  return b.join(' ');
}

export const prepareCommitRevealConfig = (
  tag: number,
  id: string,
  lockTime: number,
  childNodeXOnlyPubkey: Buffer,
  network: bitcoin.Network,
): { hashscript: Buffer; scriptP2TR: bitcoin.Payment; hashLockP2TR: bitcoin.Payment; } => {
  const revealScript = appendRevealScript(tag, id, lockTime, childNodeXOnlyPubkey);
  console.log(revealScript);
  const hashscript = bitcoin.script.fromASM(revealScript);
  const scriptTree = {
    output: hashscript,
  };
  const hash_lock_script = hashscript;
  const hashLockRedeem = {
    output: hash_lock_script,
    redeemVersion: 192,
  };
  const scriptP2TR = bitcoin.payments.p2tr({
    internalPubkey: childNodeXOnlyPubkey,
    scriptTree,
    network,
  });

  const hashLockP2TR = bitcoin.payments.p2tr({
    internalPubkey: childNodeXOnlyPubkey,
    scriptTree,
    redeem: hashLockRedeem,
    network,
  });

  return {
    scriptP2TR,
    hashLockP2TR,
    hashscript,
  };
};


export const appendRevealScript = (tag: number, id: string, lockTime: number, childNodeXOnlyPubkey: Buffer) => {
  let ops = `${bitcoin.script.number.encode(lockTime).toString('hex')} OP_CHECKLOCKTIMEVERIFY OP_DROP ${childNodeXOnlyPubkey.toString('hex')} OP_CHECKSIG OP_0 OP_IF `;
  ops += `${Buffer.from('wizz', 'utf8').toString('hex')}`;
  ops += ` ${tag.toString(16).padStart(2, '0')}`;
  const s = Buffer.from(id, 'hex').toString('hex');
  if (s.length != 8) {
    throw new Error('id length must be 8 bytes');
  }
  ops += ` ${s}`;
  ops += ' OP_ENDIF';
  return ops;
};


export function createOrder(
  {
    balance,
    feeRate,
    stakeAmount,
    selectedRune,
    orderId,
    lockHeight,
  }: {
    orderId: string;
    balance: WalletBalance;
    feeRate: number;
    stakeAmount: bigint;
    selectedRune: RuneValueWithUTXOs;
    lockHeight: number;
  }) {
  const xOnlyPubkey = toXOnly(Buffer.from(balance.publicKey!, 'hex'));
  const {
    scriptP2TR,
  } = prepareCommitRevealConfig(Tag.Id, orderId, lockHeight, xOnlyPubkey, balance.network.network);
  console.log(scriptP2TR.address);
  const inputs: UTXO[] = [];
  const outputs: Output[] = [];
  let runeValue = BigInt(0);
  let inputValue = 0;
  let ok = false;
  const edicts: Edict[] = [];
  for (const utxo of selectedRune.utxos) {
    inputs.push(utxo);
    inputValue += utxo.value;
    runeValue += utxo.rune_value;
    const r = runeValue - stakeAmount;
    if (r >= 0) {
      outputs.push({
        value: DUST_AMOUNT,
        address: scriptP2TR.address!,
      });
      edicts.push(new Edict(RuneId.fromString(selectedRune.rune_id), stakeAmount.toString(10), edicts.length));
      if (r > 0) {
        outputs.push({
          value: DUST_AMOUNT,
          address: balance.address,
        });
        edicts.push(new Edict(RuneId.fromString(selectedRune.rune_id), r.toString(10), edicts.length));
      }
      ok = true;
      break;
    }
  }

  if (!ok) {
    throw new Error('Not enough balance');
  }

  if (edicts.length > 1) {
    const runestone = new Runestone(edicts);
    outputs.push({
      script: Buffer.from(runestone.encipher()),
      value: 0,
    });
  }

  const txResult = buildTx({
    inputs,
    outputs,
    feeRate,
    balances: balance.regularUTXOs,
    amount: outputs.reduce((a, b) => a + b.value, 0) - inputValue,
    address: balance.address,
  });

  if (txResult.error) {
    throw new Error(txResult.error);
  }


  return {
    psbt: toPsbt({ tx: txResult.ok!, pubkey: balance.publicKey! }),
    fee: txResult.ok!.fee,
    vout: 0,
  };
}


export function withdrawPsbt(
  {
    orderId,
    utxo,
    lockHeight,
    balance,
    feeRate,
  }: {
    orderId: string;
    utxo: UTXO,
    lockHeight: number;
    balance: WalletBalance;
    feeRate: number;
  }) {
  const address = balance.address;
  const xOnlyPubkey = toXOnly(Buffer.from(balance.publicKey!, 'hex'));
  const network = balance.network.network;
  const {
    hashLockP2TR,
    scriptP2TR,
  } = prepareCommitRevealConfig(Tag.Id, orderId, lockHeight, xOnlyPubkey, network);
  console.log(scriptP2TR.address);
  const revealPsbt = new bitcoin.Psbt({ network });
  revealPsbt.setVersion(2);
  revealPsbt.setLocktime(lockHeight);
  const tapLeafScript = {
    leafVersion: hashLockP2TR!.redeem!.redeemVersion,
    script: hashLockP2TR!.redeem!.output,
    controlBlock: hashLockP2TR.witness![hashLockP2TR.witness!.length - 1],
  };
  revealPsbt.addInput({
    hash: utxo.txid,
    index: utxo.index,
    witnessUtxo: {
      script: hashLockP2TR.output!,
      value: utxo.value,
    },
    sequence: 0xfffffffd,
    tapLeafScript: [tapLeafScript as any],
  });

  const hashLockP2TROutputLen = hashLockP2TR.redeem!.output!.length;

  const inputs = [];
  let inputValue = utxo.value;
  const outputValue = DUST_AMOUNT;
  const outputs = [];
  let ok = false;
  for (const u of balance.regularUTXOs) {
    inputs.push(u);
    inputValue += u.value;
    let fee = calculateAmountRequiredForReveal(feeRate, inputs.length, 1, hashLockP2TROutputLen);
    let r = inputValue - outputValue - fee;
    if (r > 0) {
      if (r >= DUST_AMOUNT) {
        fee = calculateAmountRequiredForReveal(feeRate, inputs.length, 2, hashLockP2TR.redeem!.output!.length);
        r = inputValue - outputValue - fee;
        if (r >= DUST_AMOUNT) {
          outputs.push({
            address: address,
            value: r,
          });
        }
      }
      ok = true;
      break;
    }
  }
  if (!ok) {
    throw new Error('Not enough balance');
  }
  const { output } = detectAddressTypeToScripthash(address);
  for (const u of inputs) {
    revealPsbt.addInput({
      hash: u.txid,
      index: u.index,
      witnessUtxo: {
        script: output,
        value: u.value,
      },
      tapInternalKey: xOnlyPubkey,
      sequence: 0xfffffffd,
    });
  }
  revealPsbt.addOutput({
    address: address,
    value: outputValue,
  });
  revealPsbt.addOutputs(outputs);
  const fee = inputs.reduce((a, b) => a + b.value, 0) - outputs.reduce((a, b) => a + b.value, 0) - outputValue;
  return {
    psbt: revealPsbt,
    fee,
  };
}