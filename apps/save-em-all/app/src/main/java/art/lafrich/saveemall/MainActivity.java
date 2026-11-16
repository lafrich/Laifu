package art.lafrich.saveemall;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.mapper.VideoInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Winamp-style Android downloader front-end; yt-dlp extraction is performed locally. */
public final class MainActivity extends Activity {
    private static final int LCD = 0xffc5ff79;
    private static final int STEEL = 0xff303b50;
    private static final int BG = 0xff161c25;
    private static final int SUBTLE = 0xffa8b9cc;
    private static final String[] MODES = {"BEST", "720P", "AUDIO", "ORIGINAL"};
    private static final String[] MODE_LABELS = {"BEST", "720P", "MP3", "SOURCE"};

    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Button[] tabButtons = new Button[4];
    private final Button[] modeButtons = new Button[4];
    private EditText address;
    private TextView preview;
    private TextView status;
    private TextView footer;
    private FrameLayout host;
    private ScrollView linkPage;
    private WebView browser;
    private ScrollView listPage;
    private LinearLayout listBody;
    private int tab = 0;
    private String mode = "BEST";
    private String lastRendered = "";
    private volatile boolean inspectRunning;
    private boolean destroyed;

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (destroyed) return;
            updateFooter();
            if (tab == 2 || tab == 3) {
                String latest = Store.list(MainActivity.this).toString();
                if (!latest.equals(lastRendered)) renderList();
            }
            ui.postDelayed(this, 1250);
        }
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xff10151b);
        getWindow().setNavigationBarColor(0xff10151b);
        buildUi();
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
        }
        receiveLink(getIntent());
        ui.post(tick);
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(12), dp(8), dp(12), dp(8));
        root.setBackgroundColor(BG);

        LinearLayout head = new LinearLayout(this);
        head.setPadding(dp(4), dp(3), dp(4), dp(9));
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView logo = text("SAVE EM ALL", 19, 0xfff0f2f6, true);
        head.addView(logo, new LinearLayout.LayoutParams(0, -2, 1));
        TextView credit = text("by Lafrich", 11, 0xffb5c8e4, false);
        head.addView(credit);
        root.addView(head);

        LinearLayout tabs = new LinearLayout(this);
        String[] labels = {"LINK", "WEB", "QUEUE", "HISTORY"};
        for (int i = 0; i < labels.length; i++) {
            final int target = i;
            tabButtons[i] = button(labels[i], STEEL);
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(42), 1);
            if (i > 0) p.leftMargin = dp(5);
            tabs.addView(tabButtons[i], p);
            tabButtons[i].setOnClickListener(v -> switchTab(target));
        }
        root.addView(tabs);

        LinearLayout addressRow = new LinearLayout(this);
        addressRow.setGravity(Gravity.CENTER_VERTICAL);
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextSize(12);
        address.setTextColor(LCD);
        address.setHintTextColor(0xff849779);
        address.setTypeface(Typeface.MONOSPACE);
        address.setHint("Paste URL video, audio, .m3u8, .mpd...");
        address.setPadding(dp(11), 0, dp(6), 0);
        address.setBackground(lcdBackground());
        addressRow.addView(address, new LinearLayout.LayoutParams(0, dp(48), 1));
        Button go = button("GO", 0xff39465a);
        LinearLayout.LayoutParams gp = new LinearLayout.LayoutParams(dp(64), dp(48));
        gp.leftMargin = dp(8);
        addressRow.addView(go, gp);
        go.setOnClickListener(v -> {
            if (tab == 1) browse();
            else { switchTab(0); inspect(); }
        });
        LinearLayout.LayoutParams ap = new LinearLayout.LayoutParams(-1, dp(48));
        ap.topMargin = dp(9);
        root.addView(addressRow, ap);

        host = new FrameLayout(this);
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(-1, 0, 1);
        hp.topMargin = dp(9);
        root.addView(host, hp);

        linkPage = makeLinkPage();
        host.addView(linkPage, new FrameLayout.LayoutParams(-1, -1));
        browser = makeBrowser();
        host.addView(browser, new FrameLayout.LayoutParams(-1, -1));
        listPage = new ScrollView(this);
        listBody = new LinearLayout(this);
        listBody.setOrientation(LinearLayout.VERTICAL);
        listBody.setPadding(dp(5), dp(9), dp(5), dp(24));
        listPage.addView(listBody);
        host.addView(listPage, new FrameLayout.LayoutParams(-1, -1));

        status = text("SYSTEM READY  •  PASTE A LINK TO BEGIN", 11, LCD, false);
        status.setPadding(dp(12), dp(10), dp(12), dp(10));
        status.setBackground(lcdBackground());
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(-1, -2);
        sp.topMargin = dp(10);
        root.addView(status, sp);

        footer = text("0 SAVED  •  0 PENDING", 10, SUBTLE, false);
        footer.setPadding(dp(3), dp(8), dp(3), dp(2));
        root.addView(footer);

        setContentView(root);
        switchTab(0);
    }

    private ScrollView makeLinkPage() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout body = new LinearLayout(this);
        body.setPadding(dp(5), dp(12), dp(5), dp(22));
        body.setOrientation(LinearLayout.VERTICAL);

        body.addView(text("URL EXTRACTOR / STREAM CAPTURE", 13, LCD, true));
        TextView intro = text("Paste a link from a supported site. Save videos, music, HLS or DASH streams to your phone.", 12, SUBTLE, false);
        intro.setPadding(0, dp(7), 0, dp(12));
        body.addView(intro);

        preview = text("NO MEDIA LOADED\n\nReady to inspect link.", 14, LCD, false);
        preview.setBackground(lcdBackground());
        preview.setPadding(dp(14), dp(16), dp(14), dp(16));
        body.addView(preview, new LinearLayout.LayoutParams(-1, dp(126)));

        LinearLayout actions = new LinearLayout(this);
        Button paste = button("PASTE", STEEL);
        actions.addView(paste, new LinearLayout.LayoutParams(0, dp(47), 1));
        paste.setOnClickListener(v -> pasteLink());
        Button check = button("ANALYZE", STEEL);
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(0, dp(47), 1);
        cp.leftMargin = dp(7);
        actions.addView(check, cp);
        check.setOnClickListener(v -> inspect());
        LinearLayout.LayoutParams act = new LinearLayout.LayoutParams(-1, dp(47));
        act.topMargin = dp(9);
        body.addView(actions, act);

        TextView qualityHeader = text("OUTPUT MODE", 12, LCD, true);
        qualityHeader.setPadding(0, dp(18), 0, dp(8));
        body.addView(qualityHeader);

        LinearLayout qualityRow = new LinearLayout(this);
        for (int i = 0; i < MODES.length; i++) {
            final int n = i;
            Button b = button(MODE_LABELS[i], i == 0 ? 0xff4c6850 : STEEL);
            modeButtons[i] = b;
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(43), 1);
            if (i > 0) p.leftMargin = dp(5);
            qualityRow.addView(b, p);
            b.setOnClickListener(v -> chooseMode(n));
        }
        body.addView(qualityRow);

        Button save = button("↓ DOWNLOAD / ADD TO QUEUE", 0xff3d6449);
        LinearLayout.LayoutParams dp = new LinearLayout.LayoutParams(-1, dp(54));
        dp.topMargin = dp(14);
        body.addView(save, dp);
        save.setOnClickListener(v -> queueDownload());

        TextView hint = text("Save location: Downloads / Save em all\n"
                + "Sources depend on yt-dlp support. DRM, private and access-restricted streams are not supported.", 11, SUBTLE, false);
        hint.setPadding(dp(2), dp(18), dp(2), 0);
        body.addView(hint);

        scroll.addView(body);
        return scroll;
    }

    private WebView makeBrowser() {
        WebView page = new WebView(this);
        page.setBackgroundColor(0xffeff0f2);
        page.getSettings().setJavaScriptEnabled(true);
        page.getSettings().setDomStorageEnabled(true);
        page.getSettings().setMediaPlaybackRequiresUserGesture(true);
        page.setWebChromeClient(new WebChromeClient());
        page.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                if (tab == 1 && DownloadService.validUrl(url)) address.setText(url);
            }
        });
        page.setDownloadListener((url, userAgent, contentDisposition, mimetype, length) -> {
            if (!DownloadService.validUrl(url)) return;
            address.setText(url);
            switchTab(0);
            status.setText("DOWNLOAD URL CAPTURED FROM WEB");
            preview.setText("DIRECT MEDIA LINK DETECTED\n\nChoose output mode and download.");
        });
        return page;
    }

    private void switchTab(int index) {
        tab = index;
        linkPage.setVisibility(index == 0 ? View.VISIBLE : View.GONE);
        browser.setVisibility(index == 1 ? View.VISIBLE : View.GONE);
        listPage.setVisibility(index >= 2 ? View.VISIBLE : View.GONE);
        for (int i = 0; i < tabButtons.length; i++) {
            tabButtons[i].setBackground(buttonBackground(i == index ? 0xff49614b : STEEL));
            tabButtons[i].setTextColor(i == index ? LCD : 0xfff0f2f6);
        }
        if (index == 2 || index == 3) renderList();
        if (index == 1 && "about:blank".equals(browser.getUrl())) status.setText("WEB BROWSER  •  ENTER URL AND PRESS GO");
    }

    private void chooseMode(int index) {
        mode = MODES[index];
        for (int i = 0; i < modeButtons.length; i++) {
            modeButtons[i].setBackground(buttonBackground(i == index ? 0xff416748 : STEEL));
            modeButtons[i].setTextColor(i == index ? LCD : 0xfff0f2f6);
        }
        status.setText("OUTPUT MODE: " + MODE_LABELS[index]);
    }

    private void browse() {
        String url = normalize(address.getText().toString());
        if (!DownloadService.validUrl(url)) { toast("Enter a valid http(s) URL"); return; }
        address.setText(url);
        hideKeyboard();
        browser.loadUrl(url);
        status.setText("BROWSING  •  USE LINK TAB TO SAVE CURRENT PAGE");
    }

    private void pasteLink() {
        ClipboardManager manager = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (manager == null || !manager.hasPrimaryClip()) { toast("Clipboard empty"); return; }
        ClipData clip = manager.getPrimaryClip();
        if (clip == null || clip.getItemCount() == 0) return;
        String pasted = String.valueOf(clip.getItemAt(0).coerceToText(this));
        String url = extractLink(pasted);
        address.setText(url);
        if (DownloadService.validUrl(url)) inspect();
        else toast("No URL found in clipboard");
    }

    private void inspect() {
        String url = normalize(address.getText().toString());
        if (!DownloadService.validUrl(url)) { toast("Enter a valid http(s) URL"); return; }
        address.setText(url);
        hideKeyboard();
        if (inspectRunning) { toast("Analysis in progress"); return; }
        inspectRunning = true;
        preview.setText("SCANNING SOURCE...\n\n" + Uri.parse(url).getHost());
        status.setText("ANALYZING LINK...");
        new Thread(() -> {
            String result;
            boolean found = false;
            try {
                YoutubeDL.getInstance().init(getApplicationContext());
                VideoInfo info = YoutubeDL.getInstance().getInfo(url);
                String title = info == null ? null : info.getTitle();
                result = "MEDIA DETECTED\n\n" + (title == null ? Uri.parse(url).getHost() : title);
                found = true;
            } catch (Exception e) {
                result = "PREVIEW UNAVAILABLE\n\nTry DOWNLOAD directly. " + shortText(e.getMessage(), 115);
            }
            final String message = result;
            final boolean success = found;
            runOnUiThread(() -> {
                if (destroyed) return;
                inspectRunning = false;
                preview.setText(message);
                status.setText(success ? "READY TO DOWNLOAD" : "LINK MAY STILL DOWNLOAD");
            });
        }, "source-inspector").start();
    }

    private void queueDownload() {
        String url = normalize(address.getText().toString());
        if (!DownloadService.validUrl(url)) { toast("Enter a valid http(s) URL"); return; }
        launchService(DownloadService.ADD, url, mode, null);
        status.setText("ADDED TO DOWNLOAD QUEUE");
        switchTab(2);
    }

    private void launchService(String action, String url, String format, String id) {
        Intent intent = new Intent(this, DownloadService.class).setAction(action);
        if (url != null) intent.putExtra(DownloadService.EXTRA_URL, url);
        if (format != null) intent.putExtra(DownloadService.EXTRA_MODE, format);
        if (id != null) intent.putExtra(DownloadService.EXTRA_ID, id);
        try { startForegroundService(intent); }
        catch (Exception e) { toast("Cannot start downloader: " + shortText(e.getMessage(), 80)); }
    }

    private void renderList() {
        JSONArray jobs = Store.list(this);
        lastRendered = jobs.toString();
        listBody.removeAllViews();
        boolean history = tab == 3;
        listBody.addView(text(history ? "DOWNLOAD HISTORY" : "DOWNLOAD QUEUE", 14, LCD, true));
        TextView subtitle = text(history ? "Completed downloads • saved on this phone"
                : "Live progress • background queue • tap CANCEL to stop", 11, SUBTLE, false);
        subtitle.setPadding(0, dp(4), 0, dp(12));
        listBody.addView(subtitle);
        int count = 0;
        for (int i = 0; i < jobs.length(); i++) {
            JSONObject job = jobs.optJSONObject(i);
            if (job == null) continue;
            String state = job.optString("state");
            if (history != "DONE".equals(state)) continue;
            count++;
            makeJobRow(job);
        }
        if (count == 0) {
            TextView empty = text(history ? "NO COMPLETED DOWNLOADS YET" : "QUEUE EMPTY", 14, SUBTLE, false);
            empty.setPadding(dp(10), dp(24), dp(10), dp(24));
            empty.setBackground(lcdBackground());
            listBody.addView(empty);
        }
        if (tab != 0 && tab != 1) status.setText(history ? "HISTORY: " + count + " COMPLETED" : "QUEUE: " + count + " ITEMS");
    }

    private void makeJobRow(JSONObject job) {
        String id = job.optString("id");
        String state = job.optString("state");
        String url = job.optString("url");
        String itemMode = job.optString("mode", "BEST");
        String uri = job.optString("uri");
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(11), dp(10), dp(11), dp(10));
        card.setBackground(panelBackground());
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(-1, -2);
        cp.bottomMargin = dp(9);
        listBody.addView(card, cp);

        card.addView(text(shortText(job.optString("title", "Media"), 100), 13, 0xffe5edf7, true));
        TextView details = text(state + "  •  " + itemMode + "  •  " + job.optInt("progress") + "%", 11,
                "FAILED".equals(state) ? 0xffffb0a1 : LCD, false);
        details.setPadding(0, dp(5), 0, dp(5));
        card.addView(details);

        if (!"DONE".equals(state)) {
            ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            progress.setMax(100);
            progress.setProgress(job.optInt("progress"));
            card.addView(progress, new LinearLayout.LayoutParams(-1, dp(5)));
        }
        TextView info = text(shortText(job.optString("detail"), 150), 10, SUBTLE, false);
        info.setPadding(0, dp(7), 0, dp(7));
        card.addView(info);

        LinearLayout row = new LinearLayout(this);
        if ("DONE".equals(state) && !uri.isEmpty()) {
            Button open = button("OPEN", 0xff416748);
            row.addView(open, new LinearLayout.LayoutParams(0, dp(39), 1));
            open.setOnClickListener(v -> openFile(uri));
        } else if ("QUEUED".equals(state) || "DOWNLOADING".equals(state)) {
            Button cancel = button("CANCEL", 0xff5c4147);
            row.addView(cancel, new LinearLayout.LayoutParams(0, dp(39), 1));
            cancel.setOnClickListener(v -> launchService(DownloadService.CANCEL, null, null, id));
        } else {
            Button retry = button("RETRY", 0xff416748);
            row.addView(retry, new LinearLayout.LayoutParams(0, dp(39), 1));
            retry.setOnClickListener(v -> launchService(DownloadService.ADD, url, itemMode, null));
        }
        Button copy = button("COPY LINK", STEEL);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(39), 1);
        p.leftMargin = dp(8);
        row.addView(copy, p);
        copy.setOnClickListener(v -> {
            ((ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE))
                    .setPrimaryClip(ClipData.newPlainText("media URL", url));
            toast("Link copied");
        });
        card.addView(row);
    }

    private void openFile(String rawUri) {
        try {
            Intent open = new Intent(Intent.ACTION_VIEW);
            open.setDataAndType(Uri.parse(rawUri), "*/*");
            open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(open, "Open downloaded file"));
        } catch (Exception e) { toast("Cannot open file; check Downloads / Save em all"); }
    }

    private void updateFooter() {
        JSONArray jobs = Store.list(this);
        int done = 0, pending = 0, failed = 0;
        for (int i = 0; i < jobs.length(); i++) {
            JSONObject job = jobs.optJSONObject(i);
            if (job == null) continue;
            String s = job.optString("state");
            if ("DONE".equals(s)) done++;
            else if ("QUEUED".equals(s) || "DOWNLOADING".equals(s)) pending++;
            else if ("FAILED".equals(s)) failed++;
        }
        footer.setText(done + " SAVED   •   " + pending + " PENDING   •   " + failed + " FAILED");
    }

    private void receiveLink(Intent intent) {
        if (intent == null) return;
        String value = Intent.ACTION_SEND.equals(intent.getAction())
                ? intent.getStringExtra(Intent.EXTRA_TEXT) : intent.getDataString();
        if (value == null || value.isEmpty()) return;
        String link = extractLink(value);
        if (DownloadService.validUrl(link)) {
            address.setText(link);
            switchTab(0);
            preview.setText("SHARED LINK READY\n\nTap ANALYZE or DOWNLOAD.");
            status.setText("LINK IMPORTED FROM ANOTHER APP");
        }
    }

    private String extractLink(String raw) {
        Matcher matcher = Pattern.compile("https?://[^\\s<>]+", Pattern.CASE_INSENSITIVE).matcher(raw);
        if (matcher.find()) return matcher.group().replaceAll("[),.;]+$", "");
        return raw.trim();
    }

    private String normalize(String input) {
        String url = input == null ? "" : input.trim();
        if (url.startsWith("www.")) url = "https://" + url;
        return url;
    }

    private void hideKeyboard() {
        ((InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE))
                .hideSoftInputFromWindow(address.getWindowToken(), 0);
        address.clearFocus();
    }

    private TextView text(String label, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(label);
        view.setTextColor(color);
        view.setTextSize(size);
        view.setTypeface(Typeface.MONOSPACE, bold ? Typeface.BOLD : Typeface.NORMAL);
        view.setGravity(Gravity.CENTER_VERTICAL);
        return view;
    }

    private Button button(String label, int color) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(0xfff0f2f6);
        button.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        button.setTextSize(11);
        button.setPadding(dp(3), 0, dp(3), 0);
        button.setMinHeight(0);
        button.setMinimumHeight(0);
        button.setBackground(buttonBackground(color));
        return button;
    }

    private GradientDrawable buttonBackground(int color) {
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{lighten(color, 16), color, 0xff1a222d});
        bg.setCornerRadius(dp(4));
        bg.setStroke(dp(1), 0xff55647a);
        return bg;
    }

    private GradientDrawable lcdBackground() {
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xff142016);
        bg.setCornerRadius(dp(5));
        bg.setStroke(dp(1), 0xff415b41);
        return bg;
    }

    private GradientDrawable panelBackground() {
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xff232d3a);
        bg.setCornerRadius(dp(5));
        bg.setStroke(dp(1), 0xff465369);
        return bg;
    }

    private int lighten(int c, int amount) {
        return Color.rgb(Math.min(255, Color.red(c) + amount),
                Math.min(255, Color.green(c) + amount),
                Math.min(255, Color.blue(c) + amount));
    }

    private int dp(float value) { return (int)(value * getResources().getDisplayMetrics().density + 0.5f); }
    private static String shortText(String s, int limit) {
        if (s == null || s.isEmpty()) return "-";
        return s.length() > limit ? s.substring(0, limit) + "…" : s;
    }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_SHORT).show(); }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        receiveLink(intent);
    }
    @Override public void onBackPressed() {
        if (tab == 1 && browser.canGoBack()) browser.goBack();
        else if (tab != 0) switchTab(0);
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        destroyed = true;
        ui.removeCallbacks(tick);
        browser.destroy();
        super.onDestroy();
    }
}
