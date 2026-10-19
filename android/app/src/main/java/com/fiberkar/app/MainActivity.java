package com.fiberkar.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        // یکنواختی اندازهٔ متن در همهٔ گوشی‌ها مثل بقیهٔ اپ‌ها:
        // WebView به‌طور پیش‌فرض ضریب فونت سیستم (textZoom = fontScale×100) را
        // اعمال می‌کند و رابط اپ روی گوشی‌هایی با فونت/نمایش بزرگ، بیش‌ازحد درشت دیده می‌شود.
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().getSettings().setTextZoom(100);
        }
    }
}
