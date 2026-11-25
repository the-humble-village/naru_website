// AI-assisted: see AI-ATTRIBUTION.md
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { useAuthStore } from './store/auth';
import { installValidationMessages } from './utils/validationMessages';

installValidationMessages(() => useAuthStore.getState().lang);

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
