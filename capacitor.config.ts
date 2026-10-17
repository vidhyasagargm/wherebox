import type { CapacitorConfig } from '@capacitor/cli'

// The Android and iOS apps: the same build as the website (dist/), loaded from the
// phone itself. See docs/apps.md.
const config: CapacitorConfig = {
  appId: 'fyi.sagar.wherebox',
  appName: 'Wherebox',
  webDir: 'dist',
  backgroundColor: '#F4F5F1',
}

export default config
