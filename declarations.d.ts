/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

declare module '*.jpg' {
  const value: string;
  export default value;
}

interface ImportMetaEnv {
  readonly VITE_ADSENSE_CLIENT_ID?: string;
  readonly VITE_ADSENSE_SLOT_DEFAULT?: string;
  readonly VITE_ADSENSE_SLOT_STUDIO?: string;
  readonly VITE_ADSENSE_SLOT_GRID?: string;
  readonly VITE_GOOGLE_ADS_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}