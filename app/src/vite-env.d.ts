/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL der PocketBase-Instanz im Vereinsmodus, z. B. https://db.example.com */
  readonly VITE_PB_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
