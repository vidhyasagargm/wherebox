import Capacitor
import UIKit

/// Capacitor's web view, plus the plugins that live in this app rather than in node_modules.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ListenPlugin())
    }
}
