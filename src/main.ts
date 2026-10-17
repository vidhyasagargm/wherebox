import '@fontsource-variable/schibsted-grotesk'
import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import './app.css'
import App from './App.svelte'
import { isNative } from './lib/platform'

// Updates install quietly in the background and apply on the next launch.
// The phone apps carry their files inside the app and update through new releases.
if (!isNative) registerSW({ immediate: true })

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
