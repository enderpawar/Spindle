package kr.spindle.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // WebView는 기본값에서 viewport meta의 width= 를 무시한다. 390px보다 좁은 기기에서
        // 레이아웃 폭을 390으로 고정하고 화면에 맞춰 축소하려면 둘 다 켜야 한다
        // (web/src/native/viewport.ts). width=device-width인 기기에서는 동작이 같다.
        // 시스템 WebView가 없거나 비활성이면 BridgeActivity가 no_webview 화면만 띄우고
        // 브리지를 만들지 않는다 — 그 안내 화면을 크래시로 바꾸지 않도록 확인한다.
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
    }
}
