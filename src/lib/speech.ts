// Thin wrapper over the Web Speech API.
//
// Where it works: Chrome/Edge/Samsung Internet on Android and desktop, and
// Safari on iPhone when opened in the browser. Chrome sends audio to Google
// for recognition unless on-device recognition is available (we ask for it).
// It does not work in Firefox, and on iPhone it is unreliable once the app is
// added to the home screen, so there we fall back to the keyboard's own
// dictation button, which is on-device and works offline.

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

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

// When false, the UI offers keyboard dictation instead of its own listening screen.
export function canListen(): boolean {
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
