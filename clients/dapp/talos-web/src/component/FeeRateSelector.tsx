import { FeeBlockItem, FeeRateResponse } from '@wizz-btc/api';
import { InputNumber, Slider, Spin } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useLoading, useMempoolApi } from '../hook';

const feeRateLabelMap = {
  fastestFee: {
    label: 'Rapid',
  },
  halfHourFee: {
    label: 'Normal',
  },
  hourFee: {
    label: 'Economy',
  },
};

let _feeBlockCache: FeeBlockItem | undefined;
const FeeRateSelector = (props: {
  className?: string;
  onChange: (v: number | undefined) => any;
  defaultKey?: keyof FeeRateResponse;
}) => {
  const { className } = props;
  const feeRateKey = 'halfHourFee';
  const [loading, loadingPlus, loadingMinus] = useLoading();
  const [feeRates, setFeeRates] = useState<FeeRateResponse>();
  const mempoolApi = useMempoolApi();
  const [feeRate, setFeeRate] = useState<number>();
  const [feeBlock, setFeeBlock] = useState<FeeBlockItem>();
  const entries = Object.entries(feeRateLabelMap);

  function toFeeRates(it: FeeBlockItem) {
    const last = it.feeRange.length - 1;
    let fastestFee = Math.round(it.feeRange[Math.max(last - 1, 0)]);
    let halfHourFee = Math.round(it.feeRange[Math.max(last - 3, 0)]);
    const hourFee = Math.round(it.feeRange[0]);
    if (halfHourFee <= hourFee) {
      halfHourFee = hourFee + 1;
    }
    if (fastestFee <= halfHourFee) {
      fastestFee = halfHourFee + 1;
    }
    return { economyFee: 0, fastestFee, halfHourFee, hourFee, minimumFee: 0 };
  }

  useEffect(() => {
    if (_feeBlockCache) {
      setFeeBlock(_feeBlockCache);
      const feeRates = toFeeRates(_feeBlockCache);
      setFeeRates(feeRates);
      setFeeRate(feeRates[feeRateKey]);
    }
  }, [feeRateKey]);

  useEffect(() => {
    const controller = new AbortController();
    let fr: any;
    const load = () => {
      loadingPlus();
      mempoolApi
        .getFeeBlocksOnMempool({ signal: controller.signal })
        .then(([, v]) => {
          if (v?.length) {
            const it = v[0];
            _feeBlockCache = it;
            setFeeBlock(it);
            const feeRates = toFeeRates(it);
            setFeeRates(feeRates);
            if (!fr) {
              fr = feeRates[feeRateKey];
              setFeeRate(fr);
            }
          }
        })
        .finally(() => {
          loadingMinus();
        });
    };
    load();
    const interval = setInterval(load, 1000 * 15);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [feeRateKey, loadingMinus, loadingPlus, mempoolApi]);

  useEffect(() => {
    const id = setTimeout(() => {
      props.onChange?.(feeRate);
    }, 500);
    return () => {
      clearTimeout(id);
    };
  }, [feeRate]);

  const min = 1;
  const max = useMemo(() => {
    if (!feeBlock) {
      return 200;
    }
    let max = feeBlock.feeRange[feeBlock.feeRange.length - 1];
    if (feeRate) {
      max = Math.max(max, feeRate, 100);
    }
    return Math.ceil(max);
  }, [feeBlock, feeRate]);
  let hasSelected = false;
  return (
    <div>
      <div className={`flex relative ${className || ''}`}>
        {entries.map(([key, value], index) => {
          const curr = feeRates?.[key as keyof FeeRateResponse];
          const selected = !!(curr && feeRate && curr == feeRate);
          if (selected) {
            hasSelected = true;
          }
          return (
            <div
              key={key}
              className={`flex-1 px-2 py-1 text-xs cursor-pointer ${index == 0 ? 'rounded-l z-10' : index == 2 ? 'rounded-r z-10' : '-mx-[2px]'} ${index == 1 ? (selected ? 'z-20' : 'z-0') : ''} border-solid border-2 ${
                selected ? 'border-primary' : 'border-primary-active'
              }`}
              onClick={() => {
                setFeeRate(curr);
              }}>
              <div className="font-bold text-white">
                {value.label} <Spin className="ml-2" spinning={loading} size={'small'} />
              </div>
              <div className="text-primary mt-0.5">
                {curr || '--'}
                <span className="text-[10px]"> sat/vB</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className={'flex items-center gap-4 mt-2 min-h-9'}>
        <Slider
          className={'flex-1'}
          min={min}
          max={max}
          onChange={(e) => {
            setFeeRate(e as number);
          }}
          value={typeof feeRate === 'number' ? feeRate : min}
        />
        <InputNumber
          value={feeRate}
          precision={0}
          addonAfter={'sat/vB'}
          className={`max-w-40 border-2 rounded ${hasSelected ? '' : 'border-primary border-solid'}`}
          onChange={(e) => {
            setFeeRate(e as number);
          }}
        />
      </div>
    </div>
  );
};
export default FeeRateSelector;
