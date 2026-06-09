import posthog from 'posthog-js';
import type { Properties } from 'posthog-js';

const projectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const uiHost = import.meta.env.VITE_POSTHOG_UI_HOST || 'https://us.posthog.com';

let isInitialized = false;

type PostHogProperties = Record<string, unknown>;

const sensitivePropertyPattern = /(address|coordinate|latitude|longitude|lat|lng)$/i;
const urlPropertyPattern = /(url|href|link)$/i;

function sanitizeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value, window.location.origin);
    return {
      host: url.host,
      path: url.pathname,
    };
  } catch {
    return null;
  }
}

function sanitizePostHogProperties(properties: PostHogProperties = {}): Properties {
  const sanitized: Properties = {};

  Object.entries(properties).forEach(([key, value]) => {
    if (value === undefined) return;

    const normalizedKey = key.replace(/[^\w$]/g, '_');

    if (sensitivePropertyPattern.test(key)) {
      sanitized[`${normalizedKey}_provided`] = value !== null && value !== '';
      return;
    }

    if (urlPropertyPattern.test(key)) {
      const urlParts = sanitizeUrl(value);
      sanitized[`${normalizedKey}_provided`] = value !== null && value !== '';
      if (urlParts) {
        sanitized[`${normalizedKey}_host`] = urlParts.host;
        sanitized[`${normalizedKey}_path`] = urlParts.path;
      }
      return;
    }

    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[normalizedKey] = value;
      return;
    }

    if (value instanceof Date) {
      sanitized[normalizedKey] = value.toISOString();
      return;
    }

    if (Array.isArray(value)) {
      sanitized[normalizedKey] = value
        .filter(item => ['string', 'number', 'boolean'].includes(typeof item))
        .slice(0, 20);
      return;
    }

    sanitized[`${normalizedKey}_provided`] = true;
  });

  return sanitized;
}

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
    ui_host: uiHost,
    defaults: '2026-01-30',
    tracing_headers: [window.location.hostname, 'localhost'],
  });

  isInitialized = true;
  return true;
}

function capturePostHogEvent(eventName: string, properties?: PostHogProperties) {
  if (!isInitialized || !eventName) return;
  posthog.capture(eventName, sanitizePostHogProperties(properties));
}

function setPostHogPersonProperties(properties: PostHogProperties) {
  if (!isInitialized) return;
  posthog.setPersonProperties(sanitizePostHogProperties(properties));
}

export {
  capturePostHogEvent,
  initPostHog,
  posthog as posthogClient,
  sanitizePostHogProperties,
  setPostHogPersonProperties,
};
