import '@fontsource/inter/500.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SectionPicker } from './SectionPicker';
import './screenshot.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SectionPicker />
  </StrictMode>,
);
