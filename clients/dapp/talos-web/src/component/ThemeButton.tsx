import { useDispatch, useSelector } from 'react-redux';
import { Button, Dropdown, MenuProps } from 'antd';
import { RootDispatch, RootState } from '../store';
import { MoonOutlined, StarOutlined, SunOutlined } from '@ant-design/icons';
import { useThemeMode } from '../hook';
import React from 'react';


export default function ThemeButton() {
  const dispatch = useDispatch<RootDispatch>();
  const theme = useSelector((state: RootState) => state.global.theme);
  const mode = useThemeMode();
  let icon;
  if (mode === 'dark') {
    icon = <MoonOutlined />;
  } else if (mode === 'light') {
    icon = <SunOutlined />;
  }
  const items: MenuProps['items'] = [
    {
      key: 'system',
      label: (
        <div className="flex items-center">
          <span className={'text-[16px] leading-none'}><StarOutlined /></span>
          <span className="ml-3">System</span>
        </div>
      ),
      onClick: () => {
        dispatch.global.save({ theme: 'system' });
      },
    },
    {
      key: 'dark',
      label: (
        <div className="flex items-center">
          <span className={'text-[16px] leading-none'}><MoonOutlined /></span>
          <span className="ml-3">Dark</span>
        </div>
      ),
      onClick: () => {
        dispatch.global.save({ theme: 'dark' });
      },
    },
    {
      key: 'light',
      label: (
        <div className="flex items-center">
          <span className={'text-[16px] leading-none'}><SunOutlined /></span>
          <span className="ml-3">Light</span>
        </div>
      ),
      onClick: () => {
        dispatch.global.save({ theme: 'light' });
      },
    },
  ];
  return <Dropdown
    menu={{ items, selectable: true, defaultSelectedKeys: [theme] }}>
    <Button type="dashed" shape={'circle'} size="middle" className="w-8 h-8 flex items-center justify-center" icon={icon}></Button>
  </Dropdown>;
}