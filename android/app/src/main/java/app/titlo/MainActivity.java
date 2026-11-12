package app.titlo;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Lokalni dodaci se registruju prije super.onCreate.
        registerPlugin(MediaSaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
