import { bitcoin } from '@wizz-btc/wallet';

export const MAGIC_NUMBER = 0x60;

export class Message {
  constructor(public fields: Map<bigint, bigint[]>, public id: string, public staker: Buffer) {
  }

  static fromIntegers(payload: bigint[]): Message {
    const fields = new Map<bigint, bigint[]>();
    let _id;
    const _staker: number[] = [];
    for (let i = 0; i < payload.length; i += 1) {
      const tag = payload[i];
      if (tag === BigInt(Tag.Who)) {
        const pre = payload[i + 1].toString(16).padStart(32, '0');
        const post = payload[i + 2].toString(16).padStart(32, '0');
        Buffer.from(pre, 'hex').forEach((i) => {
          _staker.push(i);
        });
        Buffer.from(post, 'hex').forEach((i) => {
          _staker.push(i);
        });
      }
      let value: bigint | undefined;
      if (payload[i + 1] !== undefined) {
        value = payload[i + 1];
      } else {
        break;
      }
      let _values = fields.get(tag);
      if (!_values) {
        _values = [];
        _values!.push(value);
        fields.set(tag, _values!);
      } else {
        _values.push(value);
        fields.set(tag, _values!);
      }
    }

    return new Message(fields, _id, Buffer.from(_staker));
  }
}

export class StakerPayload {
  public id: bigint;
  public staker: Buffer;
  public protocol: bigint;
  public version: bigint;
  public vout: bigint;
  public lock_time: bigint;

  constructor({
                id,
                staker,
                protocol,
                version,
                vout,
                lock_time,
              }: {
    id: string;
    staker: string;
    protocol: number;
    version: number;
    vout: number;
    lock_time: number;
  }) {
    this.id = BigInt('0x' + Buffer.from(id.replace('0x', ''), 'hex').toString('hex'));
    this.staker = Buffer.from(staker, 'hex');
    this.protocol = BigInt(protocol);
    this.version = BigInt(version);
    this.vout = BigInt(vout);
    this.lock_time = BigInt(lock_time);
  }

  get idHex() {
    return '0x' + bnToHex(this.id);
  }

  get stakerHex() {
    return '0x' + this.staker.toString('hex');
  }

  public static create({
                         id,
                         staker,
                         protocol,
                         version,
                         vout,
                         lock_time,
                       }: {
    id: string;
    staker: string;
    protocol: number;
    version: number;
    vout: number;
    lock_time: number;
  }) {
    return new StakerPayload({ id, staker, protocol, version, vout, lock_time });
  }

  public encipher() {
    const payload = encoder(this);
    const buffers = chunkBuffer(Buffer.from(new Uint8Array(payload)), 520);
    const script = bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, MAGIC_NUMBER, ...buffers]);
    return script;
  }

  public static decipher(transaction: bitcoin.Transaction): StakerPayload | undefined {
    const payload = StakerPayload.payload(transaction);
    if (!payload) {
      return undefined;
    }
    return decoder(payload);
  }

  public static payload(transaction: bitcoin.Transaction): Buffer | null {
    let solution: Buffer | null = null;

    for (const output of transaction.outs) {
      const script = bitcoin.script.decompile(output.script);
      if (script && script[0] === bitcoin.opcodes.OP_RETURN) {
        if (script.length > 1 && !Buffer.isBuffer(script[1]) && script[1] === MAGIC_NUMBER) {
          let payload = Buffer.alloc(0);
          for (let i = 2; i < script.length; i++) {
            if (Buffer.isBuffer(script[i])) {
              payload = Buffer.concat([payload, script[i] as Buffer]);
            }
          }
          solution = payload;
          break;
        } else {
          continue;
        }
      } else {
        continue;
      }
    }

    return solution;
  }
}

export function chunkBuffer(buffer: Buffer, chunkSize: number) {
  if (buffer.byteLength === 0) {
    throw new Error('Chunk size should be positive number');
  }
  const result: Buffer[] = [];
  const len = buffer.byteLength;
  let i = 0;
  while (i < len) {
    result.push(buffer.subarray(i, (i += chunkSize)));
  }
  return result;
}

export function decodeOpReturn(scriptHex: string | Buffer): StakerPayload | undefined {
  const scriptBuf = typeof scriptHex === 'string' ? Buffer.from(scriptHex, 'hex') : scriptHex;
  const script = bitcoin.script.decompile(scriptBuf);
  let payload: Buffer | null = null;
  if (script && script[0] === bitcoin.opcodes.OP_RETURN) {
    if (script.length > 1 && !Buffer.isBuffer(script[1]) && script[1] === MAGIC_NUMBER) {
      let _payload = Buffer.alloc(0);
      for (let i = 2; i < script.length; i++) {
        if (Buffer.isBuffer(script[i])) {
          _payload = Buffer.concat([_payload, script[i] as Buffer]);
        }
      }
      payload = _payload;
    }
  }

  if (!payload) {
    return undefined;
  }
  return decoder(payload);
}

