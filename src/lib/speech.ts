// Thin wrapper over the Web Speech API.
//
// Where it works: Chrome/Edge/Samsung Internet on Android and desktop, and
// Safari on iPhone when opened in the browser. Chrome sends audio to Google
// for recognition unless on-device recognition is available (we ask for it).
// It does not work in Firefox, and on iPhone it is unreliable once the app is
// added to the home screen, so there we fall back to the keyboard's own
// dictation button, which is on-device and works offline.
//
// The Android and iOS apps don't have the browser API, so a small native plugin
// (Listen, in android/ and ios/) uses the phone's own recognizer instead, on-device
// whenever the phone has it.

import { isNative } from './platform'

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  processLocally?: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

type RecognitionCtor = { new (): Recognition; available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string> }

const Ctor: RecognitionCtor | undefined =
  typeof window !== 'undefined' ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined

export const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

// The phone apps count as installed.
export const isStandalone = () => isNative || matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

// When false, the UI offers keyboard dictation instead of its own listening screen.
export function canListen(): boolean {
  if (isNative) return true
  if (!Ctor) return false
  if (isIOS && isStandalone()) return false
  return true
}

export type SpeechError = 'no-speech' | 'not-allowed' | 'network' | 'unsupported' | 'other'

export type Session = { stop(): void; abort(): void }

export function listen(opts: {
  lang: string
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (e: SpeechError) => void
  onStart?: () => void
}): Session {
  if (isNative) return listenNative(opts)
  if (!Ctor) {
    queueMicrotask(() => opts.onError('unsupported'))
    return { stop() {}, abort() {} }
  }
  const rec = new Ctor()
  rec.lang = opts.lang
  rec.interimResults = true
  rec.continuous = false
  rec.maxAlternatives = 1
  let finalText = ''
  let latest = ''
  let failed = false
  let aborted = false

  rec.onstart = () => opts.onStart?.()
  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) finalText += r[0].transcript
      else interim += r[0].transcript
    }
    latest = (finalText + interim).trim()
    opts.onInterim(latest)
  }
  rec.onerror = (e) => {
    if (e.error === 'aborted') return
    failed = true
    const map: Record<string, SpeechError> = {
      'no-speech': 'no-speech',
      'audio-capture': 'not-allowed',
      'not-allowed': 'not-allowed',
      'service-not-allowed': navigator.onLine ? 'not-allowed' : 'network',
      network: 'network',
      'language-not-supported': 'unsupported',
    }
    opts.onError(map[e.error] ?? 'other')
  }
  rec.onend = () => {
    if (failed || aborted) return
    const text = (finalText || latest).trim()
    if (text) opts.onFinal(text)
    else opts.onError('no-speech')
  }

  const start = () => {
    try {
      rec.start()
    } catch {
      opts.onError('other')
    }
  }

  // Prefer on-device recognition (private, works offline) where the browser has it.
  if (Ctor.available && 'processLocally' in rec) {
    Ctor.available({ langs: [opts.lang], processLocally: true })
      .then((status) => {
        if (status === 'available') rec.processLocally = true
      })
      .catch(() => {})
      .finally(start)
  } else start()

  return {
    stop: () => rec.stop(),
    abort: () => {
      aborted = true
      rec.abort()
    },
  }
}

type ListenPlugin = {
  start(o: { lang: string }): Promise<{ text: string }>
  stop(): Promise<void>
  abort(): Promise<void>
  addListener(event: 'partial', fn: (e: { text: string }) => void): Promise<{ remove(): Promise<void> }>
  addListener(event: 'started', fn: () => void): Promise<{ remove(): Promise<void> }>
}

// Wrapped in an object: Capacitor plugins answer to any method name, including "then",
// so a promise resolved with one directly would try to call Listen.then().
let plugin: Promise<{ p: ListenPlugin }> | null = null
const nativeListen = () => (plugin ??= import('@capacitor/core').then(({ registerPlugin }) => ({ p: registerPlugin<ListenPlugin>('Listen') })))

// The native plugin asks for the microphone itself, then resolves with the final text
// or rejects with one of the SpeechError codes (or "aborted").
function listenNative(opts: Parameters<typeof listen>[0]): Session {
  let done = false
  let latest = ''
  const subs: Promise<{ remove(): Promise<void> }>[] = []
  const finish = () => {
    done = true
    subs.forEach((s) => s.then((h) => h.remove()))
  }
  const ready = nativeListen().then(({ p }) => {
    subs.push(
      p.addListener('partial', (e) => {
        if (done) return
        latest = e.text.trim()
        opts.onInterim(latest)
      }),
      p.addListener('started', () => !done && opts.onStart?.()),
    )
    p.start({ lang: opts.lang }).then(
      ({ text }) => {
        if (done) return
        finish()
        const t = (text || latest).trim()
        if (t) opts.onFinal(t)
        else opts.onError('no-speech')
      },
      (e: { code?: string }) => {
        if (done) return
        finish()
        if (e.code === 'aborted') return
        const known: SpeechError[] = ['no-speech', 'not-allowed', 'network', 'unsupported']
        opts.onError(known.includes(e.code as SpeechError) ? (e.code as SpeechError) : 'other')
      },
    )
    return { p }
  })
  return {
    stop: () => void ready.then(({ p }) => p.stop()),
    abort: () => {
      if (done) return
      finish()
      void ready.then(({ p }) => p.abort())
    },
  }
}
