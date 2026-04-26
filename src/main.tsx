import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CrmProvider } from './crm/CrmProvider';
import { Site } from './pages/Site';
import { Admin } from './pages/Admin';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <CrmProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Site />} />
          <Route path="/admin/*" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </CrmProvider>
  </StrictMode>,
);
