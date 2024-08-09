import { useMemo } from 'react';
import { useNetwork } from '../../hook';
import { OrdXApi } from './api.ts';

export function useOrdXApi() {
  const network = useNetwork();
  return useMemo(() => new OrdXApi(network.ordxApi), [network.ordxApi]);
}
