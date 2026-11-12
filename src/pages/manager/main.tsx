import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { ManagerApp } from './ManagerApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ManagerApp />
  </StrictMode>
);

