import {
  Actor,
  ActorConfig,
  ActorSubclass,
  DerEncodedPublicKey,
  HttpAgent,
  HttpAgentOptions,
  Signature,
  SignIdentity,
} from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import type {
  _SERVICE as SIWBService,
  PublicKey,
  SignedDelegation as ServiceSignedDelegation,
} from './siwb/ic_siwb_provider';
import type { _SERVICE as TalosService } from './talos/talos';
import type { _SERVICE as TalosWalletService } from './talos/talos_staking_wallet';
import { idlFactory as siwbIdlFactory } from './siwb/ic_siwb_provider.idl.ts';
import { idlFactory as talosIdlFactory } from './talos/talos.idl.ts';
import { idlFactory as talosWalletIdlFactory } from './talos/talos_staking_wallet.idl.ts';
import { Principal } from '@dfinity/principal';
import { Delegation, DelegationChain, type SignedDelegation } from '@dfinity/identity';


export function createActor<T>(
  {
    idlFactory,
    canisterId,
    httpAgentOptions,
    actorOptions,
  }: {
    idlFactory: IDL.InterfaceFactory;
    canisterId: string;
    httpAgentOptions?: HttpAgentOptions;
    actorOptions?: ActorConfig;
    identity?: SignIdentity;
  }) {
  if (!idlFactory || !canisterId) {
    throw new Error('Invalid idlFactory or canisterId');
  }
  const agent = new HttpAgent({ ...httpAgentOptions });

  if (import.meta.env.DFX_NETWORK !== 'ic') {
    agent.fetchRootKey().catch((err) => {
      console.warn('Unable to fetch root key. Check to ensure that your local replica is running');
      console.error(err);
    });
  }

  return Actor.createActor<T>(idlFactory, {
    agent,
    canisterId,
    ...actorOptions,
  });
}

/**
 * Converts a Uint8Array or number array to a Signature object.
 */
export function asSignature(signature: Uint8Array | number[]): Signature {
  const arrayBuffer: ArrayBuffer = (signature as Uint8Array).buffer;
  const s: Signature = arrayBuffer as Signature;
  s.__signature__ = undefined;
  return s;
}

/**
 * Converts a Uint8Array or number array to a DerEncodedPublicKey object.
 */
export function asDerEncodedPublicKey(
  publicKey: Uint8Array | number[],
): DerEncodedPublicKey {
  const arrayBuffer: ArrayBuffer = (publicKey as Uint8Array).buffer;
  const pk: DerEncodedPublicKey = arrayBuffer as DerEncodedPublicKey;
  pk.__derEncodedPublicKey__ = undefined;
  return pk;
}

export function createDelegationChain(
  signedDelegation: ServiceSignedDelegation,
  publicKey: PublicKey,
) {
  const delegations: SignedDelegation[] = [
    {
      delegation: new Delegation(
        (signedDelegation.delegation.pubkey as Uint8Array).buffer,
        signedDelegation.delegation.expiration,
        signedDelegation.delegation.targets[0] as Principal[],
      ),
      signature: asSignature(signedDelegation.signature),
    },
  ];
  return DelegationChain.fromDelegations(
    delegations,
    asDerEncodedPublicKey(publicKey),
  );
}

const AGENT_HOST = import.meta.env.VITE_DFX_NETWORK === 'ic' ? 'https://icp0.io' : 'http://127.0.0.1:8080';

export class Canister {
  private constructor() {
  }

  static newSIWBActor() {
    const actor = createActor<SIWBService>({
      idlFactory: siwbIdlFactory,
      canisterId: import.meta.env.VITE_SIWB_CANISTER_ID as string,
      httpAgentOptions: { host: AGENT_HOST },
    });
    return proxyActor(actor) as ActorSubclass<SIWBService>;
  }

  static newTalosActor(identity?: SignIdentity) {
    const actor = createActor<TalosService>({
      idlFactory: talosIdlFactory,
      canisterId: import.meta.env.VITE_TALOS_CANISTER_ID as string,
      httpAgentOptions: { host: AGENT_HOST, identity },
    });
    return proxyActor(actor) as ActorSubclass<TalosService>;
  }

  static newTalosWalletActor(identity?: SignIdentity) {
    const actor = createActor<TalosWalletService>({
      idlFactory: talosWalletIdlFactory,
      canisterId: import.meta.env.VITE_TALOS_WALLET_CANISTER_ID as string,
      httpAgentOptions: { host: AGENT_HOST, identity },
    });
    return proxyActor(actor) as ActorSubclass<TalosWalletService>;
  }
}

function proxyActor<T>(actor: ActorSubclass<T>) {
  return new Proxy(actor, {
    get(target: any, p: string): any {
      const el = target[p];
      if (typeof el === 'function') {
        return async (...args: any[]) => {
          console.log(`=> ${p}: `, args);
          const startTime = performance.now();
          const response = await el.apply(target, args);
          const endTime = performance.now();
          console.log(`<= ${p}(${((endTime - startTime) / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })}s): `, response);
          return response;
        };
      }
      return el;
    },
  });
}