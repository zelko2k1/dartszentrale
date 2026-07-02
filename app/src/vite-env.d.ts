/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** URL der PocketBase-Instanz im Vereinsmodus, z. B. https://db.example.com */
  readonly VITE_PB_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
