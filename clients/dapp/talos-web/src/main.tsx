import ReactDOM from 'react-dom/client';
import React from 'react';
import TalosApp from './TalosApp.tsx';
import './index.css';
import './extend.less';
import dayjs from 'dayjs';
import LocalizedFormat from 'dayjs/plugin/localizedFormat';
import RelativeTime from 'dayjs/plugin/relativeTime';
import IsoWeek from 'dayjs/plugin/isoWeek';
import AdvancedFormat from 'dayjs/plugin/advancedFormat';
import '@rainbow-me/rainbowkit/styles.css';
import { store } from './store';
import { getPersistor } from '@rematch/persist';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/lib/integration/react';

dayjs.extend(LocalizedFormat);
dayjs.extend(RelativeTime);
dayjs.extend(IsoWeek);
dayjs.extend(AdvancedFormat);


ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <PersistGate persistor={getPersistor()}>
      <TalosApp />
    </PersistGate>
  </Provider>,
);


