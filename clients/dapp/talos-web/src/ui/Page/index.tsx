import Main from '../Main';
import React from 'react';
import ConnectButton from '../../component/ConnectButton.tsx';
import ThemeButton from '../../component/ThemeButton.tsx';
import TokenIcons from '../../component/TokenIcons.tsx';
import { DiscordOutlined, GithubOutlined, XOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import Logo from '../../component/Logo.tsx';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';

export default function Page() {
  const breakpoint = useBreakpoint(true);
  return <div className={'talos-page talos-bg relative'}>
    <div
      className={`fixed top-0 left-0 right-0 ${breakpoint.xs ? 'p-4' : 'px-8 py-4'} flex items-center justify-between z-10`}>
      <Logo width={28} height={28} />
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
            <div className={'flex items-center gap-2'}>
              <Logo width={20} height={20} />
              <div className={'font-bold text-xl'}>Talos</div>
            </div>
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