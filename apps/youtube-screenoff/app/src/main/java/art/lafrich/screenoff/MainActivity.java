package art.lafrich.screenoff;

import android.app.Activity;
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
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MainActivity extends Activity {
    private static final int YOUTUBE = 0;
    private static final int MUSIC = 1;
    private final WebView[] pages = new WebView[2];
    private final String[] addressDrafts = {"", ""};
    private int currentTab = YOUTUBE;
    private boolean musicLoaded = false;

    private EditText address;
    private TextView hint;
    private Button youtubeTab;
    private Button musicTab;
    private Button playButton;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xff0b0c11);
        getWindow().setNavigationBarColor(0xff0b0c11);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xff0b0c11);
        root.setPadding(dp(12), dp(8), dp(12), dp(8));

        TextView heading = new TextView(this);
        heading.setText("SCREEN OFF");
        heading.setTextColor(Color.WHITE);
        heading.setTextSize(19);
        heading.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        heading.setPadding(dp(2), dp(8), 0, dp(12));
        root.addView(heading);

        LinearLayout tabRow = new LinearLayout(this);
        tabRow.setOrientation(LinearLayout.HORIZONTAL);
        youtubeTab = button("▶  YouTube", 0xffdc3949);
        musicTab = button("♫  Music", 0xff262731);
        tabRow.addView(youtubeTab, new LinearLayout.LayoutParams(0, dp(44), 1));
        LinearLayout.LayoutParams musicTabParams = new LinearLayout.LayoutParams(0, dp(44), 1);
        musicTabParams.leftMargin = dp(8);
        tabRow.addView(musicTab, musicTabParams);
        root.addView(tabRow);
        youtubeTab.setOnClickListener(v -> switchTo(YOUTUBE));
        musicTab.setOnClickListener(v -> switchTo(MUSIC));

        LinearLayout linkRow = new LinearLayout(this);
        linkRow.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams linkParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
        linkParams.topMargin = dp(10);

        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextColor(Color.WHITE);
        address.setHintTextColor(0xff9397a5);
        address.setTextSize(13);
        address.setHint("Link YouTube atau cari video");
        address.setPadding(dp(12), 0, dp(8), 0);
        address.setBackground(round(0xff20212a, 12));
        linkRow.addView(address, new LinearLayout.LayoutParams(0, dp(48), 1));

        Button go = button("BUKA", 0xff353846);
        LinearLayout.LayoutParams goParams = new LinearLayout.LayoutParams(dp(72), dp(48));
        goParams.leftMargin = dp(8);
        linkRow.addView(go, goParams);
        go.setOnClickListener(v -> navigate());
        root.addView(linkRow, linkParams);

        FrameLayout browserHolder = new FrameLayout(this);
        LinearLayout.LayoutParams webParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1);
        webParams.topMargin = dp(10);

        pages[YOUTUBE] = makeBrowser();
        pages[MUSIC] = makeBrowser();
        browserHolder.addView(pages[YOUTUBE], new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        browserHolder.addView(pages[MUSIC], new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        pages[MUSIC].setVisibility(View.GONE);
        root.addView(browserHolder, webParams);

        playButton = button("▶  PUTAR AUDIO • LAYAR MATI", 0xffdc3949);
        LinearLayout.LayoutParams playParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(54));
        playParams.topMargin = dp(10);
        root.addView(playButton, playParams);
        playButton.setOnClickListener(v -> playSelected());

        hint = new TextView(this);
        hint.setTextColor(0xffbfc1cb);
        hint.setTextSize(12);
        hint.setPadding(dp(3), dp(10), dp(3), dp(2));
        root.addView(hint);

        setContentView(root);
        updateTabs();
        pages[YOUTUBE].loadUrl("https://m.youtube.com/");
        consumeSharedIntent(getIntent());
    }

    private WebView makeBrowser() {
        WebView w = new WebView(this);
        w.setBackgroundColor(Color.BLACK);
        w.getSettings().setJavaScriptEnabled(true);
        w.getSettings().setDomStorageEnabled(true);
        w.getSettings().setMediaPlaybackRequiresUserGesture(true);
        w.setWebChromeClient(new WebChromeClient());
        w.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                // Do not follow intent:, javascript:, file:, or other non-HTTP URLs.
                return !("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme));
            }

            @Override public void onPageFinished(WebView view, String url) {
                int index = view == pages[MUSIC] ? MUSIC : YOUTUBE;
                // Don't overwrite a pasted address while someone is typing.
                if (!address.hasFocus()) {
                    addressDrafts[index] = url;
                    if (currentTab == index) address.setText(url);
                }
            }
        });
        return w;
    }

    private void switchTo(int tab) {
        if (tab != YOUTUBE && tab != MUSIC) return;
        if (tab != currentTab) {
            addressDrafts[currentTab] = address.getText().toString();
            // Pause any webpage audio; the independent background media player is unaffected.
            pauseWebAudio(pages[currentTab]);
            pages[currentTab].onPause();
            currentTab = tab;
            pages[tab].setVisibility(View.VISIBLE);
            pages[1 - tab].setVisibility(View.GONE);
            pages[tab].onResume();
            address.setText(addressDrafts[tab]);
        }
        if (tab == MUSIC && !musicLoaded) {
            musicLoaded = true;
            pages[MUSIC].loadUrl("https://music.youtube.com/");
        }
        address.clearFocus();
        updateTabs();
    }

    private void updateTabs() {
        boolean isMusic = currentTab == MUSIC;
        youtubeTab.setBackground(round(!isMusic ? 0xffdc3949 : 0xff262731, 12));
        musicTab.setBackground(round(isMusic ? 0xffdc3949 : 0xff262731, 12));
        playButton.setText(isMusic ? "♫  PUTAR MUSIK • LAYAR MATI"
                : "▶  PUTAR AUDIO • LAYAR MATI");
        address.setHint(isMusic ? "Link YouTube Music atau cari lagu"
                : "Link YouTube atau cari video");
        hint.setText(isMusic
                ? "Pilih lagu di YouTube Music lalu tekan tombol merah. Lagu diputar lewat pemutar audio background. Playlist otomatis belum didukung."
                : "Buka video YouTube lalu tekan tombol merah. Kunci layar seperti biasa; kontrol ada di notifikasi.");
    }

    private WebView activeBrowser() {
        return pages[currentTab];
    }

    private void navigate() {
        String value = address.getText().toString().trim();
        if (value.isEmpty()) return;
        if (!value.startsWith("https://") && !value.startsWith("http://")) {
            if (value.matches("(?i)^(www\\.)?(m\\.|music\\.)?youtube\\.com/.*")
                    || value.matches("(?i)^(www\\.)?youtu\\.be/.*")) {
                value = "https://" + value;
            } else {
                value = currentTab == MUSIC
                        ? "https://music.youtube.com/search?q=" + Uri.encode(value)
                        : "https://m.youtube.com/results?search_query=" + Uri.encode(value);
            }
        }
        Uri uri = Uri.parse(value);
        if (!"https".equalsIgnoreCase(uri.getScheme())
                && !"http".equalsIgnoreCase(uri.getScheme())) {
            toast("Alamat tidak didukung");
            return;
        }
        addressDrafts[currentTab] = value;
        ((InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE))
                .hideSoftInputFromWindow(address.getWindowToken(), 0);
        address.clearFocus();
        activeBrowser().loadUrl(value);
    }

    private void playSelected() {
        String typedLink = address.getText().toString().trim();
        WebView selectedBrowser = activeBrowser();

        // A newly pasted song/video link can be played without navigating first.
        if (address.hasFocus() && isYouTubeVideo(typedLink)) {
            startAudio(typedLink);
            return;
        }

        selectedBrowser.evaluateJavascript("window.location.href", raw -> {
            String currentUrl = selectedBrowser.getUrl();
            try {
                currentUrl = new JSONArray("[" + raw + "]").getString(0);
            } catch (Exception ignored) {
                // WebView.getUrl() remains a fallback for older pages.
            }

            if (isYouTubeVideo(currentUrl)) {
                startAudio(currentUrl);
            } else if (isYouTubeVideo(typedLink)) {
                startAudio(typedLink);
            } else {
                toast(currentTab == MUSIC
                        ? "Pilih satu lagu dulu di Music (halaman watch), lalu tekan tombol merah."
                        : "Buka video atau tempel link video YouTube terlebih dahulu.");
            }
        });
    }

    private boolean isYouTubeVideo(String link) {
        try {
            Uri uri = Uri.parse(link);
            String host = uri.getHost();
            if (host == null) return false;
            host = host.toLowerCase(Locale.ROOT);
            if ("youtu.be".equals(host)) return !uri.getPathSegments().isEmpty();
            if (!host.equals("youtube.com") && !host.endsWith(".youtube.com")) return false;
            String path = uri.getPath();
            return ("/watch".equals(path) && uri.getQueryParameter("v") != null)
                    || (path != null && (path.startsWith("/shorts/") || path.startsWith("/live/")));
        } catch (Exception error) {
            return false;
        }
    }

    private String normalizeForExtractor(String link) {
        Uri uri = Uri.parse(link);
        String host = uri.getHost();
        // NewPipe uses the regular YouTube service for music.youtube.com watch URLs.
        if (host != null && "music.youtube.com".equalsIgnoreCase(host)) {
            return uri.buildUpon().authority("www.youtube.com").build().toString();
        }
        return link;
    }

    private void startAudio(String originalLink) {
        if (!isYouTubeVideo(originalLink)) {
            toast("Link video/lagu tidak valid.");
            return;
        }
        pauseWebAudio(activeBrowser());
        Intent intent = new Intent(this, PlaybackService.class);
        intent.setAction(PlaybackService.ACTION_PLAY_URL);
        intent.putExtra(PlaybackService.EXTRA_URL, normalizeForExtractor(originalLink));
        startService(intent);
        hint.setText("Memuat audio… Setelah musik mulai, tekan tombol power. Kontrol di lock screen / notifikasi.");
        toast("Memuat audio di background…");
    }

    private void pauseWebAudio(WebView web) {
        if (web == null) return;
        web.evaluateJavascript("(function(){document.querySelectorAll('video,audio').forEach(function(el){el.pause()})})()", null);
    }

    private void consumeSharedIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())
                || !"text/plain".equals(intent.getType())) return;
        String shared = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (shared == null) return;
        Matcher matcher = Pattern.compile("https?://[^\\s]+").matcher(shared);
        if (matcher.find()) shared = matcher.group();
        // Some share sheets attach trailing punctuation to the URL.
        shared = shared.replaceAll("[),.]+$", "");
        Uri uri = Uri.parse(shared);
        if ("music.youtube.com".equalsIgnoreCase(uri.getHost())) switchTo(MUSIC);
        address.setText(shared);
        addressDrafts[currentTab] = shared;
        if (isYouTubeVideo(shared)) activeBrowser().loadUrl(shared);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        consumeSharedIntent(intent);
    }

    @Override public void onBackPressed() {
        if (activeBrowser().canGoBack()) {
            activeBrowser().goBack();
        } else if (currentTab == MUSIC) {
            switchTo(YOUTUBE);
        } else {
            super.onBackPressed();
        }
    }

    @Override protected void onDestroy() {
        for (WebView page : pages) {
            if (page != null) page.destroy();
        }
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

    private int dp(float v) {
        return (int) (getResources().getDisplayMetrics().density * v + .5f);
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }
}
