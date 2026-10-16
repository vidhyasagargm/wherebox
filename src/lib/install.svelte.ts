import { isIOS, isStandalone } from './speech'

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// Android and desktop Chrome hand us an install prompt we can show on a button.
export const install = $state<{ event: InstallEvent | null; installed: boolean }>({ event: null, installed: false })

if (typeof window !== 'undefined') {
  install.installed = isStandalone()
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    install.event = e as InstallEvent
  })
  window.addEventListener('appinstalled', () => {
    install.installed = true
    install.event = null
  })
}

// iPhone Safari has no prompt; we explain the Share → Add to Home Screen steps instead.
export const iosNeedsManualInstall = () => isIOS && !isStandalone()

export async function promptInstall() {
  if (!install.event) return
  await install.event.prompt()
  const { outcome } = await install.event.userChoice
  if (outcome === 'accepted') install.installed = true
  install.event = null
}
