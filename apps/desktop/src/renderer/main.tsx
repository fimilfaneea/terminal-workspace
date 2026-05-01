import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/app.css';
import './styles/terminal.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('root element missing');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
