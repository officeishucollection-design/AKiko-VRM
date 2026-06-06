import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global fetch interceptor to append JWT Authorization token
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input && typeof input === 'object' && input.url) {
    url = input.url;
  }

  const token = localStorage.getItem('vrm_token');
  const isBackend = url.startsWith(API_URL) || url.startsWith('/api/') || url.includes('/api/');
  const isS3 = url.includes('.amazonaws.com') || url.includes('s3.amazonaws.com');

  if (token && isBackend && !isS3) {
    init = init || {};
    let headers = init.headers || {};

    if (headers instanceof Headers) {
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } else if (Array.isArray(headers)) {
      const hasAuth = headers.some(([key]) => key.toLowerCase() === 'authorization');
      if (!hasAuth) {
        headers.push(['Authorization', `Bearer ${token}`]);
      }
    } else {
      const hasAuth = Object.keys(headers).some(key => key.toLowerCase() === 'authorization');
      if (!hasAuth) {
        headers = { ...headers, Authorization: `Bearer ${token}` };
      }
    }
    init.headers = headers;
  }

  const response = await originalFetch(input, init);

  if (response.status === 401 && isBackend) {
    localStorage.removeItem('vrm_token');
    localStorage.removeItem('vrm_user');
    window.dispatchEvent(new Event('vrm-unauthorized'));
  }

  return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