export function encoder(txOuts: StakerPayload): number[] {
  let payload: number[] = [];

  payload = tagEncodeList(BigInt(Tag.Protocol), [txOuts.protocol], payload);
  payload = tagEncodeList(BigInt(Tag.Version), [txOuts.version], payload);
  payload = tagEncodeList(BigInt(Tag.Output), [txOuts.vout], payload);
  payload = tagEncodeList(BigInt(Tag.Time), [txOuts.lock_time], payload);
  payload = tagEncodeList(BigInt(Tag.Id), [txOuts.id], payload);

  if (txOuts.staker.length > 0 && txOuts.staker.length == 32) {
    payload = encodeToVec(BigInt(Tag.Who), payload);
    const pre = '0x' + txOuts.staker.subarray(0, 16).toString('hex');
    const post = '0x' + txOuts.staker.subarray(16).toString('hex');
    payload = encodeToVec(BigInt(pre), payload);
    payload = encodeToVec(BigInt(post), payload);
  }

  return payload;
}

export function decoder(payload: Buffer) {
  const integers: bigint[] = [];
  let i = 0;

  while (i < payload.length) {
    const _payload = payload.subarray(i);
    const [integer, length] = decode(_payload);
    integers.push(integer);
    i += length;
  }

  const message = Message.fromIntegers(integers);

  const fields = message.fields;

  const staker = message.staker;
  const id = tagTaker(BigInt(Tag.Id), 1, fields, (values) => {
    return values[0];
  });

  const protocol = tagTaker(BigInt(Tag.Protocol), 1, fields, (values) => {
    return values[0];
  });

  const version = tagTaker(BigInt(Tag.Version), 1, fields, (values) => {
    return values[0];
  });
  const lock_time = tagTaker(BigInt(Tag.Time), 1, fields, (values) => {
    return values[0];
  });
  const vout = tagTaker(BigInt(Tag.Output), 1, fields, (values) => {
    return values[0];
  });

  if (id === null || vout === null || protocol === null || version === null || lock_time === null || staker.byteLength !== 32) {
    return undefined;
  }
  return new StakerPayload({
    protocol: Number(protocol),
    version: Number(version),
    id: '0x' + bnToHex(id),
    staker: staker.toString('hex'),
    vout: Number(vout),
    lock_time: Number(lock_time),
  });
}

export enum Tag {
  Number = 0,
  Op = 2,
  Blocks = 4,
  Body = 5,
  Skips = 7,
  Amount = 9,
  Output = 11,
  Signers = 6,
  Who = 8,
  Value = 10,
  Coin = 12,
  Platform = 14,
  Id = 54,
  Time = 56,
  // ops
  Init = 71,
  Mint = 73,
  Tele = 75,
  Call = 77,
  Burn = 79,
  Send = 81,
  Dele = 83,
  Stake = 85,
  Metadata = 21,
  Version = 99,
  Protocol = 100,

  Nop = 255,
}

export enum ProtcolEnum {
  Atom = 101,
  BRC20 = 103,
  RUNES = 105,
}

export const ATOM_PROTOCOL = BigInt(ProtcolEnum.Atom);
export const BRC20_PROTOCOL = BigInt(ProtcolEnum.BRC20);
export const RUNES_PROTOCOL = BigInt(ProtcolEnum.RUNES);

export function tagEncoder(tag: bigint, value: bigint, target: number[]): number[] {
  target = encodeToVec(tag, target);
  target = encodeToVec(value, target);
  return target;
}

export function tagEncodeList(tag: bigint, value: bigint[], target: number[]): number[] {
  for (let i = 0; i < value.length; i++) {
    target = encodeToVec(tag, target);
    target = encodeToVec(value[i], target);
  }
  return target;
}

export function tagEncodeOption(tag: bigint, value: bigint | null, target: number[]): number[] {
  if (value !== null) {
    target = tagEncoder(tag, value, target);
  }
  return target;
}

export function tagInto(tag: Tag): bigint {
  return BigInt(tag);
}

// export function tagTaker(tag: bigint, value: bigint, fields: Map<bigint, bigint[]>): bigint | null {
//   const field = fields.get(tag);

//   if (field === undefined) {
//     return null;
//   }

//   fields.delete(tag);

//   field.push(value);

//   return BigInt(field.length);
// }

export function tagTaker<T>(tag: bigint, length: number, fields: Map<bigint, bigint[]>, callback: (value: bigint[]) => T | null): T | null {
  const field = fields.get(tag);

  const values: bigint[] = new Array(length);

  for (let i = 0; i < length; i++) {
    if (field) {
      values[i] = field[i];
    }
  }
  const value = callback(values);

  if (field) {
    drain(field, 0, length);
  }

  if (field && field.length === 0) {
    fields.delete(tag);
  }
  return value;
}

