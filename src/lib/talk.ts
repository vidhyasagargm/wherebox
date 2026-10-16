// Reads answers aloud with the browser's built-in text-to-speech. Most phones
// use on-device voices, so this works offline and nothing leaves the device.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

export const canTalk = () => !!synth

let voices: SpeechSynthesisVoice[] = []
const loadVoices = () => (voices = synth?.getVoices() ?? [])
loadVoices()
synth?.addEventListener?.('voiceschanged', loadVoices)

function pickVoice(lang: string) {
  const base = lang.slice(0, 2)
  const matching = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base))
  // Prefer the exact region, then voices that run on the device.
  return (
    matching.find((v) => v.lang.replace('_', '-') === lang && v.localService) ??
    matching.find((v) => v.lang.replace('_', '-') === lang) ??
    matching.find((v) => v.localService) ??
    matching[0]
  )
}

export function say(text: string, lang: string) {
  if (!synth || !text) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  const voice = pickVoice(lang)
  if (voice) u.voice = voice
  // A touch slower than default is easier to follow for most people.
  u.rate = 0.95
  synth.speak(u)
}

export function hush() {
  synth?.cancel()
}

// iPhone only lets a page speak after speech was started from a tap.
// Call this from the tap that starts listening so the answer can be spoken later.
export function unlockTalk() {
  if (!synth || synth.speaking) return
  const u = new SpeechSynthesisUtterance('')
  u.volume = 0
  synth.speak(u)
}
