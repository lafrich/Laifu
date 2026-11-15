package art.lafrich.screenoff;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;

public final class MainActivity extends Activity {
    private WebView browser;
    private EditText address;
    private TextView hint;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(11, 12, 17));
        getWindow().setNavigationBarColor(Color.rgb(11, 12, 17));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(11, 12, 17));
        root.setPadding(dp(12), dp(8), dp(12), dp(8));

        TextView heading = new TextView(this);
        heading.setText("YOUTUBE  /  SCREEN OFF");
        heading.setTextColor(Color.WHITE);
        heading.setTextSize(17);
        heading.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        heading.setPadding(dp(2), dp(8), 0, dp(10));
        root.addView(heading);

        LinearLayout linkRow = new LinearLayout(this);
        linkRow.setOrientation(LinearLayout.HORIZONTAL);

        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextColor(Color.WHITE);
        address.setHintTextColor(0xff9397a5);
        address.setTextSize(13);
        address.setHint("Tempel link YouTube atau ketik pencarian");
        address.setPadding(dp(12), 0, dp(8), 0);
        address.setBackground(round(0xff20212a, 12));
        linkRow.addView(address, new LinearLayout.LayoutParams(0, dp(48), 1));

        Button go = button("BUKA", 0xff353846);
        LinearLayout.LayoutParams goParams = new LinearLayout.LayoutParams(dp(73), dp(48));
        goParams.leftMargin = dp(8);
        linkRow.addView(go, goParams);
        go.setOnClickListener(v -> navigate());
        root.addView(linkRow);

        browser = new WebView(this);
        browser.setBackgroundColor(Color.BLACK);
        browser.getSettings().setJavaScriptEnabled(true);
        browser.getSettings().setDomStorageEnabled(true);
        browser.getSettings().setMediaPlaybackRequiresUserGesture(true);
        browser.setWebChromeClient(new WebChromeClient());
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                String scheme = uri.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) return false;
                // Browser is restricted to safe http(s); external app schemes are not executed.
                return true;
            }
        });
        LinearLayout.LayoutParams webParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1);
        webParams.topMargin = dp(10);
        root.addView(browser, webParams);

        Button play = button("▶  PUTAR AUDIO • LAYAR MATI", 0xffdc3949);
        LinearLayout.LayoutParams playParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(54));
        playParams.topMargin = dp(10);
        root.addView(play, playParams);
        play.setOnClickListener(v -> playSelected());

        hint = new TextView(this);
        hint.setText("Buka video YouTube lalu tekan tombol merah. Kunci layar HP seperti biasa. Kontrol ada di notifikasi.");
        hint.setTextColor(0xffbfc1cb);
        hint.setTextSize(12);
        hint.setPadding(dp(3), dp(10), dp(3), dp(2));
        root.addView(hint);

        setContentView(root);
        browser.loadUrl("https://m.youtube.com/");
        consumeSharedIntent(getIntent());
    }

    private void navigate() {
        String value = address.getText().toString().trim();
        if (value.isEmpty()) return;
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            if (value.matches("(?i)^(www\\.)?(youtube\\.com|m\\.youtube\\.com|youtu\\.be)/.*")) {
                value = "https://" + value;
            } else {
                value = "https://m.youtube.com/results?search_query=" + Uri.encode(value);
            }
        }
        Uri uri = Uri.parse(value);
        if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) {
            toast("URL tidak didukung"); return;
        }
        browser.loadUrl(value);
        ((InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE))
                .hideSoftInputFromWindow(address.getWindowToken(), 0);
        address.clearFocus();
    }

    private void playSelected() {
        String input = address.getText().toString().trim();
        if (isYouTubeVideo(input)) {
            startAudio(input);
            return;
        }
        browser.evaluateJavascript("(function(){return window.location.href})()", raw -> {
            String url = browser.getUrl();
            try {
                url = new JSONArray("[" + raw + "]").getString(0);
            } catch (Exception ignored) {}
            if (isYouTubeVideo(url)) startAudio(url);
            else toast("Buka halaman video, atau tempel link video YouTube.");
        });
    }

    private boolean isYouTubeVideo(String link) {
        try {
            Uri uri = Uri.parse(link);
            String host = uri.getHost();
            if (host == null) return false;
            host = host.toLowerCase(java.util.Locale.ROOT);
            if ("youtu.be".equals(host)) return uri.getPathSegments().size() > 0;
            if (!host.equals("youtube.com") && !host.endsWith(".youtube.com")) return false;
            String path = uri.getPath();
            return ("/watch".equals(path) && uri.getQueryParameter("v") != null)
                || (path != null && (path.startsWith("/shorts/") || path.startsWith("/live/")));
        } catch (Exception error) { return false; }
    }

    private void startAudio(String link) {
        Intent intent = new Intent(this, PlaybackService.class);
        intent.setAction(PlaybackService.ACTION_PLAY_URL);
        intent.putExtra(PlaybackService.EXTRA_URL, link);
        startService(intent);
        hint.setText("Memuat audio… Setelah mulai, tekan tombol power untuk mematikan layar. Kontrol dari lock screen/notifikasi.");
        toast("Memuat audio di background…");
    }

    private void consumeSharedIntent(Intent intent) {
        if (intent != null && Intent.ACTION_SEND.equals(intent.getAction())
                && "text/plain".equals(intent.getType())) {
            String shared = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (shared != null) {
                java.util.regex.Matcher matcher = java.util.regex.Pattern
                    .compile("https?://[^\\s]+").matcher(shared);
                if (matcher.find()) shared = matcher.group();
                address.setText(shared);
                if (isYouTubeVideo(shared)) browser.loadUrl(shared);
            }
        }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        consumeSharedIntent(intent);
    }

    @Override public void onBackPressed() {
        if (browser.canGoBack()) browser.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        browser.destroy();
        super.onDestroy();
    }

    private Button button(String label, int color) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setTextSize(12);
        b.setAllCaps(false);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setBackground(round(color, 12));
        b.setGravity(Gravity.CENTER);
        return b;
    }

    private GradientDrawable round(int color, int r) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(r));
        return d;
    }

    private int dp(float v) { return (int)(getResources().getDisplayMetrics().density * v + .5f); }
    private void toast(String msg) { Toast.makeText(this, msg, Toast.LENGTH_LONG).show(); }
}
