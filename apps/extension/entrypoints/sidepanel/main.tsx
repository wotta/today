import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../newtab/App.tsx';
import { applyTheme, getInitialTheme } from '../newtab/lib/theme';
import '../newtab/style.css';

applyTheme(getInitialTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
