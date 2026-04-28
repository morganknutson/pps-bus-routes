/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_TRACKING_ID: string;
  readonly VITE_GOOGLE_SITE_VERIFICATION?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


