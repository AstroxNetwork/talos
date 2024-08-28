import { useLoading, useMessage, useTalosActor, useWalletProvider, WalletBalance } from '../../hook';
import React, { Fragment, useEffect, useMemo, useReducer, useState } from 'react';
import { Button, Divider, Input, InputNumber, Modal, Spin, Tooltip } from 'antd';
import BigNumber from 'bignumber.js';
import FeeRateSelector from '../../component/FeeRateSelector.tsx';
import { OracleOrder, TalosRunes, UserStakedRunes } from '../../canister/talos/talos';
import { CaretDownOutlined, CloseOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { STAKING_BLOCKS } from './consts.ts';
import IconRunes from '../../assets/icons/runes.svg';
import { RuneValueWithUTXOs } from '@wizz-btc/provider';
import { formatNumberString, formatValue } from '@wizz-btc/helpers';
import { Prices } from '@wizz-btc/api';
import { createOrder, withdrawPsbt } from '../../staking';
import { Psbt } from 'bitcoinjs-lib';
import TxModal from './TxModal.tsx';
import dayjs from 'dayjs';

interface Props {
  balance: WalletBalance;
  prices?: Prices;
}

export default function TalosStaking({ balance, prices }: Props) {
  const [r, refresh] = useReducer((x) => x + 1, 0);
  const [v, forceUpdate] = useReducer((x) => x + 1, 0);
  const provider = useWalletProvider();
  const talosActor = useTalosActor();
  const [runeList, setRuneList] = useState<TalosRunes[]>();
  const [selectedRune, setSelectedRune] = useState<(RuneValueWithUTXOs & TalosRunes)>();
  const [runeLoading, runePlus, runeMinus] = useLoading();
  const [inputAmount, setInputAmount] = useState('');
  const [amountFoucs, setAmountFoucs] = useState(false);
  const inputRuneValue = useMemo(() => {
    try {
      if (!selectedRune) {
        return;
      }
      const value = new BigNumber(inputAmount).multipliedBy(new BigNumber(10).pow(selectedRune.divisibility));
      if (value.isInteger()) {
        return BigInt(value.toFixed());
      }
    } catch (e) {
      console.log(e);
    }
  }, [inputAmount, selectedRune]);
  const maxValue = useMemo(() => {
    if (!selectedRune) {
      return;
    }
    return new BigNumber(selectedRune.rune_value.toString(10)).dividedBy(new BigNumber(10).pow(selectedRune.divisibility)).toFixed();
  }, [selectedRune]);
  const minValue = useMemo(() => {
    if (!selectedRune) {
      return;
    }
    return new BigNumber(selectedRune.min_stake.toString(10)).dividedBy(new BigNumber(10).pow(selectedRune.divisibility)).toFixed();
  }, [selectedRune]);
  useEffect(() => {
    runePlus();
    talosActor.get_rune_list().then((v) => {
      setRuneList(v);
    }).finally(() => {
      runeMinus();
    });
  }, [runeMinus, runePlus, talosActor]);
  const [oracleOrder, setOracleOrder] = useState<OracleOrder>();
  useEffect(() => {
    if (oracleOrder?.token != selectedRune?.rune_id) {
      setOracleOrder(undefined);
    }
    if (!selectedRune) {
      return;
    }
    const refresh = () => {
      talosActor.get_price_from_oracles(selectedRune.rune_id).then((v) => {
        if ('Ok' in v) {
          setOracleOrder(v.Ok);
        }
      });
    };
    refresh();
    const id = setInterval(refresh, 1000 * 60);
    return () => {
      clearInterval(id);
    };
  }, [oracleOrder?.token, selectedRune, talosActor]);
  const usd = useMemo(() => {
    if (!inputAmount || !prices || !oracleOrder) {
      return;
    }
    try {
      const value = new BigNumber(inputAmount).multipliedBy(prices.USD).multipliedBy(oracleOrder.price).dividedBy(1e8);
      if (!value.isNaN()) {
        return value.toNumber().toLocaleString('en-US', { maximumFractionDigits: 2 });
      }
    } catch (e) {
      console.log(e);
    }
  }, [inputAmount, oracleOrder, prices]);
  const [fullLoading, fullPlus, fullMinus] = useLoading();
  const [feeRate, setFeeRate] = useState<number>();
  const [blocks, setBlocks] = useState<number>(STAKING_BLOCKS[0].value);
  const [showModal, setShowModal] = useState(false);
  const [errMsg, setErrMsg] = useState<string>();
  const message = useMessage();
  const [txids, setTxids] = useState<string[]>();
  const [order, setOrder] = useState<ReturnType<typeof createOrder>>();
  const runesMap = useMemo(() => {
    const map = new Map<string, RuneValueWithUTXOs>();
    for (const rune of balance.runes) {
      map.set(rune.rune_id, rune);
    }
    return map;
  }, [balance.runes]);
  useEffect(() => {
    if (runeList?.length && runesMap.size) {
      for (const it of runeList) {
        const v = runesMap.get(it.rune_id);
        if (v) {
          setSelectedRune(Object.assign(v, it));
          return;
        }
      }
    }
  }, [runeList, runesMap]);
  const [keywords, setKeywords] = useState<string>('');
  const filterdRunes = useMemo(() => {
    if (!keywords) {
      return runeList;
    }
    return runeList?.filter((e) => {
      return e.rune_name.replace(/•/g, '').includes(keywords.toUpperCase()) || e.rune_id.includes(keywords);
    });
  }, [keywords, runeList]) || [];
  useEffect(() => {
    setErrMsg(undefined);
    setOrder(undefined);
    if (!feeRate || balance.loading || !selectedRune || !inputRuneValue) {
      return;
    }
    try {
      const order = createOrder({
        balance,
        stakeAmount: inputRuneValue,
        selectedRune,
        feeRate,
        orderId: '00000000',
        lockHeight: blocks + balance.height,
      });
      console.log(order);
      setOrder(order);
    } catch (e) {
      console.error(e);
      setErrMsg(e.message || 'Unknown error');
    }
  }, [balance, blocks, feeRate, inputRuneValue, selectedRune]);


  const orders = useMemo(() => new Map<string, UserStakedRunes[]>(), []);
  const useKey = `${balance.address}-${balance.network.type}`;
  const userOrders = useMemo(() => orders.get(useKey) || [], [orders, useKey, v]);

  const [ordersLoading, ordersPlus, ordersMinus] = useLoading();
  useEffect(() => {
    ordersPlus();
    talosActor.get_user_runes_order().then((v) => {
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
    if (!selectedRune || !oracleOrder || !inputRuneValue || !feeRate) {
      return;
    }
    fullPlus();
    try {
      const lockHeight = blocks + balance.height;
      const orderRes = await talosActor.create_runes_order({
        amount: inputRuneValue, lock_time: lockHeight, oracle_ts: oracleOrder.ts, rune_id: selectedRune.rune_id,
      });
      if ('Err' in orderRes) {
        message.error(orderRes.Err);
        return;
      }
      const orderId = orderRes.Ok.order_id;
      const order = createOrder({
        balance,
        stakeAmount: inputRuneValue,
        selectedRune,
        feeRate,
        orderId: orderId,
        lockHeight: lockHeight,
      });
      const signedPsbt = await provider?.signPsbt(order.psbt.toHex());
      const transaction = Psbt.fromHex(signedPsbt!).extractTransaction(true);
      const txid = await provider?.pushTx(transaction.toHex());
      console.log(txid);
      const setRes = await talosActor.set_user_runes_order_status(orderId, {
        status: {
          Locking: null,
        },
        lock_txid: [txid!],
        unlock_txid: [],
      });
      if ('Err' in setRes) {
        message.error(setRes.Err);
        return;
      }
      setTxids([txid!]);
      refresh();
    } catch (e) {
      message.error(e.message || 'Unknown error');
    } finally {
      fullMinus();
    }
  };
  const handleUnstaking = async (item: UserStakedRunes) => {
    if (!feeRate) {
      return;
    }
    fullPlus();
    try {
      const orderId = Buffer.from(item.stake_payload.id).toString('hex');
      console.log(orderId);
      const { psbt } = withdrawPsbt({
        balance,
        feeRate,
        lockHeight: item.stake_payload.lock_time,
        utxo: {
          txid: item.lock_txid[0]!,
          index: 0,
          value: 546,
        },
        orderId: orderId,
      });
      const signed = await provider?.signPsbt(psbt.toHex(), {
        autoFinalized: true,
        toSignInputs: psbt.data.inputs.map((_, index) => {
          return {
            index: index,
            disableTweakSigner: index == 0,
            publicKey: balance.publicKey!,
            sighashTypes: undefined,
          };
        }),
      });
      const tx = Psbt.fromHex(signed!).extractTransaction(true).toHex();
      console.log(tx);
      const txid = await provider?.pushTx(tx);
      console.log(txid);
      const setRes = await talosActor.set_user_runes_order_status(orderId, {
        status: {
          Unlocked: null,
        },
        unlock_txid: [txid!],
        lock_txid: [],
      });
      if ('Err' in setRes) {
        message.error(setRes.Err);
        return;
      }
      setTxids([txid!]);
      refresh();
    } catch (e) {
      message.error(e?.message || 'Unknown error');
    } finally {
      fullMinus();
    }
  };
  return <>
    <div className={'p-2 rounded-[24px] talos-bg-card inline-flex flex-col gap-1 relative shadow-sm mt-2'}>
      <div
        className={`talos-bg-surface rounded-[16px] p-4 flex flex-col gap-2 box-content border border-solid ${amountFoucs ? 'border-primary' : 'border-transparent'}`}>
        <div className={'flex items-center gap-2'}>
          <div className={'text-soft text-xs flex-1'}>Staking Runes</div>
          <Button disabled={runeLoading} className={'rounded-3xl !pl-1 !pr-1 text-xs'} size={'small'} onClick={() => {
            setShowModal(true);
          }}>
            {
              runeLoading ? <Spin size={'small'} /> : <div className={'flex items-center flex-nowrap gap-1'}>
                <img src={IconRunes} alt={balance.network.type} className={'w-4 h-4'} />
                {selectedRune?.rune_name || 'Select Rune'}
                <CaretDownOutlined />
              </div>
            }
          </Button>
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <InputNumber
            className={'flex-1 font-bold text-3xl -ml-2.5'}
            placeholder={minValue || '0.00000000'}
            controls={false}
            autoFocus={true}
            onFocus={() => {
              setAmountFoucs(true);
            }}
            onBlur={() => {
              setAmountFoucs(false);
            }}
            variant={'borderless'}
            size={'large'}
            stringMode={true}
            precision={selectedRune?.divisibility}
            max={maxValue}
            min={minValue} value={inputAmount} onChange={(e) => {
            setInputAmount(e as any);
          }} />
          <span className={'font-bold text-3xl text-soft'}>{selectedRune?.symbol}</span>
        </div>
        <div className={'flex items-center justify-between gap-2'}>
          <div className={'text-xs text-soft'}>{
            usd ?
              <>~ ${usd}</>
              : null
          }</div>
          <Button disabled={!maxValue} size={'small'} className={'rounded-3xl'} type={'dashed'}
                  onClick={() => {
                    setInputAmount(maxValue!);
                  }}><span
            className={'text-primary'}>Max</span>{maxValue ? <>{formatNumberString(maxValue)} {selectedRune?.symbol}</> : null}
          </Button>
        </div>
      </div>
    </div>
    <div className={'mt-2 px-4'}>
      <div className={'text-soft text-xs flex-1'}>Staking Blocks</div>
      <div className={'flex flex-wrap gap-2 mt-2'}>{
        STAKING_BLOCKS.map((e) => {
          const selected = e.value == blocks;
          return <Button onClick={() => {
            setBlocks(e.value);
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
        blocks ?
          <div className={'flex items-center justify-between'}>
            <div className={'text-soft'}>Staking Blocks</div>
            <div>{blocks.toLocaleString('en-US')}</div>
          </div> : null
      }
      {
        inputRuneValue && selectedRune ?
          <div className={'flex items-center justify-between'}>
            <div className={'text-soft'}>{selectedRune.rune_name}</div>
            <div>{formatValue(inputRuneValue, selectedRune.divisibility)}
              {' '}<span className={'text-soft'}>{selectedRune.symbol}</span>
            </div>
          </div> : null
      }
      {
        order?.fee ?
          <div className={'flex items-center justify-between'}>
            <div className={'text-soft'}>Network Fee</div>
            <div>{(order.fee / 1e8).toLocaleString('en-US', {
              maximumFractionDigits: 8,
              minimumFractionDigits: 8,
            })}
              {' '}<span className={'text-soft'}>BTC</span>
            </div>
          </div> : null
      }
    </div>
    {
      errMsg ? <div className={'flex items-center gap-2 bg-orange-700 rounded-3xl py-2 px-4 mx-4 mt-4 text-xs'}>
        <ExclamationCircleOutlined />{errMsg}
      </div> : null
    }
    <Button disabled={!order} onClick={() => handleStaking()} size={'large'} type={'primary'}
            className={'rounded-3xl mx-2 mt-6'}>Staking
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
              const stakeAmount = new BigNumber(order.stake_amount.toString(10)).div(new BigNumber(10).pow(order.rune_divisibility)).toFixed();
              const isUnlocked = 'Unlocked' in order.status;
              const status = 'Locking' in order.status ? 'Locking' : isUnlocked ? 'Unlocked' : 'Created';
              const lockHeight = order.stake_payload.lock_time;
              const redeemable = lockHeight <= balance.height;
              return <>
                <div className={'flex items-center justify-between'}>
                  <div className={'flex items-center'}>
                    <div className={'font-bold'}>{formatNumberString(stakeAmount)} {order.rune_symbol} <span
                      className={'text-[10px] text-soft'}>{order.rune_name}</span></div>
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
                            title={`Rune staking can be redeemed after ${lockHeight - balance.height} blocks.`}>{btn}</Tooltip>;
                        }
                      })()
                  }
                </div>
                <div className={'flex items-center text-[10px] justify-between mt-1 text-soft'}>
                  <div>{time}</div>
                  <div>{lockHeight.toLocaleString('en-US')}</div>
                </div>
              </>;
            })()}
          </div>
        </div>
        : null
    }
    <Spin fullscreen={true} spinning={fullLoading} className={'z-[99999]'} />
    <TxModal txids={txids} onClose={() => {
      setTxids(undefined);
    }} />
    <Modal
      styles={{
        content: {
          padding: '16px',
        },
      }}
      width={360}
      centered={true} destroyOnClose={true} open={showModal} closeIcon={null} footer={null} onCancel={() => {
      setShowModal(false);
    }}>
      <div className={'text-lg font-bold'}>Select Staking Rune</div>
      <Input
        className={'mt-4'}
        placeholder={'Search ...'} value={keywords} allowClear
        onChange={(e) => setKeywords(e.target.value.trim())} />
      <div className={'flex flex-col gap-2 mt-4'}>
        {
          filterdRunes.length ?
            filterdRunes.map((e, index) => {
              const rune = runesMap.get(e.rune_id);
              const disabled = !rune;
              const selected = selectedRune?.rune_id == e.rune_id;
              return <Fragment key={e.rune_id}>
                {index != 0 ? <Divider className={'!my-0'} /> : null}
                <div
                  className={`${selected ? 'pl-2.5 border-l-4 border-solid border-primary' : ''} ${disabled ? 'text-soft cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={disabled ? undefined : () => {
                    setSelectedRune(Object.assign(rune, e));
                    setShowModal(false);
                    setKeywords('');
                  }}>
                  <div className={'text-sm'}>{e.rune_name}</div>
                  {
                    rune ? <>
                      <div className={'text-xs text-soft'}>{formatValue(rune.rune_value, rune.divisibility)} <span
                        className={'text-primary'}>{rune.symbol}</span></div>
                    </> : <div className={'text-xs text-soft'}>No Balance...</div>
                  }
                </div>
              </Fragment>;
            }) : <div className={'text-center text-soft'}>No result...</div>
        }
      </div>
    </Modal>
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
              const stakeAmount = new BigNumber(order.stake_amount.toString(10)).div(new BigNumber(10).pow(order.rune_divisibility)).toFixed();
              const isUnlocked = 'Unlocked' in order.status;
              const status = 'Locking' in order.status ? 'Locking' : isUnlocked ? 'Unlocked' : 'Created';
              const lockHeight = order.stake_payload.lock_time;
              const redeemable = lockHeight <= balance.height;
              return <Fragment key={order.create_time}>
                {index > 0 ? <Divider className={'!my-2'} /> : null}
                <div>
                  <div className={'flex items-center justify-between'}>
                    <div className={'flex items-center'}>
                      <div className={'font-bold'}>{formatNumberString(stakeAmount)} {order.rune_symbol} <span
                        className={'text-[10px] text-soft'}>{order.rune_name}</span></div>
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
                              title={`Rune staking can be redeemed after ${lockHeight - balance.height} blocks.`}>{btn}</Tooltip>;
                          }
                        })()
                    }
                  </div>
                  <div className={'flex items-center text-[10px] justify-between mt-1 text-soft'}>
                    <div>{time}</div>
                    <div>{lockHeight.toLocaleString('en-US')}</div>
                  </div>
                </div>
              </Fragment>;
            })}
          </div>
        </div>
      </Spin>
    </Modal>
  </>;
}