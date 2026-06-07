import { PostHog } from 'posthog-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const noopClient = {
  capture() {},
  captureException() {},
  async shutdown() {},
};

const client = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST,
      enableExceptionAutocapture: true,
    })
  : noopClient;

if (!process.env.POSTHOG_API_KEY) {
  console.warn('[PostHog] POSTHOG_API_KEY is not configured; analytics disabled');
}

/**
 * Extract a stable distinct ID from an Express request.
 * Uses the forwarded IP in production (behind a proxy) or the direct IP.
 */
function getDistinctId(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
  return ip || 'anonymous';
}

export { client as posthog, getDistinctId };
