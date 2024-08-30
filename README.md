# Talos

## ENV setup

- rust 1.65.0+
- dfx 0.12.1+
- didc [download binary](https://github.com/dfinity/candid/releases), export PATH to `didc`

- **!! Important !! Manually Setup Credentials**

  - Under `credentials` folder, you need to add 2 files.
    1.  `seedPhrase.txt`: 12 words mnemonic phrases, to create secp256k1 account for local test
    2.  `production.pem`: pem file with secp256k1 curve encoded, use for `mainnet` deployment
    3.  You can change file names on `ego-config`.json
  - Modify `ego-config`.json, change `production_cycles_wallet` to your cycles wallet.

- setup project, see `ego-projects.json`,

- **Lazy Setup Credentials**

  ```
  pnpm run ego:credentials
  ```

  Will generate `seedPhrase.txt` and `production.pem` for you.
  **But!! You have to Setup manually on production!!**

## Quick Start

1. `pnpm install`
2. `pnpm run ego:run` to create and deploy
3. `pnpm run test ego_example` to run test file in `clients/tests`


## Overview  

The principle of "not your keys, not your coins" underscores the critical need for security in cryptocurrency management. However, many existing staking platforms require users to entrust their assets to third-party wallets, introducing substantial security vulnerabilities. 

Moreover, meta-protocol assets (Runes, ARC20, BRC20, Ordinals, etc.) can’t be staked despite having a large user base, while BTC assets face high staking barriers with fewer users.

This project aims to resolve these issues by offering a non-custodial staking solution for Bitcoin assets on the Internet Computer Protocol (ICP) network. Leveraging ICP’s advanced decentralization and security features, this solution enables secure, trustless staking without relying on bridges. It also ensures immediate liquidity and efficient asset value capture through the issuance of LPT (ICRC-1) tokens.

**Key Features**  
1. Direct Bitcoin Wallet Integration: The platform supports seamless interaction with Bitcoin wallets through tECDSA & Schnorr Signatures, ensuring compatibility and security.
2. Non-Custodial Staking: Utilizing Bitcoin’s native scripting, staking assets are securely locked in a wallet-derived address, accessible only by the user’s wallet upon maturity. This approach significantly mitigates risks associated with platform failures or cyberattacks.
3. Oracle Integration: The platform integrates with Oracle canisters to provide accurate real-time Bitcoin asset prices data, enabling precise asset valuation for staking purposes.
4. Immediate Liquidity Release: Staking rewards are instantly issued as LPT (ICRC-1) tokens, which can be freely circulated within the ICP ecosystem. This feature ensures that BTC asset value is immediately linked to ICP liquidity, enhancing financial flexibility.
5. Innovative Staking Model:
  - Aggregated Staking:  
Users lock BTC in an intermediate address once and earn PoS staking token and ICRC-1 liquidity token immediately at the same time, releasing the liquidity of BTC.
  - Crowd Staking:   
BTC is crowdsourced through a canister smart contract and staked on the staking platforms which require a large amount of BTC. LPT (ICRC-1) is distributed based on contributions, allowing for broader participation.

**Future Plans**  
- Extend support for additional Bitcoin Layer 2 assets in staking activities.
- Integrate with a broader range of PoS blockchains to enhance the diversity and attractiveness of staking rewards.
- Develop a comprehensive LPT economic model to support sustained growth and ecosystem integration.

**Impact**  
This non-custodial staking solution is pivotal in safeguarding user assets while capturing BTC value and enabling the conversion of Bitcoin Layer 2 assets. Furthermore, it facilitates seamless liquidity integration between Bitcoin, ICP and PoS blockchains, contributing to the robust expansion and development of both ecosystems.

**Videos**  
1. Pitch: https://youtu.be/zTJ537TD9qg
2. Demo: https://youtu.be/JIICUbq14Hc

Demo staking txid: https://mempool.space/testnet/tx/e30dd3bb7b27f7cf3c1c526210173e9507077b70afac490bbae75ee8c07460bd
