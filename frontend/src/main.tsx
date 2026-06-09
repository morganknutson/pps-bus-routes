import React from 'react';
import ReactDOM from 'react-dom/client';
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react';
import App from './App';
import { initPostHog, posthogClient } from './services/posthog';
import './index.css';

const app = <App />;
const isPostHogEnabled = initPostHog();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPostHogEnabled ? (
      <PostHogProvider client={posthogClient}>
        <PostHogErrorBoundary>
          {app}
        </PostHogErrorBoundary>
      </PostHogProvider>
    ) : app}
  </React.StrictMode>,
);
















