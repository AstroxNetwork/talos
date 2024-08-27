import { Button, Modal } from 'antd';
import React from 'react';
import { CheckCircleFilled } from '@ant-design/icons';
import { useNetwork } from '../../hook';

interface Props {
  txids?: string[];
  onClose: () => void;
}


export default function TxModal({ txids, onClose }: Props) {
  const network = useNetwork();
  return (
    <Modal
      footer={
        null
      }
      styles={{
        content: {
          padding: '0',
          borderRadius: '24px',
          background: 'transparent',
        },
      }}
      open={!!txids?.length}
      onCancel={onClose}
      closeIcon={null}
      width={320}
      closable={false}
      maskClosable={false}
      centered={true}
      destroyOnClose={true}>
      <div className={'talos-bg-card rounded-[24px] p-2'}>
        <div className={'talos-bg-surface rounded-[16px] p-4'}>
          <div className={'flex items-center flex-col'}>
            <span className={'text-[72px] leading-none text-green-500'}><CheckCircleFilled /></span>
            <div className={'text-lg font-bold mt-2'}>Success</div>
            <div className={'text-soft text-center'}>Transaction has been submitted, please wait for it to complete.
            </div>
          </div>
          <div className={'flex flex-col gap-2 my-6'}>
            {txids?.slice(0, 1).map((e) => {
              return <Button type={'dashed'} className={'text-primary'} block={true} key={e} onClick={() => {
                window.open(network.mempoolUrl + '/tx/' + e, '_blank');
              }}>View on mempool.space</Button>;
            })}
          </div>
          <Button block={true} type={'primary'} onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );

}