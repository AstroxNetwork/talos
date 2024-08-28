import { idlFactory as talosIDL } from '@/idls/talos.idl';
import { _SERVICE as talosService } from '@/idls/talos';
import { idlFactory as walletIDL } from '@/idls/talos_staking_wallet.idl';
import { _SERVICE as walletService } from '@/idls/talos_staking_wallet';
import { getActor, getCanisterId, hasOwnProperty, identity } from '@ego-js/utils';
import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { witnessStackToScriptWitness } from 'bitcoinjs-lib/src/psbt/psbtutils';

describe('talos', () => {
  let talosActor: ActorSubclass<talosService>;
  let walletActor: ActorSubclass<walletService>;
  test('add setting', async () => {
    talosActor =
      // getActor use idl types
      await getActor<talosService>(
        // use credential identity, owner of canister
        identity(),
        // use idlFactory from generated file
        talosIDL,
        // get canister ID for 'talos', `configs/talos.json` is generated
        getCanisterId('talos')!,
      );
    walletActor = await getActor<walletService>(
      // use credential identity, owner of canister
      identity(),
      // use idlFactory from generated file
      walletIDL,
      // get canister ID for 'talos', `configs/talos.json` is generated
      getCanisterId('talos_staking_wallet')!,
    );

    await talosActor.admin_add_setting({
      oracles_endpoint: 'https://oracle.wizz.cash',
      staking_wallet_canister: Principal.fromText(getCanisterId('talos_staking_wallet')!),
      token_canister: Principal.anonymous(),
      lp_rewards_ratio: 0.0001,
    });

    await walletActor.ego_owner_add(Principal.fromText(getCanisterId('talos')!));

    const lp = await talosActor.get_btc_lp_reward(BigInt(1000), BigInt(100000));
    console.log(lp);

    const who = await talosActor.whoAmI();
    console.log(who);

    await walletActor.set_talos(Principal.fromText(getCanisterId('talos')!));
  });
  test.skip('register', async () => {
    let userIdentity = Secp256k1KeyIdentity.generate();
    let userActor = await getActor<talosService>(
      // use credential identity, owner of canister
      userIdentity,
      // use idlFactory from generated file
      talosIDL,
      // get canister ID for 'talos', `configs/talos.json` is generated
      getCanisterId('talos')!,
    );

    const pubkey = Buffer.from('02afee55a2cdcb6c47a593d629b04e13399354d348a3d84ad19310e2b6396e7237', 'hex');
    const xonly = Array.from(pubkey.slice(0, 32));
    const hash160 = Array.from(bitcoin.crypto.hash160(pubkey));

    const res = await userActor.user_register('tb1pv8cz8vvj2s95pdzeax4x9tkuawr5um49n9er6gd2wf6wthwrh6ysqnkcq9', {
      hash160,
      xonly,
      pubkey: Array.from(pubkey),
    });

    console.log({ res });

    const _user_get_1 = await userActor.whoAmI();
    console.log(_user_get_1[0]);

    const removeAction = await talosActor.admin_remove_user_by_address('tb1pv8cz8vvj2s95pdzeax4x9tkuawr5um49n9er6gd2wf6wthwrh6ysqnkcq9');
    console.log(removeAction[0]);

    const _user_get_2 = await userActor.whoAmI();
    console.log(_user_get_2[0]);
  });

  test.skip('add_runes', async () => {
    const rune_id = '1:100';
    const res = await talosActor.admin_add_runes({
      runes_status: { Active: null },
      min_stake: BigInt(100),
      rune_name: 'WOO•HOO•KOO',
      rune_id: '2584503:2',
      rune_divisibility: 0,
      rune_symbol: '$',
    });
    console.log({ res });

    const list = await talosActor.get_rune_list();
    console.log({ list });

    const removeAction = await talosActor.admin_remove_runes(rune_id);
    console.log({ removeAction });

    const list2 = await talosActor.get_rune_list();
    console.log({ list2 });
  });
  test('get_oracle_price', async () => {
    const price = await talosActor.get_price_from_oracles('2584503:2');
    console.log({ price });
  });

  test('create_runes_order', async () => {
    // rune id
    const runesList = [
      { rune_name: 'WOO•HOO•KOO', rune_id: '2584503:2', rune_divisibility: 0, rune_symbol: '$' },
      { rune_name: 'MIHAELMINTAAA', rune_id: '2587810:1775', rune_divisibility: 0, rune_symbol: 'M' },
      { rune_name: 'HELLO•WORLD', rune_id: '2584592:58', rune_divisibility: 2, rune_symbol: '^' },
      { rune_name: 'HELLO•WORLD•FIXED', rune_id: '2584614:140', rune_divisibility: 2, rune_symbol: '^' },
      { rune_name: 'MOON•THE•MOON', rune_id: '2587737:194', rune_divisibility: 9, rune_symbol: '😀' },
      { rune_name: 'MAKE•BITCOIN•MAGICAL•AGAIN', rune_id: '2585371:62', rune_divisibility: 0, rune_symbol: '🧙' },
    ];

    // admin have to add runes first

    for (let rune of runesList) {
      const added_runes = await talosActor.admin_add_runes({
        runes_status: { Active: null },
        min_stake: BigInt(10),
        ...rune,
      });
      console.log({ added_runes });
    }

    // user comes in, register
    // let userIdentity = Secp256k1KeyIdentity.generate();
    // let userActor = await getActor<talosService>(
    //   // use credential identity, owner of canister
    //   userIdentity,
    //   // use idlFactory from generated file
    //   talosIDL,
    //   // get canister ID for 'talos', `configs/talos.json` is generated
    //   getCanisterId('talos')!,
    // );

    // const pubkey = Buffer.from('02afee55a2cdcb6c47a593d629b04e13399354d348a3d84ad19310e2b6396e7237', 'hex');
    // const xonly = Array.from(pubkey.slice(0, 32));
    // const hash160 = Array.from(bitcoin.crypto.hash160(pubkey));

    // const registered = await userActor.user_register('tb1pv8cz8vvj2s95pdzeax4x9tkuawr5um49n9er6gd2wf6wthwrh6ysqnkcq9', {
    //   hash160,
    //   xonly,
    //   pubkey: Array.from(pubkey),
    // });

    // // user can create runes order now
    // const createdOrder = await userActor.create_runes_order({
    //   lock_time: 100,
    //   amount: BigInt(100),
    //   rune_id,
    //   oracle_ts: BigInt(123),
    // });
    // console.log({ createdOrder });

    // const userRunesOrders = await userActor.get_user_all_runes_orders([]);
    // console.log({ userRunesOrders });

    // // admin remove order
    // const removeOrderAction = await talosActor.admin_remove_order((createdOrder as any).Ok);
    // console.log({ removeOrderAction });

    // // admin remove runes
    // const removeRunesAction = await talosActor.admin_remove_runes(rune_id);
    // console.log({ removeRunesAction });

    // // admin remove user
    // const removeUserAction = await talosActor.admin_remove_user_by_address('tb1pv8cz8vvj2s95pdzeax4x9tkuawr5um49n9er6gd2wf6wthwrh6ysqnkcq9');
    // console.log({ removeUserAction });
  });
  test.skip('create_staking_wallet', async () => {
    const key = 'test_key_1';
    const user_btc_address = 'tb1pv8cz8vvj2s95pdzeax4x9tkuawr5um49n9er6gd2wf6wthwrh6ysqnkcq9';
    const wallet_1 = await walletActor.create_staking_wallet({
      key,
      user_principal: identity().getPrincipal(),
      user_btc_address,
      stake_target: { CoreDao: null },
      order_id: Array.from([0, 0, 0, 0]),
    });

    if (hasOwnProperty(wallet_1, 'Ok')) {
      console.log(wallet_1.Ok);
    } else {
      console.log(wallet_1.Err);
    }

    const wallet_2 = await walletActor.create_staking_wallet({
      key,
      user_principal: identity().getPrincipal(),
      user_btc_address,
      stake_target: { Babylon: null },
      order_id: Array.from([0, 0, 0, 1]),
    });

    if (hasOwnProperty(wallet_2, 'Ok')) {
      console.log(wallet_2.Ok);
    } else {
      console.log(wallet_2.Err);
    }

    const wallets = await walletActor.get_staking_wallet_by_btc_address(user_btc_address);
    console.log(wallets);
  });

  test.skip('try sign core dao', async () => {
    // txid :de5a1ff78a745a47b1fcd65655eee63aa21da5f7f16aba7840fab95bf27985fe;
    // vout : 0
    const wallet_id = Buffer.from([
      173, 49, 241, 232, 107, 112, 160, 123, 20, 82, 113, 194, 118, 117, 80, 66, 225, 71, 212, 244, 31, 55, 109, 14, 164, 10, 38, 141, 103, 250, 224,
      253,
    ]).toString('hex');

    // const tx = await walletActor.create_core_dao_tx({
    //   key_string: 'test_key_1',
    //   stake_amount: BigInt(1000),
    //   stake_lock_time: Math.floor(Date.now() / 1000) + 60 * 5,
    //   wallet_id,
    //   txid: 'de5a1ff78a745a47b1fcd65655eee63aa21da5f7f16aba7840fab95bf27985fe',
    //   vout: 0,
    //   value: BigInt(10000),
    //   export_psbt: true,
    // });

    const txUnlock = await walletActor.create_core_dao_tx_unlock({
      key_string: 'test_key_1',
      stake_amount: BigInt(1000),
      stake_lock_time: 1723365747,
      chain_id: 1112,
      delegator: '0x0000000000000000000000000000000000000000',
      validator: '0x0000000000000000000000000000000000000000',
      wallet_id,
      reveal_fee: BigInt(300),
      txid: 'fb283002b8862a11e891a40f26e4ec1f5d60708b7e5b7de144c12e65b054a411',
      vout: 1,
      value: BigInt(700),
      export_psbt: true,
    });
    if (hasOwnProperty(txUnlock, 'Ok')) {
      console.log(txUnlock.Ok);
    } else {
      console.log(txUnlock.Err);
    }

    // if (hasOwnProperty(tx, 'Ok')) {
    //   console.log(tx.Ok);
    //   const list = tx.Ok;
    //   for (let i = 0; i < list.length; i++) {
    //     console.log({ i });
    //     const { tx_hex, psbt_b64 } = list[i];
    //     const mergedPsbt = bitcoin.Psbt.fromBase64(psbt_b64[0]!);

    //     mergedPsbt.data.inputs.forEach((input, index) => {
    //       console.log(input);
    //     });
    //     const s = mergedPsbt.validateSignaturesOfAllInputs((p, m, s) => {
    //       console.log({ pub: p.toString('hex'), message: m.toString('hex'), signature: s.toString('hex') });
    //       const res = verify(m, p, s);
    //       console.log(res);
    //       return res;
    //     });
    //     console.log(s);
    //   }
    // } else {
    //   console.log(tx.Err);
    // }
  });

  test.skip('omg1', async () => {
    const b64 =
      'cHNidP8BALoBAAAAAf6FefJbufpAeLpq8felHaI65u5VVtb8sUdadIr3H1reAAAAAAD9////AgAAAAAAAAAAU2pMUFNBVCsBAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQRzebhmsXV2qRSSZOXs3zVgKWbE/Kp3N6Vfc4sn64is6AMAAAAAAAAiACCpASGS4+hZQRJfsysYocl3zh2cSGUSPNXOdM5fVeG8rAAAAAAAAQEfECcAAAAAAAAWABSSZOXs3zVgKWbE/Kp3N6Vfc4sn6yICAwLZLtfFsEKDiK3h5cUqishRSQW47TIWvGfjNj9V/aiPSDBFAiEAv6I2OGGzsTmX7UrLFUG0oxo7/zNC3XvXzYBI4la4foQCIAz1gawD4kCEuH5r80f3HAkORr8L5KQcyYSFT3oNcdCwAQEDBAEAAAABCGwCSDBFAiEAv6I2OGGzsTmX7UrLFUG0oxo7/zNC3XvXzYBI4la4foQCIAz1gawD4kCEuH5r80f3HAkORr8L5KQcyYSFT3oNcdCwASEDAtku18WwQoOIreHlxSqKyFFJBbjtMha8Z+M2P1X9qI8AAAA=';
    const expectedTx =
      '01000000000101fe8579f25bb9fa4078ba6af1f7a51da23ae6ee5556d6fcb1475a748af71f5ade0000000000fdffffff020000000000000000536a4c505341542b0100010000000000000000000000000000000000000000000000000000000000000000000000000000000001047379b866b17576a9149264e5ecdf35602966c4fcaa7737a55f738b27eb88ace803000000000000220020a9012192e3e85941125fb32b18a1c977ce1d9c4865123cd5ce74ce5f55e1bcac02483045022100bfa2363861b3b13997ed4acb1541b4a31a3bff3342dd7bd7cd8048e256b87e8402200cf581ac03e24084b87e6bf347f71c090e46bf0be4a41cc984854f7a0d71d0b001210302d92ed7c5b0428388ade1e5c52a8ac8514905b8ed3216bc67e3363f55fda88f00000000';

    const mergedPsbt = bitcoin.Psbt.fromBase64(b64);

    mergedPsbt.data.inputs.forEach((input, index) => {
      console.log(input);
      console.log(input.finalScriptWitness!.toString('hex'));
      delete input.finalScriptWitness;
      delete input.redeemScript;
      // input.sighashType = 1;
    });

    mergedPsbt.finalizeAllInputs();
    console.log('after finalize');
    mergedPsbt.data.inputs.forEach((input, index) => {
      console.log(input);
    });

    const tx = mergedPsbt.extractTransaction();
    console.log(tx.toHex());
    console.log(expectedTx);
    console.log(tx.toHex() === expectedTx);
  });
  test.skip('omg2', async () => {
    const b64 =
      'cHNidP8BAFICAAAAARGkVLBlLsFE4X1bfotwYF0f7OQmD6SR6BEqhrgCMCj7AQAAAAD+////AbwCAAAAAAAAFgAUkmTl7N81YClmxPyqdzelX3OLJ+tzebhmAAEBK+gDAAAAAAAAIgAgqQEhkuPoWUESX7MrGKHJd84dnEhlEjzVznTOX1XhvKwiAgMC2S7XxbBCg4it4eXFKorIUUkFuO0yFrxn4zY/Vf2oj0cwRAIgY3xx1AmGRNdrGDgD3C1U14ztd9W7X4Y547kF/CbX6x0CIDqJ681xyvKUX8XUf2AH+JanlcHPOxC9TsjmHqxWx5UxAQEDBAEAAAABBSAEc3m4ZrF1dqkUkmTl7N81YClmxPyqdzelX3OLJ+uIrAEIjANHMEQCIGN8cdQJhkTXaxg4A9wtVNeM7XfVu1+GOeO5Bfwm1+sdAiA6ievNccrylF/F1H9gB/iWp5XBzzsQvU7I5h6sVseVMQEhAwLZLtfFsEKDiK3h5cUqishRSQW47TIWvGfjNj9V/aiPIARzebhmsXV2qRSSZOXs3zVgKWbE/Kp3N6Vfc4sn64isAAA=';
    const expectedTx =
      '0200000000010111a454b0652ec144e17d5b7e8b70605d1fece4260fa491e8112a86b8023028fb0100000000feffffff01bc020000000000001600149264e5ecdf35602966c4fcaa7737a55f738b27eb034730440220637c71d4098644d76b183803dc2d54d78ced77d5bb5f8639e3b905fc26d7eb1d02203a89ebcd71caf2945fc5d47f6007f896a795c1cf3b10bd4ec8e61eac56c7953101210302d92ed7c5b0428388ade1e5c52a8ac8514905b8ed3216bc67e3363f55fda88f20047379b866b17576a9149264e5ecdf35602966c4fcaa7737a55f738b27eb88ac7379b866';

    const mergedPsbt = bitcoin.Psbt.fromBase64(b64);

    mergedPsbt.data.inputs.forEach((input, index) => {
      console.log(input);
      console.log(input.finalScriptWitness!.toString('hex'));
      delete input.finalScriptWitness;
      input.sighashType = 1;
    });

    const finalizeInput = (_inputIndex: number, input: any) => {
      const redeemPayment = bitcoin.payments.p2wsh({
        redeem: {
          input: bitcoin.script.compile([input.partialSig[0].signature, input.partialSig[0].pubkey]),
          output: input.witnessScript,
        },
      });

      const finalScriptWitness = witnessStackToScriptWitness(redeemPayment.witness ?? []);
      console.log({
        finalScriptWitness: finalScriptWitness.toString('hex'),
        redeemPayment: redeemPayment.witness?.map(d => d.toString('hex')),
      });

      return {
        finalScriptSig: Buffer.from(''),
        finalScriptWitness,
      };
    };

    mergedPsbt.finalizeInput(0, finalizeInput);
    console.log('after finalize');
    mergedPsbt.data.inputs.forEach((input, index) => {
      console.log(input);
    });
    mergedPsbt.txInputs.forEach((txInput, index) => {
      console.log(txInput);
    });

    const tx = mergedPsbt.extractTransaction();
    console.log(tx);
    console.log(tx.toHex());
    console.log(expectedTx);
  });

  test.skip('omg3', async () => {
    const tx =
      '02000000000102b4b8882e3b5de87b7731d94042cf9fb74766cd9f542d80813418bf98f7615f070000000000feffffff766c27a585648749cf57bcac92fb38b4eec395cea9dcdb8982e96278c714dc2c0100000000feffffff022202000000000000225120cf6c49f125fc865199771ac8d022af69eb632f28102114f72ce0dd81c617557e0315e30500000000225120cf6c49f125fc865199771ac8d022af69eb632f28102114f72ce0dd81c617557e0348304502210084d199d00114749f088dae432d320c1448e7bba2df6da1cae8053fc2d87df780022045cf43d892986f2e252548278f99c96e9125506ff086fdae76fe2ce0199ee5c2012103ef8ff237474b31bd315cf561356fd943507572f479b68962466017105912dcf720046a94a466b17576a91414906c96c9c1ee97e2457f3ab9f80757075d78df88ac01405cfd73dd2176f33104ab9c0f362ca68bb384afa714aff1fd5fabfc0a34be8b3d3979f86fabaf6bacad1fe974866db6bdaa31b3dd00f3668d4f599edafefa4e536a94a466';
    const txRaw = bitcoin.Transaction.fromHex(tx);
    txRaw.ins.forEach((input, index) => {
      console.log(input.witness[0].toString('hex'));
      console.log(input.witness[1].toString('hex'));
      console.log(input.witness[2].toString('hex'));
    });
  });
});
