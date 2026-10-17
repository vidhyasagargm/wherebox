import AVFoundation
import Capacitor
import Speech

/// Speech to text for the voice screen (src/lib/speech.ts), the iPhone side of
/// android/…/ListenPlugin.java.
///
/// start({ lang }) asks for speech recognition and the microphone if needed, sends
/// "started" and "partial" events while listening, and resolves with { text } after a short
/// pause in speaking or when stop() is called. It rejects with one of the codes the app
/// knows: no-speech, not-allowed, network, unsupported, other, or aborted after abort().
///
/// Recognition runs on the iPhone whenever it supports the language, so nothing leaves it.
@objc(ListenPlugin)
public class ListenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ListenPlugin"
    public let jsName = "Listen"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "abort", returnType: CAPPluginReturnPromise),
    ]

    // How long a pause ends the sentence, and how long to wait for the first word.
    private let pause: TimeInterval = 1.5
    private let firstWord: TimeInterval = 8

    private let audio = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var current: CAPPluginCall?
    private var latest = ""
    private var timer: Timer?

    override public func load() {
        // Leaving the app stops listening, like closing the voice screen does.
        NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            self?.finish(error: "aborted")
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? Locale.current.identifier
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                call.reject("Speech recognition not allowed", "not-allowed")
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                DispatchQueue.main.async {
                    if granted { self.begin(call, lang: lang) } else { call.reject("Microphone not allowed", "not-allowed") }
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.endAudio()
            call.resolve()
        }
    }

    @objc func abort(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.finish(error: "aborted")
            call.resolve()
        }
    }

    private func begin(_ call: CAPPluginCall, lang: String) {
        finish(error: "aborted")
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: lang)) else {
            call.reject("Language not supported", "unsupported")
            return
        }
        // Not available usually means it needs a server and there's no connection.
        guard recognizer.isAvailable else {
            call.reject("Speech recognition not available", "network")
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let input = audio.inputNode
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in
                request.append(buffer)
            }
            audio.prepare()
            try audio.start()
        } catch {
            call.reject("Microphone unavailable", "not-allowed")
            return
        }

        current = call
        latest = ""
        self.request = request
        notifyListeners("started", data: [:])
        wait(firstWord)

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self, self.current === call else { return }
                if let result {
                    let text = result.bestTranscription.formattedString
                    if !text.isEmpty {
                        self.latest = text
                        self.notifyListeners("partial", data: ["text": text])
                    }
                    if result.isFinal {
                        self.finish(text: text.isEmpty ? self.latest : text)
                        return
                    }
                    self.wait(self.pause)
                }
                if let error {
                    // Ending the audio can report "no speech" even after words were heard.
                    if !self.latest.isEmpty { self.finish(text: self.latest) } else { self.finish(error: Self.code(error)) }
                }
            }
        }
    }

    // After a quiet spell, stop recording; the recognizer then delivers its final result.
    private func wait(_ seconds: TimeInterval) {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in self?.endAudio() }
    }

    private func endAudio() {
        timer?.invalidate()
        timer = nil
        if audio.isRunning {
            audio.stop()
            audio.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
    }

    // Ends the session: resolves with text, or rejects with an error code.
    private func finish(text: String? = nil, error: String? = nil) {
        endAudio()
        task?.cancel()
        task = nil
        request = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        guard let call = current else { return }
        current = nil
        if let text { call.resolve(["text": text]) } else if let error { call.reject(error, error) }
    }

    private static func code(_ error: Error) -> String {
        let e = error as NSError
        if e.domain == NSURLErrorDomain { return "network" }
        // kAFAssistantErrorDomain: 203 and 1110 mean nothing was said.
        if e.domain == "kAFAssistantErrorDomain" && (e.code == 203 || e.code == 1110) { return "no-speech" }
        if e.domain == "kAFAssistantErrorDomain" && (e.code == 1100 || e.code == 1101 || e.code == 1107) { return "network" }
        return "other"
    }
}
