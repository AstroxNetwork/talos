import { idlFactory as talosIDL } from '@/idls/talos.idl';
import { _SERVICE as talosService } from '@/idls/talos';
import { getCanisterId, getActor, identity } from '@ego-js/utils';
import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';

describe('talos', () => {
  let talosActor: ActorSubclass<talosService>;
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
    await talosActor.admin_add_setting({
      oracles_endpoint: 'https://oracle.wizz.cash',
      staking_wallet_canister: Principal.anonymous(),
      token_canister: Principal.anonymous(),
      lp_rewards_ratio: 0.0001,
    });

    const lp = await talosActor.get_btc_lp_reward(BigInt(1000), BigInt(100000));
    console.log(lp);

    // const who = await talosActor.whoAmI();
    // console.log(who);
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
      rune_id: '1:100',
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
    const price = await talosActor.get_price_from_oracles('840000:3');
    console.log({ price });
  });

  test.skip('create_runes_order', async () => {
    // rune id
    const rune_id = '1:100';

    // admin have to add runes first
    const added_runes = await talosActor.admin_add_runes({
      runes_status: { Active: null },
      min_stake: BigInt(100),
      rune_id,
    });
    console.log({ added_runes });

    // user comes in, register
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

    const registered = await userActor.user_register('tb1pv8cz8vvj2s95pdzeax4x9tkuawr5um49n9er6gd2wf6wthwrh6ysqnkcq9', {
      hash160,
      xonly,
      pubkey: Array.from(pubkey),
    });

    // user can create runes order now
    const createdOrder = await userActor.create_runes_order({
      lock_time: 100,
      amount: BigInt(100),
      rune_id,
      oracle_ts: BigInt(123),
    });
    console.log({ createdOrder });

    const userRunesOrders = await userActor.get_user_all_runes_orders([]);
    console.log({ userRunesOrders });

    // admin remove order
    const removeOrderAction = await talosActor.admin_remove_order((createdOrder as any).Ok);
    console.log({ removeOrderAction });

    // admin remove runes
    const removeRunesAction = await talosActor.admin_remove_runes(rune_id);
    console.log({ removeRunesAction });

    // admin remove user
    const removeUserAction = await talosActor.admin_remove_user_by_address('tb1pv8cz8vvj2s95pdzeax4x9tkuawr5um49n9er6gd2wf6wthwrh6ysqnkcq9');
    console.log({ removeUserAction });
  });
});
