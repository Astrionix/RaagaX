package com.raagax.music;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.raagax.music.permission.RaagaXPermissionsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RaagaXCapacitorPlugin.class);
        registerPlugin(RaagaXPermissionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