function drain<T>(array: T[], start: number, end: number): T[] {
  // 注意：end 在这里是不包含的，与Rust的行为一致
  // JavaScript 的 splice 方法的第二个参数需要的是删除的元素数量
  // 所以我们需要计算出长度
  const deleteCount = end - start;

  // 使用 splice 来移除元素，它同时返回被移除的元素数组
  return array.splice(start, deleteCount);
}

// pub(super) fn take<const N: usize, T>(
//   self,
//   fields: &mut HashMap<u128, VecDeque<u128>>,
//   with: impl Fn([u128; N]) -> Option<T>,
// ) -> Option<T> {
//   let field = fields.get_mut(&self.into())?;
//   let mut values: [u128; N] = [0; N];
//   for (i, v) in values.iter_mut().enumerate() {
//     *v = *field.get(i)?;
//   }
//   let value = with(values)?;
//   field.drain(0..N);
//   if field.is_empty() {
//     fields.remove(&self.into()).unwrap();
//   }
//   Some(value)
// }

export function decode(buffer: Uint8Array): [bigint, number] {
  const res: [bigint, number] = [BigInt(0), 0];
  let n = BigInt(0);
  let undeterminted = true;
  for (let i = 0; i < buffer.length; i++) {
    if (i > 18) {
      throw new Error('Varint decoding error: Buffer overlong');
    }
    const byte = buffer[i];
    const value = BigInt(byte & 0b01111111);

    if (i === 18 && (value & BigInt(0b01111100)) !== BigInt(0)) {
      throw new Error('Varint decoding error: Buffer overflow');
    }
    n |= value << BigInt(7 * i);
    if ((byte & 0b1000_0000) === 0) {
      res[0] = n;
      res[1] = i + 1;
      undeterminted = false;
      break;
    }
  }
  if (undeterminted) {
    throw new Error('Varint decoding error: Buffer undeterminted');
  } else {
    return res;
  }
}

export function encode(n: bigint): Uint8Array {
  const _v: number[] = [];
  const v = encodeToVec(n, _v);
  return new Uint8Array(v);
}

export function encodeToVec(n: bigint, v: number[]): number[] {
  // let out: number[] = new Array(19).fill(0);
  // let i = 18;

  // out[i] = bigintToLEBytes(n)[0] & 0b0111_1111;

  // while (n > BigInt(0x7f)) {
  //   n = n / BigInt(128) - BigInt(1);
  //   i -= 1;
  //   out[i] = bigintToLEBytes(n)[0] | 0b1000_0000;
  // }

  // v.push(...out.slice(i));
  // return v;

  while (n >> BigInt(7) > 0) {
    v.push(bigintToLEBytes(n)[0] | 0b1000_0000);
    n >>= BigInt(7);
  }
  v.push(bigintToLEBytes(n)[0]);
  return v;
}

export function bigintToLEBytes(value: bigint): Uint8Array {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  for (let i = 0; i < 16; i++) {
    view.setUint8(i, Number((value >> BigInt(i * 8)) & BigInt(0xff)));
  }
  return new Uint8Array(buffer);
}

export function decode2Commitment(buffer: Uint8Array): [bigint, number] {
  let n: bigint = BigInt(0);
  let i = 0;
  console.log(buffer);
  while (true) {
    console.log('iteration:', i, buffer[i]);
    if (i > 18) {
      throw new Error('Varint decoding error: OverLong');
    }
    if (i >= buffer.length) {
      throw new Error('Varint decoding error: Buffer underflow');
    }
    const byte = buffer[i];
    if (i == 18 && (byte & 0b0111_1100) != 0) {
      throw new Error('Varint decoding error: Overflow');
    }
    console.log('N:', n);
    let value = BigInt(byte & 0b0111_1111);
    value = value << BigInt(7 * i);
    n |= value;
    console.log('N:', n);
    if ((byte & 0b1000_0000) == 0) {
      console.log('finish');
      return [n, i + 1];
    }
    i++;
  }
}

export function bnToHex(bn: bigint) {
  bn = BigInt(bn);

  let pos = true;
  if (bn < 0) {
    pos = false;
    bn = bitnot(bn);
  }

  let hex = bn.toString(16);
  if (hex.length % 2) {
    hex = '0' + hex;
  }

  if (pos && 0x80 & parseInt(hex.slice(0, 2), 16)) {
    hex = '00' + hex;
  }

  return hex;
}

function bitnot(bn: bigint) {
  bn = -bn;
  let bin = bn.toString(2);
  let prefix = '';
  while (bin.length % 8) {
    bin = '0' + bin;
  }
  if ('1' === bin[0] && -1 !== bin.slice(1).indexOf('1')) {
    prefix = '11111111';
  }
  bin = bin
    .split('')
    .map(function(i) {
      return '0' === i ? '1' : '0';
    })
    .join('');
  return BigInt('0b' + prefix + bin) + BigInt(1);
}
