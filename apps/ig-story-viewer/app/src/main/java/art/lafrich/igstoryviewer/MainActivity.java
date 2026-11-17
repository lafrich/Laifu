package art.lafrich.igstoryviewer;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

public final class MainActivity extends Activity {
    private static final String BASE = "https://insta-stories-viewer.com/id/";
    private static final int BG = Color.rgb(13, 15, 20);
    private static final int PANEL = Color.rgb(26, 29, 37);
    private static final int LINE = Color.rgb(44, 48, 58);
    private static final int WHITE = Color.rgb(247, 246, 243);
    private static final int MUTED = Color.rgb(154, 158, 168);
    private static final int ACCENT = Color.rgb(239, 194, 173);
    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9._]{1,30}$");

    private SharedPreferences prefs;
    private EditText usernameInput;
    private TextView viewingLabel;
    private LinearLayout historyList;
    private View welcome;
    private WebView browser;
    private ProgressBar loading;
    private LinearLayout failure;
    private TextView failureText;
    private String activeUsername = "";

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        prefs = getSharedPreferences("viewer", MODE_PRIVATE);
        createLayout();
        refreshHistory();
        Intent intent = getIntent();
        if (Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            String value = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (value != null) {
                usernameInput.setText(value);
                search();
            }
        }
    }

    private void createLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        setContentView(root);

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(20), dp(20), dp(20), dp(12));
        root.addView(header, new LinearLayout.LayoutParams(-1, -2));

        TextView symbol = text("◉", 27, BG, true);
        symbol.setGravity(Gravity.CENTER);
        symbol.setBackground(round(ACCENT, 16, 0, 0));
        header.addView(symbol, new LinearLayout.LayoutParams(dp(46), dp(46)));

        LinearLayout names = new LinearLayout(this);
        names.setOrientation(LinearLayout.VERTICAL);
        names.setPadding(dp(12), 0, 0, 0);
        header.addView(names, new LinearLayout.LayoutParams(0, -2, 1));
        names.addView(text("STORYVIEW", 19, WHITE, true));
        TextView byline = text("by Lafrich", 11, MUTED, false);
        names.addView(byline);

        TextView publicLabel = text("PUBLIC ONLY", 10, ACCENT, true);
        publicLabel.setLetterSpacing(0.04f);
        publicLabel.setPadding(dp(10), dp(8), dp(10), dp(8));
        publicLabel.setBackground(round(PANEL, 11, LINE, 1));
        header.addView(publicLabel);

        LinearLayout searchBox = new LinearLayout(this);
        searchBox.setGravity(Gravity.CENTER_VERTICAL);
        searchBox.setPadding(dp(6), dp(6), dp(6), dp(6));
        searchBox.setBackground(round(PANEL, 18, LINE, 1));
        LinearLayout.LayoutParams searchParams = new LinearLayout.LayoutParams(-1, dp(61));
        searchParams.setMargins(dp(20), dp(6), dp(20), dp(10));
        root.addView(searchBox, searchParams);

        TextView at = text("@", 20, ACCENT, false);
        at.setGravity(Gravity.CENTER);
        searchBox.addView(at, new LinearLayout.LayoutParams(dp(35), -1));

        usernameInput = new EditText(this);
        usernameInput.setSingleLine(true);
        usernameInput.setTextSize(16);
        usernameInput.setTextColor(WHITE);
        usernameInput.setHintTextColor(MUTED);
        usernameInput.setHint("username Instagram");
        usernameInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        usernameInput.setImeOptions(EditorInfo.IME_ACTION_GO);
        usernameInput.setSelectAllOnFocus(false);
        usernameInput.setPadding(0, 0, dp(5), 0);
        usernameInput.setBackgroundColor(Color.TRANSPARENT);
        searchBox.addView(usernameInput, new LinearLayout.LayoutParams(0, -1, 1));
        usernameInput.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO ||
                (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER)) {
                search();
                return true;
            }
            return false;
        });

        TextView go = text("LIHAT  →", 13, BG, true);
        go.setGravity(Gravity.CENTER);
        go.setBackground(round(ACCENT, 13, 0, 0));
        searchBox.addView(go, new LinearLayout.LayoutParams(dp(90), -1));
        go.setOnClickListener(v -> search());

        viewingLabel = text("Story publik, tanpa login Instagram.", 12, MUTED, false);
        viewingLabel.setPadding(dp(22), 0, dp(20), dp(12));
        root.addView(viewingLabel);

        FrameLayout screen = new FrameLayout(this);
        root.addView(screen, new LinearLayout.LayoutParams(-1, 0, 1));

        ScrollView intro = new ScrollView(this);
        intro.setFillViewport(true);
        welcome = intro;
        screen.addView(intro, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout welcomeContent = new LinearLayout(this);
        welcomeContent.setOrientation(LinearLayout.VERTICAL);
        welcomeContent.setPadding(dp(24), dp(36), dp(24), dp(24));
        intro.addView(welcomeContent);

        TextView deco = text("◎  ○  ◌", 45, ACCENT, false);
        deco.setLetterSpacing(0.15f);
        welcomeContent.addView(deco);

        TextView hero = text("Your window\ninto stories.", 35, WHITE, true);
        hero.setLineSpacing(dp(2), 1f);
        LinearLayout.LayoutParams heroLp = new LinearLayout.LayoutParams(-1, -2);
        heroLp.topMargin = dp(23);
        welcomeContent.addView(hero, heroLp);

        TextView desc = text("Cari sebuah akun Instagram publik dan lihat Story yang tersedia. Tidak perlu masuk ke akunmu sendiri.", 15, MUTED, false);
        desc.setLineSpacing(dp(5), 1f);
        LinearLayout.LayoutParams descLp = new LinearLayout.LayoutParams(-1, -2);
        descLp.topMargin = dp(14);
        welcomeContent.addView(desc, descLp);

        TextView historyTitle = text("PENCARIAN TERAKHIR", 11, MUTED, true);
        historyTitle.setLetterSpacing(0.1f);
        LinearLayout.LayoutParams histLp = new LinearLayout.LayoutParams(-1, -2);
        histLp.topMargin = dp(46);
        welcomeContent.addView(historyTitle, histLp);

        historyList = new LinearLayout(this);
        historyList.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams listLp = new LinearLayout.LayoutParams(-1, -2);
        listLp.topMargin = dp(13);
        welcomeContent.addView(historyList, listLp);

        TextView footnote = text("Hanya untuk akun publik • Hasil mengikuti layanan pihak ketiga.", 12, MUTED, false);
        footnote.setLineSpacing(dp(4), 1f);
        LinearLayout.LayoutParams footLp = new LinearLayout.LayoutParams(-1, -2);
        footLp.topMargin = dp(42);
        welcomeContent.addView(footnote, footLp);

        browser = new WebView(this);
        browser.setBackgroundColor(Color.WHITE);
        browser.setVisibility(View.GONE);
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (android.os.Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser, false);
        browser.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) {
                loading.setProgress(newProgress);
                loading.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!request.isForMainFrame()) return false;
                if ("https".equalsIgnoreCase(u.getScheme()) &&
                    ("insta-stories-viewer.com".equalsIgnoreCase(u.getHost()) ||
                     "www.insta-stories-viewer.com".equalsIgnoreCase(u.getHost()))) return false;
                launchOutside(u.toString());
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showFailure("Situs viewer gagal dimuat. Cek koneksi internet atau buka melalui browser.");
            }
        });
        browser.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> launchOutside(url));
        screen.addView(browser, new FrameLayout.LayoutParams(-1, -1));

        failure = new LinearLayout(this);
        failure.setVisibility(View.GONE);
        failure.setGravity(Gravity.CENTER);
        failure.setOrientation(LinearLayout.VERTICAL);
        failure.setPadding(dp(24), dp(24), dp(24), dp(24));
        failure.setBackgroundColor(BG);
        failure.addView(text("Tidak bisa memuat Story", 22, WHITE, true));
        failureText = text("", 14, MUTED, false);
        failureText.setGravity(Gravity.CENTER);
        failureText.setPadding(0, dp(14), 0, dp(24));
        failure.addView(failureText);
        TextView external = action("BUKA DI BROWSER", ACCENT, BG);
        failure.addView(external, new LinearLayout.LayoutParams(-1, dp(48)));
        external.setOnClickListener(v -> openCurrentOutside());
        screen.addView(failure, new FrameLayout.LayoutParams(-1, -1));

        loading = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        loading.setMax(100);
        loading.setIndeterminate(false);
        loading.setProgressTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        loading.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(LINE));
        loading.setVisibility(View.GONE);
        FrameLayout.LayoutParams loadParams = new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP);
        screen.addView(loading, loadParams);

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setBackgroundColor(PANEL);
        toolbar.setPadding(dp(10), dp(7), dp(10), dp(7));
        toolbar.setGravity(Gravity.CENTER);
        root.addView(toolbar, new LinearLayout.LayoutParams(-1, dp(59)));
        addTool(toolbar, "⌂  HOME", () -> showWelcome());
        addTool(toolbar, "↻  REFRESH", () -> {
            if (browser.getVisibility() == View.VISIBLE) browser.reload();
            else if (!activeUsername.isEmpty()) searchFor(activeUsername);
        });
        addTool(toolbar, "↗  BROWSER", this::openCurrentOutside);
    }

    private void addTool(LinearLayout bar, String title, Runnable click) {
        TextView t = text(title, 12, WHITE, true);
        t.setGravity(Gravity.CENTER);
        bar.addView(t, new LinearLayout.LayoutParams(0, -1, 1));
        t.setOnClickListener(v -> click.run());
    }

    private void refreshHistory() {
        historyList.removeAllViews();
        List<String> history = recent();
        if (history.isEmpty()) {
            TextView empty = text("Belum ada username yang dicari.", 13, MUTED, false);
            historyList.addView(empty);
            return;
        }
        for (String name : history) {
            TextView item = text("@"+name+"   →", 16, WHITE, false);
            item.setPadding(dp(17), dp(14), dp(17), dp(14));
            item.setBackground(round(PANEL, 14, LINE, 1));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
            lp.bottomMargin = dp(8);
            historyList.addView(item, lp);
            item.setOnClickListener(v -> { usernameInput.setText(name); searchFor(name); });
        }
    }

    private List<String> recent() {
        ArrayList<String> out = new ArrayList<>();
        String stored = prefs.getString("recent", "");
        if (stored.isEmpty()) return out;
        for (String s : stored.split(",")) if (USERNAME.matcher(s).matches()) out.add(s);
        return out;
    }

    private void remember(String name) {
        List<String> values = recent();
        values.remove(name);
        values.add(0, name);
        if (values.size() > 6) values = values.subList(0, 6);
        prefs.edit().putString("recent", android.text.TextUtils.join(",", values)).apply();
        refreshHistory();
    }

    private void search() {
        String name = normalize(usernameInput.getText().toString());
        if (!USERNAME.matcher(name).matches() ||
            name.equalsIgnoreCase("stories") || name.equalsIgnoreCase("reel") ||
            name.equalsIgnoreCase("p") || name.equalsIgnoreCase("explore")) {
            usernameInput.setError("Masukkan username Instagram yang valid.");
            return;
        }
        searchFor(name);
    }

    private String normalize(String raw) {
        String value = raw.trim();
        if (value.startsWith("@")) value = value.substring(1);
        if (value.startsWith("instagram.com/") || value.startsWith("www.instagram.com/"))
            value = "https://" + value;
        if (value.startsWith("http://") || value.startsWith("https://")) {
            try {
                Uri uri = Uri.parse(value);
                String host = uri.getHost();
                if (host == null || !(host.equalsIgnoreCase("instagram.com") ||
                    host.equalsIgnoreCase("www.instagram.com"))) return "";
                List<String> parts = uri.getPathSegments();
                if (parts.isEmpty()) return "";
                if ("stories".equalsIgnoreCase(parts.get(0))) {
                    if (parts.size() < 2) return "";
                    value = parts.get(1);
                } else value = parts.get(0);
            } catch (Exception ex) { return ""; }
        }
        if (value.startsWith("@")) value = value.substring(1);
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private void searchFor(String name) {
        activeUsername = name;
        usernameInput.setText(name);
        usernameInput.setSelection(name.length());
        ((InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE))
            .hideSoftInputFromWindow(usernameInput.getWindowToken(), 0);
        usernameInput.clearFocus();
        remember(name);
        viewingLabel.setText("Menampilkan Story publik dari @" + name);
        failure.setVisibility(View.GONE);
        welcome.setVisibility(View.GONE);
        browser.setVisibility(View.VISIBLE);
        loading.setProgress(2);
        loading.setVisibility(View.VISIBLE);
        browser.loadUrl(BASE + Uri.encode(name) + "/");
    }

    private void showWelcome() {
        browser.stopLoading();
        browser.setVisibility(View.GONE);
        failure.setVisibility(View.GONE);
        loading.setVisibility(View.GONE);
        welcome.setVisibility(View.VISIBLE);
        viewingLabel.setText("Story publik, tanpa login Instagram.");
    }

    private void showFailure(String message) {
        browser.setVisibility(View.GONE);
        failureText.setText(message);
        failure.setVisibility(View.VISIBLE);
        loading.setVisibility(View.GONE);
    }

    private void openCurrentOutside() {
        launchOutside(activeUsername.isEmpty() ? BASE : BASE + Uri.encode(activeUsername) + "/");
    }

    private void launchOutside(String url) {
        try {
            Uri uri = Uri.parse(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) return;
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ex) {
            Toast.makeText(this, "Tidak ada browser yang tersedia.", Toast.LENGTH_SHORT).show();
        } catch (Exception ignored) { }
    }

    @Override public void onBackPressed() {
        if (browser.getVisibility() == View.VISIBLE && browser.canGoBack()) browser.goBack();
        else if (welcome.getVisibility() != View.VISIBLE) showWelcome();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        browser.stopLoading();
        browser.destroy();
        super.onDestroy();
    }

    private TextView action(String title, int bg, int color) {
        TextView v = text(title, 13, color, true);
        v.setGravity(Gravity.CENTER);
        v.setBackground(round(bg, 12, 0, 0));
        return v;
    }

    private TextView text(String text, int sp, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(text);
        v.setTextSize(sp);
        v.setTextColor(color);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return v;
    }

    private GradientDrawable round(int background, int radius, int border, int widthDp) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(background);
        shape.setCornerRadius(dp(radius));
        if (widthDp > 0) shape.setStroke(dp(widthDp), border);
        return shape;
    }

    private int dp(int x) {
        return Math.round(x * getResources().getDisplayMetrics().density);
    }
}
