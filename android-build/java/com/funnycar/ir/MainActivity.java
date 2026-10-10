package com.funnycar.ir;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * MainActivity — پوسته اندروید بازی فانی‌کار
 * بازی یک وب‌اپ کاملاً آفلاین است؛ WebView محتوای assets/www را
 * روی یک دامنه مجازی https://appassets.local سرو می‌کند تا
 * fetch/XHR/localStorage/WebAudio بدون محدودیت CORS کار کنند.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.local";
    private static final String START_URL = "https://" + HOST + "/index.html";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#101418"));

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        // برای دیباگ با chrome://inspect
        // Keep WebView remote debugging disabled in release builds.
        WebView.setWebContentsDebuggingEnabled(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (url == null || !HOST.equals(url.getHost())) {
                    return super.shouldInterceptRequest(view, request);
                }
                return serveAsset(url.getPath());
            }
        });

        setContentView(webView);
        applyImmersive();
        webView.loadUrl(START_URL);
    }

    /** سرو کردن فایل‌های بازی از assets/www با MIME درست */
    private WebResourceResponse serveAsset(String rawPath) {
        if (rawPath == null) rawPath = "/";
        String path = rawPath.replaceFirst("^/", "");
        if (path.isEmpty()) path = "index.html";
        if (path.contains("..")) return notFound();

        try {
            InputStream is = getAssets().open("www/" + path);
            String mime = guessMime(path);
            String encoding = isTextMime(mime) ? "UTF-8" : null;
            WebResourceResponse resp = new WebResourceResponse(mime, encoding, is);
            Map<String, String> headers = new HashMap<String, String>();
            headers.put("Access-Control-Allow-Origin", "*");
            resp.setResponseHeaders(Collections.unmodifiableMap(headers));
            return resp;
        } catch (IOException e) {
            return notFound();
        }
    }

    private static boolean isTextMime(String mime) {
        return mime.startsWith("text/")
                || mime.equals("application/json")
                || mime.equals("image/svg+xml")
                || mime.equals("model/gltf+json");
    }

    private static String guessMime(String path) {
        String p = path.toLowerCase(Locale.US);
        int dot = p.lastIndexOf('.');
        String ext = (dot >= 0) ? p.substring(dot + 1) : "";

        if (ext.equals("html") || ext.equals("htm")) return "text/html";
        if (ext.equals("js") || ext.equals("mjs"))    return "text/javascript";
        if (ext.equals("css"))                        return "text/css";
        if (ext.equals("json"))                       return "application/json";
        if (ext.equals("txt") || ext.equals("map"))   return "text/plain";
        if (ext.equals("svg"))                        return "image/svg+xml";
        if (ext.equals("png"))                        return "image/png";
        if (ext.equals("jpg") || ext.equals("jpeg"))  return "image/jpeg";
        if (ext.equals("webp"))                       return "image/webp";
        if (ext.equals("gif"))                        return "image/gif";
        if (ext.equals("ico"))                        return "image/x-icon";
        if (ext.equals("avif"))                       return "image/avif";
        if (ext.equals("woff2"))                      return "font/woff2";
        if (ext.equals("woff"))                       return "font/woff";
        if (ext.equals("ttf"))                        return "font/ttf";
        if (ext.equals("otf"))                        return "font/otf";
        if (ext.equals("ogg") || ext.equals("oga") || ext.equals("opus")) return "audio/ogg";
        if (ext.equals("wav"))                        return "audio/wav";
        if (ext.equals("mp3"))                        return "audio/mpeg";
        if (ext.equals("m4a"))                        return "audio/mp4";
        if (ext.equals("glb"))                        return "model/gltf-binary";
        if (ext.equals("gltf"))                       return "model/gltf+json";
        if (ext.equals("wasm"))                       return "application/wasm";
        return "application/octet-stream";
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse(
                "text/plain", "UTF-8", 404, "Not Found",
                Collections.<String, String>emptyMap(),
                new ByteArrayInputStream("404 Not Found".getBytes()));
    }

    private void applyImmersive() {
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = decor.getWindowInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            decor.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersive();
    }

    @Override
    public void onBackPressed() {
        // بازی تک‌صفحه‌ای است؛ دکمه برگشت فقط اپ را minimize می‌کند
        moveTaskToBack(true);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        applyImmersive();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
