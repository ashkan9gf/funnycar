package com.funnycar.ir;

import android.content.Context;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;

import java.util.Locale;

/**
 * NativeTTS — پل گفتار فارسی برای فانی‌کار (v0.2.45)
 * ============================================================
 * «صداهای وسط بازی باید فارسی خوانده شوند» — موتور TTS گوگل روی خودِ
 * گوشی فارسی را عالی می‌خواند؛ پس جاوااسکریپت بازی از طریق این پل
 * (window.AndroidTTS) جمله‌ها را می‌فرستد و موتور دستگاه بلند می‌خواند.
 *
 *  - زبان: تلاش fa-IR → fa → زبان پیش‌فرض دستگاه (بهتر از سکوت)
 *  - هر خطا بی‌خطر: فقط false برمی‌گردد و بازی به حباب متنی برمی‌گردد
 *  - speak() از رشتهٔ WebView می‌آید → thread-safe است (TTS خودش صف دارد)
 */
public class NativeTTS {

    private final TextToSpeech tts;
    private volatile boolean ready = false;
    private volatile boolean langTried = false;
    private volatile boolean faOk = false;

    public NativeTTS(Context ctx) {
        TextToSpeech t = null;
        try {
            t = new TextToSpeech(ctx.getApplicationContext(), new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int status) {
                    // نکته: این callback می‌تواند قبل از پایان constructor صدا شود —
                    // پس فقط پرچم می‌گذاریم؛ انتخاب زبان با اولین speak() انجام می‌شود
                    ready = (status == TextToSpeech.SUCCESS);
                }
            });
        } catch (Throwable ignored) {
            t = null;
        }
        tts = t;
        if (t == null) ready = false;
    }

    /** انتخاب زبان فارسی (یک‌بار، با اولین speak — بعد از اتمام init) */
    private void ensureLanguage() {
        if (langTried || tts == null) return;
        langTried = true;
        try {
            int r = tts.setLanguage(new Locale("fa", "IR"));
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                r = tts.setLanguage(new Locale("fa"));
            }
            faOk = !(r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED);
            // حتی اگر فارسی نصب نبود، زبان پیش‌فرض دستگاه می‌ماند (بهتر از سکوت)
        } catch (Throwable ignored) { }
    }

    private static float clamp(float v, float min, float max) {
        return v < min ? min : (v > max ? max : v);
    }

    /**
     * خواندن یک جمله فارسی.
     * @param pitch     0.5..2 (زیر و بمی هر شخصیت)
     * @param rate      0.5..2 (سرعت گفتار)
     * @param volume    0..1 (از اسلایدر «جملات طنز» تنظیمات)
     * @param interrupt true = جملهٔ قبلی قطع شود (رویداد مهم)
     * @return true اگر موتور آماده بود و فرمان پذیرفته شد
     */
    @JavascriptInterface
    public boolean speak(String text, float pitch, float rate, float volume, boolean interrupt) {
        if (!ready || tts == null) return false;
        if (text == null || text.length() == 0) return false;
        ensureLanguage();
        try {
            if (interrupt) tts.stop();
            tts.setPitch(clamp(pitch, 0.5f, 2.0f));
            tts.setSpeechRate(clamp(rate, 0.5f, 2.0f));
            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, clamp(volume, 0.05f, 1.0f));
            int queue = interrupt ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD;
            tts.speak(text, queue, params, "fc_" + System.nanoTime());
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    @JavascriptInterface
    public void stop() {
        try {
            if (tts != null) tts.stop();
        } catch (Throwable ignored) { }
    }

    /** آیا موتور TTS دستگاه آماده است؟ */
    @JavascriptInterface
    public boolean isReady() {
        return ready;
    }

    /** آیا زبان فارسی واقعاً پشتیبانی می‌شود؟ (برای QA و تصمیم fallback) */
    @JavascriptInterface
    public boolean isPersian() {
        return faOk;
    }

    /** آزادسازی کامل هنگام بستن اپ */
    public void shutdown() {
        try {
            if (tts != null) {
                tts.stop();
                tts.shutdown();
            }
        } catch (Throwable ignored) { }
        ready = false;
    }
}
