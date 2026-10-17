/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Links in Settings › About; set at build time to point at your fork. */
  readonly VITE_REPO_URL?: string
  readonly VITE_COFFEE_URL?: string
  /** Imprint text (name, address, email); lines separated by "|". Shown only when set. */
  readonly VITE_IMPRINT?: string
  /** Server the Android/iOS apps use for accounts (the website uses its own address). Default: https://wherebox.sagar.fyi */
  readonly VITE_API_URL?: string
}
