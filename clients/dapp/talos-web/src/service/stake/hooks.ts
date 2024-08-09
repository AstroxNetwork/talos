import { useJWT, useNetwork } from '../../hook';
import { useMemo } from 'react';
import { MAIN_STAKE_API, StakeApi, TEST_STAKE_API } from './api.ts';


export function useStakeApi() {
  const network = useNetwork();
  const jwt = useJWT();
  return useMemo(
    () => new StakeApi(network.type == 'testnet' ? TEST_STAKE_API : MAIN_STAKE_API).setJWT(jwt),
    [jwt, network.type],
  );
}
