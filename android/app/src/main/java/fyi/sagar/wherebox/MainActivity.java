package fyi.sagar.wherebox;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins that live in this app rather than in node_modules.
        registerPlugin(ListenPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
