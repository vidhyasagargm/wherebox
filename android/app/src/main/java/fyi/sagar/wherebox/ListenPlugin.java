package fyi.sagar.wherebox;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognitionSupport;
import android.speech.RecognitionSupportCallback;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;

/**
 * Speech to text for the voice screen (src/lib/speech.ts).
 *
 * start({ lang }) asks for the microphone if needed, sends "started" and "partial" events
 * while listening, and resolves with { text } once the person stops talking or stop() is
 * called. It rejects with one of the codes the app already knows: no-speech, not-allowed,
 * network, unsupported, other, or aborted after abort().
 *
 * The phone's on-device recognizer is used when it has the language installed (Android 13+),
 * so nothing leaves the phone; otherwise the system's default recognition service.
 */
@CapacitorPlugin(name = "Listen", permissions = @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone"))
public class ListenPlugin extends Plugin {

    private SpeechRecognizer recognizer;
    private PluginCall current;
    private String latest = "";

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "afterPermission");
            return;
        }
        begin(call, true);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) begin(call, true);
        else call.reject("Microphone not allowed", "not-allowed");
    }

    @PluginMethod
    public void stop(PluginCall call) {
        bridge.executeOnMainThread(() -> {
            if (recognizer != null) recognizer.stopListening();
            call.resolve();
        });
    }

    @PluginMethod
    public void abort(PluginCall call) {
        bridge.executeOnMainThread(() -> {
            finish(null, "aborted");
            call.resolve();
        });
    }

    // Leaving the app stops listening, like closing the voice screen does.
    @Override
    protected void handleOnPause() {
        bridge.executeOnMainThread(() -> finish(null, "aborted"));
    }

    private void begin(PluginCall call, boolean onDevice) {
        String lang = call.getString("lang", Locale.getDefault().toLanguageTag());
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());

        bridge.executeOnMainThread(() -> {
            // A retry with the regular recognizer keeps its call; any other session is aborted.
            if (current == call) current = null;
            finish(null, "aborted");
            current = call;
            latest = "";
            // On-device only when the phone has that language installed (asked on Android 13+);
            // otherwise the on-device recognizer fails as if nothing was said.
            if (onDevice && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())) {
                SpeechRecognizer probe = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
                probe.checkRecognitionSupport(intent, getContext().getMainExecutor(), new RecognitionSupportCallback() {
                    @Override
                    public void onSupportResult(RecognitionSupport support) {
                        probe.destroy();
                        boolean installed = support.getInstalledOnDeviceLanguages().stream().anyMatch(l -> l.equalsIgnoreCase(lang));
                        if (current == call) listen(call, intent, installed);
                    }

                    @Override
                    public void onError(int error) {
                        probe.destroy();
                        if (current == call) listen(call, intent, false);
                    }
                });
            } else {
                listen(call, intent, false);
            }
        });
    }

    private void listen(PluginCall call, Intent intent, boolean local) {
        if (!local && !SpeechRecognizer.isRecognitionAvailable(getContext())) {
            finish(null, "unsupported");
            return;
        }
        recognizer = local ? SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext()) : SpeechRecognizer.createSpeechRecognizer(getContext());
        recognizer.setRecognitionListener(new Listener(call, local));
        recognizer.startListening(intent);
    }

    // Ends the session: resolves with text, rejects with a code, or (both null) just cleans up.
    private void finish(String text, String error) {
        PluginCall call = current;
        current = null;
        if (recognizer != null) {
            recognizer.cancel();
            recognizer.destroy();
            recognizer = null;
        }
        if (call == null) return;
        if (text != null) {
            JSObject ret = new JSObject();
            ret.put("text", text);
            call.resolve(ret);
        } else if (error != null) {
            call.reject(error, error);
        }
    }

    private static String first(Bundle results) {
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return matches == null || matches.isEmpty() ? "" : matches.get(0);
    }

    private class Listener implements RecognitionListener {

        private final PluginCall call;
        private final boolean local;

        Listener(PluginCall call, boolean local) {
            this.call = call;
            this.local = local;
        }

        // Events from a session that was already replaced or ended are ignored.
        private boolean stale() {
            return current != call;
        }

        @Override
        public void onReadyForSpeech(Bundle params) {
            if (!stale()) notifyListeners("started", new JSObject());
        }

        @Override
        public void onPartialResults(Bundle results) {
            String text = first(results);
            if (stale() || text.isEmpty()) return;
            latest = text;
            JSObject ret = new JSObject();
            ret.put("text", text);
            notifyListeners("partial", ret);
        }

        @Override
        public void onResults(Bundle results) {
            if (stale()) return;
            String text = first(results);
            finish(text.isEmpty() ? latest : text, null);
        }

        @Override
        public void onError(int error) {
            if (stale()) return;
            // The on-device recognizer may not have this language: try the regular one.
            if (local && (error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED || error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE)) {
                begin(call, false);
                return;
            }
            // Stopping right after speaking can end in "no match"; keep what was heard.
            if (!latest.isEmpty() && (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT || error == SpeechRecognizer.ERROR_CLIENT)) {
                finish(latest, null);
                return;
            }
            finish(null, code(error));
        }

        private String code(int error) {
            switch (error) {
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                    return "no-speech";
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                case SpeechRecognizer.ERROR_AUDIO:
                    return "not-allowed";
                case SpeechRecognizer.ERROR_NETWORK:
                case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                case SpeechRecognizer.ERROR_SERVER:
                case SpeechRecognizer.ERROR_SERVER_DISCONNECTED:
                case SpeechRecognizer.ERROR_TOO_MANY_REQUESTS:
                    return "network";
                case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:
                case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:
                    return "unsupported";
                default:
                    return "other";
            }
        }

        @Override
        public void onBeginningOfSpeech() {}

        @Override
        public void onRmsChanged(float rmsdB) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {}

        @Override
        public void onEvent(int eventType, Bundle params) {}
    }
}
