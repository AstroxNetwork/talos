import Main from '../Main';
import React from 'react';
import ConnectButton from '../../component/ConnectButton.tsx';
import ThemeButton from '../../component/ThemeButton.tsx';
import TokenIcons from '../../component/TokenIcons.tsx';
import { DiscordOutlined, GithubOutlined, XOutlined } from '@ant-design/icons';
import { Button } from 'antd';

export default function Page() {
  return <div className={'talos-page talos-bg relative'}>
    <div className={'fixed top-0 left-0 right-0 p-4 flex items-center justify-between z-10'}>
      <div className={'text-lg font-bold'}>Talos</div>
      <div className={'flex items-center gap-2'}>
        <ThemeButton />
        <ConnectButton />
      </div>
    </div>
    <div className={'talos-bg-mask talos-mask'}></div>
    <div className={'talos-noise'}></div>
    <TokenIcons />
    <div className={'talos-main'}>
      <Main />
      <div className={'talos-footer'}>
        <div className={'talos-footer-content'}>
          <div>
            <div className={'font-bold text-xl'}>Talos</div>
            <div className={'flex items-center gap-2'}>
              {
                [<XOutlined />,
                  <DiscordOutlined />,
                  <GithubOutlined />].map((e, index) => {
                  return <Button type={'dashed'} size={'small'} className={'w-8 h-8 text-lg'} key={index}>{e}</Button>;
                })
              }
            </div>
          </div>
          <div className={'text-xs text-soft mt-4'}>
            ©2024 Talos. All Rights Reserved
          </div>
        </div>
      </div>
    </div>
  </div>;
}