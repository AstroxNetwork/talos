import React, { useEffect, useState } from 'react';
import { Button, Popover } from 'antd';
import { useBalance, useMempoolApi } from '../../hook';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import CoreStaking from '../Staking/CoreStaking.tsx';
import { Prices } from '@wizz-btc/api';
import { SyncOutlined } from '@ant-design/icons';
import TalosStaking from '../Staking/TalosStaking.tsx';
import { formatValue } from '@wizz-btc/helpers';

const TABS = [
  {
    label: 'Talos',
    value: 'Talos',
  },
  {
    label: 'Core',
    value: 'Core',
  },
  {
    label: 'Babylon',
    value: 'Babylon',
    disabled: true,
  },
];

export default function Main() {
  const [tab, setTab] = useState<string>(TABS[0].value);
  const breakpoint = useBreakpoint(true);
  const balance = useBalance();
  const mempoolApi = useMempoolApi();
  const [prices, setPrices] = useState<Prices>();
  useEffect(() => {
    const controller = new AbortController();
    const loadPrices = () => {
      mempoolApi.getPrices({ signal: controller.signal }).then(([, prices]) => {
        const price = prices?.prices?.[0];
        if (price) {
          setPrices(price);
        }
      });
    };
    loadPrices();
    const id = setInterval(() => {
      balance.refresh();
      loadPrices();
    }, 1000 * 30);
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [balance.refresh, mempoolApi]);
  return <div className={`talos-body mx-4 ${breakpoint.xs ? '!mt-20' : '!mt-40'}`}>
    <div className={'flex items-center justify-between mb-4 px-2 z-10'}>
      <div className={'flex items-center gap-2'}>
        {
          TABS.map((e) => {
            const selected = e.value === tab;
            return <Button
              disabled={e.disabled}
              size={breakpoint.xs ? 'small' : undefined}
              key={e.value} className={`rounded-3xl ${breakpoint.xs ? 'text-xs' : undefined}`}
              type={selected ? 'primary' : 'dashed'}
              onClick={() => {
                setTab(e.value);
              }}>{e.label}</Button>;
          })
        }
      </div>
      <div className={'flex items-center gap-1'}>
        <Popover
          content={
            <div className={'text-xs'}>
              <div className={'min-w-56 flex items-center justify-between'}>
                <span>Available BTC</span>
                <span className={'ml-4'}>
                  {formatValue(balance.regularValue, 8, true)} <span className={'text-soft-white'}>BTC</span>
                </span>
              </div>
              {!!balance.unconfirmedSpentValue && (
                <div className={'min-w-56 flex items-center justify-between'}>
                  <span>Unconfirmed</span>
                  <span className={'ml-4'}>
                    {formatValue(balance.unconfirmedSpentValue, 8, true)} <span className={'text-soft-white'}>BTC</span>
                  </span>
                </div>
              )}
              {!!balance.atomicalsValue && (
                <div className={'min-w-56 flex items-center justify-between'}>
                  <span>BTC in Atomicals</span>
                  <span className={'ml-4'}>
                    {formatValue(balance.atomicalsValue, 8, true)} <span className={'text-soft-white'}>BTC</span>
                  </span>
                </div>
              )}
              {!!balance.runesValue && (
                <div className={'min-w-56 flex items-center justify-between'}>
                  <span>BTC in Runes</span>
                  <span className={'ml-4'}>
                    {formatValue(balance.runesValue, 8, true)} <span className={'text-soft-white'}>BTC</span>
                  </span>
                </div>
              )}
              {!!balance.inscriptionsValue && (
                <div className={'min-w-56 flex items-center justify-between'}>
                  <span>BTC in Inscriptions</span>
                  <span className={'ml-4'}>
                    {formatValue(balance.inscriptionsValue, 8, true)} <span className={'text-soft-white'}>BTC</span>
                  </span>
                </div>
              )}
              {!!balance.mergedValue && (
                <div className={'min-w-56 flex items-center justify-between'}>
                  <span>BTC in Merged</span>
                  <span className={'ml-4'}>
                    {formatValue(balance.mergedValue, 8, true)} <span className={'text-soft-white'}>BTC</span>
                  </span>
                </div>
              )}
            </div>
          }
          align={{
            offset: [0, 2],
          }}
          arrow={false}
          placement={'bottomRight'}
          trigger={['hover']}>
          <div className={breakpoint.xs ? 'text-sm' : 'text-lg'}>
            {(balance.confirmedValue / 1e8).toLocaleString('en-US', {
              maximumFractionDigits: 8,
              minimumFractionDigits: 8,
            })} <span className={'text-soft'}>{balance.network.symbol}</span>
          </div>
        </Popover>
        <Button
          size={'small'}
          shape={'circle'}
          title={'Refresh Balance'}
          disabled={balance.loading}
          className={'flex items-center justify-center'}
          onClick={(e) => {
            e.stopPropagation();
            balance.refresh();
          }}>
          <SyncOutlined spin={balance.loading} />
        </Button>
      </div>
    </div>
    {
      tab === 'Talos' ?
        <TalosStaking balance={balance} prices={prices} /> : <CoreStaking balance={balance} prices={prices} />
    }
  </div>;
}