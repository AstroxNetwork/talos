import './index.less';
import React from 'react';

export default function Main() {
  return <div className={'w-screen h-screen overflow-y-auto bg-[#131313] flex items-center justify-center relative'}>
    <div className={'noise'}></div>
    <div className={'w-[480px] p-2 rounded-[24px] bg-[#131313] inline-flex flex-col gap-1 relative z-10'}>
      <div className={'bg-[#1b1b1b] rounded-[16px] p-4 h-32'}></div>
      <div></div>
      <div className={'bg-[#1b1b1b] rounded-[16px] p-4 h-32'}></div>
    </div>
  </div>;
}