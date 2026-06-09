import posthog from 'posthog-js';

const projectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let isInitialized = false;

function initPostHog() {
  if (isInitialized) return true;

  if (!projectToken) {
    if (import.meta.env.DEV) {
      console.warn('[PostHog] VITE_POSTHOG_PROJECT_TOKEN is not configured; browser analytics disabled');
    }
    return false;
  }

  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: '2026-01-30',
    tracing_headers: [window.location.hostname, 'localhost'],
  });

  isInitialized = true;
  return true;
}

export { initPostHog, posthog as posthogClient };
