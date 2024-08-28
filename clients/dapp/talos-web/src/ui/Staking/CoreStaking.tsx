import {
  useLoading,
  useMempoolApi,
  useMessage,
  useTalosActor,
  useTalosWalletActor,
  useWalletProvider,
  WalletBalance,
} from '../../hook';
import React, { Fragment, useEffect, useMemo, useReducer, useState } from 'react';
import { Button, Divider, InputNumber, Modal, Spin, Tooltip } from 'antd';
import BigNumber from 'bignumber.js';
import { Prices } from '@wizz-btc/api';
import FeeRateSelector from '../../component/FeeRateSelector.tsx';
import RainbowConnectButton from '../../component/RainbowConnectButton.tsx';
import { DUST_AMOUNT, getAddressType, Output, toPsbt, TxOk, UTXO } from '@wizz-btc/wallet';
import { CloseOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { STAKING_DURATIONS } from './consts.ts';
import { Psbt } from 'bitcoinjs-lib';
import { useAccount } from 'wagmi';
import TxModal from './TxModal.tsx';
import { UserStakedBTC } from '../../canister/talos/talos';

interface Props {
  balance: WalletBalance;
  prices?: Prices;
}


export default function CoreStaking({ balance, prices }: Props) {
  const account = useAccount();
  const provider = useWalletProvider();
  const [r, refresh] = useReducer((x) => x + 1, 0);
  const [v, forceUpdate] = useReducer((x) => x + 1, 0);
  const maxValue = useMemo(() => {
    return new BigNumber(balance.regularValue).div(1e8).toFixed();
  }, [balance.regularValue]);
  const [inputAmount, setInputAmount] = useState('');
  const [amountFoucs, setAmountFoucs] = useState(false);
  const usd = useMemo(() => {
    if (!inputAmount || !prices) {
      return;
    }
    try {
      const value = new BigNumber(inputAmount).multipliedBy(prices.USD);
      if (!value.isNaN()) {
        return value.toNumber().toLocaleString('en-US', { maximumFractionDigits: 2 });
      }
    } catch (e) {
      console.log(e);
    }
  }, [inputAmount, prices]);
  const inputSats = useMemo(() => {
    try {
      const value = new BigNumber(inputAmount).multipliedBy(1e8);
      if (value.isInteger()) {
        return value.toNumber();
      }
    } catch (e) {
      console.log(e);
    }
  }, [inputAmount]);
  const [fullLoading, fullPlus, fullMinus] = useLoading();
  const [feeRate, setFeeRate] = useState<number>();
  const [duration, setDuration] = useState<number>(STAKING_DURATIONS[0].value);
  const [errMsg, setErrMsg] = useState<string>();
  const message = useMessage();
  const [txids, setTxids] = useState<string[]>();
  const [txOk, setTxOk] = useState<TxOk & {
    commitFee: number;
    revealFee: number;
    commitAmount: number;
    stakeAmount: number;
    totalFee: number;
  }>();
  useEffect(() => {
    setErrMsg(undefined);
    setTxOk(undefined);
    if (!feeRate || !inputSats || !balance.principal || !balance.publicKey || !account?.address) {
      return;
    }
    const commitFee = Math.ceil(feeRate * (10.5 + 68 + 43 + 83 + 9));
    const revealFee = Math.ceil(feeRate * (10.5 + 76.5 + 43));
    const calcFee = (inputNum: number, hasChange: boolean = false) => {
      const changeFee = hasChange ? 43 : 0;
      return Math.ceil(feeRate * (10.5 + 57.5 * inputNum + 31 + changeFee));
    };
    const outputNeed = inputSats + commitFee;
    let inputs: UTXO[] = [];
    let outputs: Output[] = [{
      address: balance.address,
      value: outputNeed,
    }];
    let inputValue = 0;
    let fee = 0;
    if (inputSats == balance.regularValue) {
      inputs = balance.regularUTXOs;
      inputValue = balance.regularValue;
      fee = calcFee(inputs.length, false);
      const value = balance.regularValue - fee;
      if (value < DUST_AMOUNT) {
        setErrMsg('Insufficient balance');
        return;
      }
      outputs = [{
        address: balance.address,
        value: value,
      }];
    } else {
      let ok = false;
      for (const utxo of balance.regularUTXOs) {
        inputs.push(utxo);
        inputValue += utxo.value;
        fee = calcFee(inputs.length, false);
        const r = inputValue - outputNeed - fee;
        if (r >= 0) {
          if (r > DUST_AMOUNT) {
            fee = calcFee(inputs.length, true);
            const change = inputValue - outputNeed - fee;
            if (change >= DUST_AMOUNT) {
              outputs.push({
                address: balance.address,
                value: change,
              });
            }
          }
          ok = true;
          break;
        }
      }
      if (!ok) {
        setErrMsg('Insufficient balance');
        return;
      }
    }
    const commitAmount = outputs[0].value;
    const stakeAmount = commitAmount - commitFee;
    if (stakeAmount - revealFee < DUST_AMOUNT) {
      setErrMsg('Stake amount is too low');
      return;
    }
    const [addressType, network] = getAddressType(balance.address);
    const tx = {
      address: balance.address,
      addressType,
      fee,
      feeRate,
      inputs,
      network,
      outputs,
      weight: 0,
      commitFee,
      revealFee,
      commitAmount,
      stakeAmount,
      totalFee: fee + commitFee,
    };
    console.log(tx);
    setTxOk(tx);
  }, [account?.address, balance.address, balance.principal, balance.publicKey, balance.regularUTXOs, balance.regularValue, feeRate, inputSats]);
  const [withdrawTs, setWithdrawTs] = useState<number>(Math.ceil(Date.now() / 1000 + duration));
  useEffect(() => {
    const refresh = () => {
      setWithdrawTs(Math.ceil(Date.now() / 1000 + duration));
    };
    refresh();
    const id = setInterval(refresh, 1000 * 10);
    return () => {
      clearInterval(id);
    };
  }, [duration]);

  const talosActor = useTalosActor();
  const talosWalletActor = useTalosWalletActor();

  const orders = useMemo(() => new Map<string, UserStakedBTC[]>(), []);
  const useKey = `${balance.address}-${balance.network.type}`;
  const userOrders = useMemo(() => orders.get(useKey) || [], [orders, useKey, v]);

  const [ordersLoading, ordersPlus, ordersMinus] = useLoading();
  useEffect(() => {
    ordersPlus();
    talosActor.get_user_btc_order().then((v) => {
      if ('Ok' in v) {
        const list = v.Ok.sort((a, b) => {
          return a.stake_payload.lock_time - b.stake_payload.lock_time;
        });
        const locked = [];
        const unlocked = [];
        for (const order of list) {
          if ('Locking' in order.status) {
            locked.push(order);
          } else {
            unlocked.push(order);
          }
        }
        orders.set(useKey, [...locked, ...unlocked]);
        forceUpdate();
      }
    }).finally(() => {
      ordersMinus();
    });
  }, [talosActor, r, orders, useKey, ordersPlus, ordersMinus]);
  const [tsOffset, setTsOffset] = useState<number>();
  const mempoolApi = useMempoolApi();
  useEffect(() => {
    const locking = userOrders.filter((e) => 'Locking' in e.status);
    if (locking.length) {
      const controller = new AbortController();
      mempoolApi.getLast10Blocks({ signal: controller.signal }).then(([, blocks]) => {
        if (blocks?.length) {
          setTsOffset(blocks[0].timestamp - blocks[0].mediantime);
        }
      });
      return () => {
        controller.abort();
      };
    }
  }, [mempoolApi, userOrders, balance.height]);

  const firstOrder = useMemo(() => {
    if (!userOrders?.length) {
      return;
    }
    for (const userOrder of userOrders) {
      if ('Locking' in userOrder.status) {
        return userOrder;
      }
    }
    return userOrders[0];
  }, [userOrders]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const handleStaking = async () => {
    fullPlus();
    try {
      const tx = txOk!;
      console.log(tx);
      const amount = BigInt(tx.stakeAmount);
      const lockTime = withdrawTs;
      const createRes = await talosActor.create_btc_order({
        amount: amount,
        target: {
          CoreDao: null,
        },
        lock_time: lockTime,
      });
      if ('Err' in createRes) {
        message.error(createRes.Err);
        return;
      }

      const wallet = createRes.Ok.staking_wallet[0]!;
      const stakeAddress = wallet.stake_address;
      tx.outputs[0] = {
        address: stakeAddress,
        value: tx.outputs[0].value,
      };
      const psbt = toPsbt({ tx, pubkey: balance.publicKey!, rbf: false });
      const signPsbt = await provider?.signPsbt(psbt.toHex());
      const transaction = Psbt.fromHex(signPsbt!).extractTransaction(true);
      console.log(transaction.toHex());
      const txRes = await talosWalletActor.create_core_dao_tx({
        key_string: 'test_key_1',
        value: BigInt(tx.commitAmount),
        chain_id: account.chainId!,
        validator: '0x3aE030Dc3717C66f63D6e8f1d1508a5C941ff46D'.substring(2),
        delegator: account.address!.substring(2),
        txid: transaction.getId(),
        vout: 0,
        stake_amount: BigInt(tx.stakeAmount),
        stake_lock_time: lockTime,
        wallet_id: Buffer.from(wallet.bytes).toString('hex'),
        export_psbt: false,
        reveal_fee: BigInt(tx.revealFee),
      });
      if ('Err' in txRes) {
        message.error(txRes.Err);
        return;
      }

      const commitTx = txRes.Ok.signed_tx_commit;
      const txHex = commitTx.tx_hex;
      const txid1 = await provider?.pushTx(transaction.toHex());
      console.log(txid1);
      const txid2 = await provider?.pushTx(txHex);
      await talosActor.set_btc_order_status(createRes.Ok.order_id, {
        Locking: null,
      });
      refresh();
      console.log(txid1, txid2);
      setTxids([txid2!]);
      fetch('https://stake-core-api.wizz.cash/api/staking/submit_delegate_btc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'btcTxId': txid2,
          'script': Buffer.from(txRes.Ok.redeem_script).toString('hex'),
        }),
      });
    } catch (e) {
      console.log(e);
      message.error(e?.message || 'Failed to stake');
    } finally {
      fullMinus();
    }
  };
  const handleUnstaking = async (item: UserStakedBTC) => {
    console.log(item);
    fullPlus();
    try {
      const stakeParams = item.stake_params[0]!;
      const txRes = await talosWalletActor.create_core_dao_tx_unlock({
        chain_id: stakeParams.chain_id,
        delegator: stakeParams.delegator,
        export_psbt: false,
        reveal_fee: stakeParams.reveal_fee,
        stake_amount: stakeParams.stake_amount,
        stake_lock_time: stakeParams.stake_lock_time,
        txid: stakeParams.txid,
        validator: stakeParams.validator,
        value: stakeParams.value,
        vout: stakeParams.vout,
        wallet_id: stakeParams.wallet_id,
        key_string: 'test_key_1',
      });
      if ('Err' in txRes) {
        message.error(txRes.Err);
        return;
      }
      const txHex = txRes.Ok.tx_hex;
      const txid = await provider?.pushTx(txHex);
      console.log(txid);
      await talosActor.set_btc_order_status(Buffer.from(stakeParams.order_id).toString('hex'), {
        Unlocked: null,
      });
      setTxids([txid!]);
      refresh();
    } catch (e) {
      message.error(e?.message || 'Failed to unstake');
    } finally {
      fullMinus();
    }
  };
  return <>
    <div className={'text-end px-2'}><RainbowConnectButton /></div>
    <div className={'p-2 rounded-[24px] talos-bg-card inline-flex flex-col gap-1 relative shadow-sm mt-2'}>
      <div
        className={`talos-bg-surface rounded-[16px] p-4 flex flex-col gap-2 box-content border border-solid ${amountFoucs ? 'border-primary' : 'border-transparent'}`}>
        <div className={'flex items-center gap-2'}>
          <div className={'text-soft text-xs flex-1'}>Staking BTC</div>
          <Button className={'rounded-3xl !pl-1 !pr-1.5 text-xs gap-1'} size={'small'}>
            <img src={balance.network.icon} alt={balance.network.type}
                 className={'w-4 h-4'} />{balance.network.symbol}
          </Button>
        </div>
        <div className={'flex items-center gap-4'}>
          <InputNumber
            className={'flex-1 font-bold text-3xl -ml-2.5'}
            placeholder={'0.00000000'}
            controls={false}
            autoFocus={true}
            onFocus={() => {
              setAmountFoucs(true);
            }}
            onBlur={() => {
              setAmountFoucs(false);
            }}
            variant={'borderless'} size={'large'} stringMode={true} precision={8} max={maxValue}
            min={'0.00001000'} value={inputAmount} onChange={(e) => {
            setInputAmount(e as any);
          }} />
        </div>
        <div className={'flex items-center justify-between gap-2'}>
          <div className={'text-xs text-soft'}>{
            usd ?
              <>~ ${usd}</>
              : null
          }</div>
          <Button size={'small'} className={'rounded-3xl text-primary'} type={'dashed'} onClick={() => {
            setInputAmount(maxValue);
          }}>Max</Button>
        </div>
      </div>
    </div>
    <div className={'mt-2 px-4'}>
      <div className={'text-soft text-xs flex-1'}>Staking Duration</div>
      <div className={'flex flex-wrap gap-2 mt-2'}>{
        STAKING_DURATIONS.map((e) => {
          const selected = e.value == duration;
          return <Button onClick={() => {
            setDuration(e.value);
          }} size={'small'} type={selected ? 'primary' : undefined} className={'text-xs rounded-3xl'}
                         key={e.value}>{e.label}</Button>;
        })
      }
      </div>
    </div>
    <FeeRateSelector className={'mt-2 shadow-sm'} onChange={(v) => {
      setFeeRate(v);
    }} />
    <div className={'text-xs px-4 flex flex-col gap-2 mt-2'}>
      {
        withdrawTs ?
          <div className={'flex items-center justify-between'}>
            <div className={'text-soft'}>Withdraw Time</div>
            <div>{dayjs(withdrawTs * 1000).format('lll')}</div>
          </div> : null
      }
      {
        inputSats ?
          <div className={'flex items-center justify-between'}>
            <div className={'text-soft'}>Staking BTC</div>
            <div>{((txOk?.stakeAmount || inputSats) / 1e8).toLocaleString('en-US', {
              maximumFractionDigits: 8,
              minimumFractionDigits: 8,
            })}
              {' '}<span className={'text-soft'}>BTC</span>
            </div>
          </div> : null
      }
      {
        txOk?.totalFee ?
          <div className={'flex items-center justify-between'}>
            <div className={'text-soft'}>Network Fee</div>
            <div>{((txOk.totalFee) / 1e8).toLocaleString('en-US', {
              maximumFractionDigits: 8,
              minimumFractionDigits: 8,
            })}
              {' '}<span className={'text-soft'}>BTC</span>
            </div>
          </div> : null
      }
      {
        txOk?.totalFee && inputSats ?
          <>
            <Divider className={'!my-0'} />
            <div className={'flex items-center justify-between'}>
              <div className={'text-soft'}>Total</div>
              <div>{((txOk.totalFee + inputSats) / 1e8).toLocaleString('en-US', {
                maximumFractionDigits: 8,
                minimumFractionDigits: 8,
              })}
                {' '}<span className={'text-soft'}>BTC</span>
              </div>
            </div>
          </> : null
      }
    </div>
    {
      errMsg ? <div className={'flex items-center gap-2 bg-orange-700 rounded-3xl py-2 px-4 mx-4 mt-4 text-xs'}>
        <ExclamationCircleOutlined />{errMsg}
      </div> : null
    }
    <Button
      loading={balance.loading}
      onClick={handleStaking}
      disabled={!txOk?.fee} size={'large'} type={'primary'} className={'rounded-3xl mx-2 mt-6'}>Staking
      Now</Button>
    {
      firstOrder ?
        <div className={'talos-bg-card rounded-[24px] p-2 overflow-hidden shadow-sm mt-4'}>
          <div className={'flex items-center px-2'}>
            <div className={'text-soft text-xs flex-1'}>Staking History (<span
              className={'text-primary'}>{userOrders.length.toLocaleString('en-US')}</span>)
            </div>
            {
              userOrders.length > 1 ?
                <Button className={'text-primary text-xs rounded-3xl'} size={'small'} type={'text'} onClick={() => {
                  setShowHistoryModal(true);
                }}>More</Button> : null
            }
            <Spin size={'small'} spinning={ordersLoading} />
          </div>
          <div className={'talos-bg-surface rounded-[16px] p-2 mt-1'}>
            {(() => {
              const order = firstOrder;
              const time = dayjs(Math.ceil(new BigNumber(order.create_time.toString(10)).div(1e6).toNumber())).format('lll');
              const stakeAmount = (Number(order.stake_amount.toString(10)) / 1e8).toLocaleString('en-US', {
                maximumFractionDigits: 8,
                minimumFractionDigits: 8,
              });
              const isUnlocked = 'Unlocked' in order.status;
              const status = 'Locking' in order.status ? 'Locking' : isUnlocked ? 'Unlocked' : 'Created';
              const lockTime = (order.stake_payload.lock_time + (tsOffset || 0)) * 1000;
              const redeemable = lockTime < Date.now();
              const lockTimeObj = dayjs(lockTime);
              const formated = lockTimeObj.format('lll');
              return <>
                <div className={'flex items-center justify-between'}>
                  <div className={'flex items-center'}>
                    <div className={'font-bold'}>{stakeAmount} <span className={'text-soft'}>BTC</span></div>
                    <Button size={'small'} type={isUnlocked ? 'primary' : 'dashed'}
                            className={`text-xs rounded-3xl ml-2 ${isUnlocked ? 'bg-green-500' : 'text-primary'}`}
                            style={{
                              transform: 'scale(0.72)',
                              transformOrigin: 'left center',
                            }}>{status}</Button>
                  </div>
                  {
                    isUnlocked ? null :
                      (() => {
                        const btn = <Button onClick={() => handleUnstaking(order)} size={'small'}
                                            disabled={!redeemable}
                                            className={'text-xs rounded-3xl'}
                                            type={'primary'}>Redeem</Button>;
                        if (redeemable) {
                          return btn;
                        } else {
                          return <Tooltip
                            title={`BTC staking can be redeemed ${dayjs(lockTime).fromNow()}.`}>{btn}</Tooltip>;
                        }
                      })()
                  }
                </div>
                <div className={'flex items-center text-[10px] justify-between mt-1 text-soft'}>
                  <div>{time}</div>
                  <div>{formated}</div>
                </div>
              </>;
            })()}
          </div>
        </div>
        : null
    }
    <Spin fullscreen={true} spinning={fullLoading && !showHistoryModal} />
    <TxModal txids={txids} onClose={() => {
      setTxids(undefined);
    }} />
    <Modal
      onCancel={() => {
        setShowHistoryModal(false);
      }}
      styles={{
        content: {
          padding: '0',
          borderRadius: '24px',
          background: 'transparent',
        },
      }}
      centered={true} destroyOnClose={true} open={showHistoryModal} closeIcon={null} footer={null}
    >
      <Spin spinning={fullLoading}>
        <div className={'talos-bg-card rounded-[24px] p-2 mt-2'}>
          <div className={'flex items-center px-2'}>
            <div className={'text-lg font-bold flex-1'}>Staking History (<span
              className={'text-primary'}>{userOrders.length.toLocaleString('en-US')}</span>)
            </div>
            <Button shape={'circle'} type={'primary'} onClick={() => {
              setShowHistoryModal(false);
            }}><CloseOutlined /></Button>
          </div>
          <div className={'talos-bg-surface rounded-[16px] p-2 mt-2'}>
            {userOrders.map((order, index) => {
              const time = dayjs(Math.ceil(new BigNumber(order.create_time.toString(10)).div(1e6).toNumber())).format('lll');
              const stakeAmount = (Number(order.stake_amount.toString(10)) / 1e8).toLocaleString('en-US', {
                maximumFractionDigits: 8,
                minimumFractionDigits: 8,
              });
              const isUnlocked = 'Unlocked' in order.status;
              const status = 'Locking' in order.status ? 'Locking' : isUnlocked ? 'Unlocked' : 'Created';
              const lockTime = (order.stake_payload.lock_time + (tsOffset || 0)) * 1000;
              const redeemable = lockTime < Date.now();
              const lockTimeObj = dayjs(lockTime);
              const formated = lockTimeObj.format('lll');
              return <Fragment key={order.create_time}>
                {index > 0 ? <Divider className={'!my-2'} /> : null}
                <div>
                  <div className={'flex items-center justify-between'}>
                    <div className={'flex items-center'}>
                      <div className={'font-bold'}>{stakeAmount} <span className={'text-soft'}>BTC</span></div>
                      <Button size={'small'} type={isUnlocked ? 'primary' : 'dashed'}
                              className={`text-xs rounded-3xl ml-2 ${isUnlocked ? 'bg-green-500' : 'text-primary'}`}
                              style={{
                                transform: 'scale(0.72)',
                                transformOrigin: 'left center',
                              }}>{status}</Button>
                    </div>
                    {
                      isUnlocked ? null :
                        (() => {
                          const btn = <Button onClick={() => handleUnstaking(order)} size={'small'}
                                              disabled={!redeemable}
                                              className={'text-xs rounded-3xl'}
                                              type={'primary'}>Redeem</Button>;
                          if (redeemable) {
                            return btn;
                          } else {
                            return <Tooltip
                              title={`BTC staking can be redeemed ${dayjs(lockTime).fromNow()}.`}>{btn}</Tooltip>;
                          }
                        })()
                    }
                  </div>
                  <div className={'flex items-center text-[10px] justify-between mt-1 text-soft'}>
                    <div>{time}</div>
                    <div>{formated}</div>
                  </div>
                </div>
              </Fragment>;
            })}
          </div>
        </div>
      </Spin>
    </Modal>
  </>
    ;
}