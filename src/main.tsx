import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 패널/팝업이 열려있는 동안 Service Worker에 연결 유지
// SW가 죽었다 살아나면 port가 끊기므로 자동 재연결
const connectPanel = () => {
  const port = chrome.runtime.connect({ name: 'panel' });
  port.onDisconnect.addListener(() => {
    setTimeout(connectPanel, 1_000);
  });
};
connectPanel();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
