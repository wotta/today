import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { applyTheme, getInitialTheme } from './lib/theme';
import './style.css';

// Apply the saved/system theme before first paint to avoid a flash.
applyTheme(getInitialTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
