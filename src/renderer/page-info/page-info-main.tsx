import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../panel/panel.css';
import { PageInfoWindow } from './PageInfoWindow';
import './page-info.css';
import './page-dashboard.css';
import '../saved-sites/saved-sites.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <PageInfoWindow />
  </StrictMode>,
);
