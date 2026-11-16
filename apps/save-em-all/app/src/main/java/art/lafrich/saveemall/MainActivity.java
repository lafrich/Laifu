package art.lafrich.saveemall;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
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
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
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
    private TextView engineInfo;
    private TextView proxyInfo;
    private EditText proxyInput;
    private Button updateButton;
    private Button captureButton;
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
    private String discoveredUrl;
    private String discoveredReferer;
    private String discoveredAgent;
    private String selectedMediaUrl;
    private String selectedReferer;
    private String selectedAgent;

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
        // Defer automatic yt-dlp update until the app has been idle for a while.
        // A lengthy update must never be the first thing blocking user downloads.
        ui.postDelayed(() -> {
            if (!destroyed && noActiveDownloads()) updateEngine(false);
        }, 45000L);
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
        captureButton = button("PLAY VIDEO IN WEB TO DETECT STREAM", STEEL);
        captureButton.setEnabled(false);
        captureButton.setOnClickListener(v -> useCapturedStream());
        LinearLayout.LayoutParams captureParams = new LinearLayout.LayoutParams(-1, dp(43));
        captureParams.topMargin = dp(8);
        root.addView(captureButton, captureParams);

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

        body.addView(text("VIDARA + PORNHUB / STREAM CAPTURE", 13, LCD, true));
        TextView intro = text("Vidara: gunakan link /e/ID atau /v/ID. Pornhub: tempel link halaman satu video. yt-dlp menangani stream publik yang boleh disimpan, tanpa melewati login, blokir akses, atau DRM.", 12, SUBTLE, false);
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

        TextView settingsTitle = text("ENGINE / NETWORK SETTINGS", 12, LCD, true);
        settingsTitle.setPadding(0, dp(19), 0, dp(10));
        body.addView(settingsTitle);

        engineInfo = text("YT-DLP • Checking engine...", 11, SUBTLE, false);
        engineInfo.setPadding(dp(9), dp(7), dp(9), dp(8));
        engineInfo.setBackground(panelBackground());
        body.addView(engineInfo);

        updateButton = button("↻ UPDATE YT-DLP NOW", STEEL);
        LinearLayout.LayoutParams engineButtonParams = new LinearLayout.LayoutParams(-1, dp(44));
        engineButtonParams.topMargin = dp(7);
        body.addView(updateButton, engineButtonParams);
        updateButton.setOnClickListener(v -> updateEngine(true));

        TextView proxyHeader = text("PROXY FOR ANALYZE & DOWNLOAD", 11, LCD, true);
        proxyHeader.setPadding(0, dp(18), 0, dp(8));
        body.addView(proxyHeader);

        proxyInput = new EditText(this);
        proxyInput.setSingleLine(true);
        proxyInput.setTextSize(12);
        proxyInput.setTypeface(Typeface.MONOSPACE);
        proxyInput.setTextColor(LCD);
        proxyInput.setHintTextColor(0xff849779);
        proxyInput.setHint("socks5://host:1080 or http://host:8080");
        proxyInput.setText(ProxySettings.get(this));
        proxyInput.setPadding(dp(9), 0, dp(9), 0);
        proxyInput.setBackground(lcdBackground());
        body.addView(proxyInput, new LinearLayout.LayoutParams(-1, dp(47)));

        LinearLayout proxyActions = new LinearLayout(this);
        Button saveProxy = button("SAVE PROXY", 0xff416748);
        proxyActions.addView(saveProxy, new LinearLayout.LayoutParams(0, dp(42), 1));
        saveProxy.setOnClickListener(v -> saveProxy());
        Button clearProxy = button("DIRECT / RESET", STEEL);
        LinearLayout.LayoutParams clearParams = new LinearLayout.LayoutParams(0, dp(42), 1);
        clearParams.leftMargin = dp(8);
        proxyActions.addView(clearProxy, clearParams);
        clearProxy.setOnClickListener(v -> {
            proxyInput.setText("");
            ProxySettings.save(this, "");
            proxyInfo.setText(ProxySettings.status(this));
            status.setText("PROXY DISABLED • DIRECT CONNECTION");
        });
        LinearLayout.LayoutParams proxyButtonsParams = new LinearLayout.LayoutParams(-1, dp(42));
        proxyButtonsParams.topMargin = dp(8);
        body.addView(proxyActions, proxyButtonsParams);

        proxyInfo = text(ProxySettings.status(this), 10, SUBTLE, false);
        proxyInfo.setPadding(dp(3), dp(8), dp(3), dp(4));
        body.addView(proxyInfo);
        TextView proxyHint = text("HTTP(S), SOCKS4/5/5h. Use a proxy you control/trust. Credentials stay on this device. "
                + "Proxy applies to downloader only; WEB tab uses your phone network.", 10, SUBTLE, false);
        body.addView(proxyHint);

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
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                discoveredUrl = null;
                discoveredReferer = null;
                discoveredAgent = null;
                refreshCaptureButton();
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (tab == 1 && DownloadService.validUrl(url)) {
                    address.setText(url);
                    if (PornhubSupport.isSupportedHost(url) && discoveredUrl == null)
                        status.setText("WEB: PLAY VIDEO, THEN USE DETECTED MEDIA STREAM");
                }
            }
            @Override public WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                // Observe media that the browser requests on its own.
                // Do not intercept responses, extract cookies, or bypass DRM.
                if (!request.isForMainFrame()) {
                    String candidate = request.getUrl().toString();
                    if (isMediaResource(candidate)) ui.post(() -> {
                        if (destroyed || !PornhubSupport.isSupportedHost(view.getUrl())) return;
                        discoveredUrl = candidate;
                        discoveredReferer = view.getUrl();
                        discoveredAgent = view.getSettings().getUserAgentString();
                        refreshCaptureButton();
                        if (tab == 1) status.setText("WEB: MEDIA LINK DETECTED");
                    });
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
        page.setDownloadListener((url, agent, disposition, mime, size) -> {
            if (!DownloadService.validUrl(url)) return;
            discoveredUrl = url;
            discoveredReferer = page.getUrl();
            discoveredAgent = agent;
            refreshCaptureButton();
            status.setText("WEB: DOWNLOAD LINK DETECTED");
        });
        return page;
    }

    private static boolean isMediaResource(String input) {
        if (!DownloadService.validUrl(input)) return false;
        String path = Uri.parse(input).getPath();
        return path != null && path.toLowerCase(Locale.ROOT)
                .matches(".*\\.(m3u8|mpd|mp4|m4v|webm)$");
    }

    private void refreshCaptureButton() {
        if (captureButton == null) return;
        boolean ready = DownloadService.validUrl(discoveredUrl);
        captureButton.setVisibility(tab == 1 ? View.VISIBLE : View.GONE);
        captureButton.setEnabled(ready);
        captureButton.setText(ready ? "USE DETECTED MEDIA STREAM"
                : "PLAY VIDEO IN WEB TO DETECT STREAM");
    }

    private void useCapturedStream() {
        if (!DownloadService.validUrl(discoveredUrl)) {
            toast("Play the video first");
            return;
        }
        selectedMediaUrl = discoveredUrl;
        selectedReferer = discoveredReferer;
        selectedAgent = discoveredAgent;
        address.setText(selectedMediaUrl);
        switchTab(0);
        preview.setText("WEB MEDIA DETECTED\n\n" + Uri.parse(selectedMediaUrl).getHost()
                + "\nChoose BEST / SOURCE, then DOWNLOAD.");
        status.setText("MEDIA CAPTURED • READY TO DOWNLOAD");
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
        refreshCaptureButton();
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
                if (VidaraResolver.wrongDomain(url)) {
                    throw new IllegalArgumentException("vidara.com adalah situs perusahaan. Untuk host video gunakan vidara.so atau viewdara.com.");
                }
                if (VidaraResolver.isSupportedHost(url)) {
                    VidaraResolver.Result media = VidaraResolver.resolve(this, url);
                    result = "VIDARA STREAM FOUND\n\n" + media.title + "\nHLS • " + media.filecode;
                } else {
                    VideoInfo info;
                    synchronized (EngineManager.LOCK) {
                        EngineManager.initialize(getApplicationContext());
                        com.yausername.youtubedl_android.YoutubeDLRequest request =
                                new com.yausername.youtubedl_android.YoutubeDLRequest(url);
                        ProxySettings.apply(this, request);
                        PornhubSupport.apply(request, url);
                        applyCapturedHeaders(request, url);
                        info = YoutubeDL.getInstance().getInfo(request);
                    }
                    String title = info == null ? null : info.getTitle();
                    result = (PornhubSupport.isSupportedHost(url) ? "PORNHUB VIDEO DETECTED" : "MEDIA DETECTED")
                            + "\n\n" + (title == null ? Uri.parse(url).getHost() : title);
                }
                found = true;
            } catch (Exception e) {
                result = "PREVIEW UNAVAILABLE\n\nTry DOWNLOAD directly. " + shortText(ProxySettings.redact(this, e.getMessage()), 115);
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

    private void applyCapturedHeaders(
            com.yausername.youtubedl_android.YoutubeDLRequest request, String url) {
        if (url.equals(selectedMediaUrl) && DownloadService.validUrl(selectedReferer)) {
            request.addOption("--referer", selectedReferer);
            if (selectedAgent != null && !selectedAgent.isEmpty())
                request.addOption("--user-agent", selectedAgent);
        }
    }

    private void saveProxy() {
        try {
            ProxySettings.save(this, proxyInput.getText().toString());
            proxyInfo.setText(ProxySettings.status(this));
            status.setText("NETWORK SETTINGS SAVED");
            hideKeyboard();
            toast("Proxy configuration saved");
        } catch (IllegalArgumentException e) {
            toast(e.getMessage());
        }
    }

    private boolean noActiveDownloads() {
        JSONArray items = Store.list(this);
        for (int i = 0; i < items.length(); i++) {
            JSONObject job = items.optJSONObject(i);
            if (job != null && ("QUEUED".equals(job.optString("state"))
                    || "DOWNLOADING".equals(job.optString("state")))) return false;
        }
        return !inspectRunning;
    }

    private void updateEngine(boolean manual) {
        if (updateButton == null) return;
        updateButton.setEnabled(false);
        engineInfo.setText("YT-DLP • Updating/checking (internet required)...");
        status.setText("CHECKING DOWNLOADER ENGINE...");
        new Thread(() -> {
            EngineManager.Result result = EngineManager.update(getApplicationContext(), manual);
            runOnUiThread(() -> {
                if (destroyed) return;
                updateButton.setEnabled(true);
                engineInfo.setText("YT-DLP • " + result.version + "\n" + result.message);
                status.setText(result.success ? "ENGINE READY" : "ENGINE UPDATE UNAVAILABLE");
                if (manual) toast(result.message);
            });
        }, "yt-dlp-update").start();
    }

    private void queueDownload() {
        String url = normalize(address.getText().toString());
        if (!DownloadService.validUrl(url)) { toast("Enter a valid http(s) URL"); return; }
        boolean queued = launchService(DownloadService.ADD, url, mode, null);
        if (queued) {
            status.setText("QUEUED • OPEN QUEUE FOR LIVE PROGRESS");
            switchTab(2);
        } else status.setText("COULD NOT START DOWNLOAD SERVICE");
    }

    private boolean launchService(String action, String url, String format, String id) {
        String queuedId = id;
        if (DownloadService.ADD.equals(action) && url != null) {
            String referer = url.equals(selectedMediaUrl) ? selectedReferer : null;
            String agent = url.equals(selectedMediaUrl) ? selectedAgent : null;
            queuedId = Store.add(this, url, format == null ? "BEST" : format, referer, agent);
        }
        Intent intent = new Intent(this, DownloadService.class).setAction(action);
        if (url != null) intent.putExtra(DownloadService.EXTRA_URL, url);
        if (format != null) intent.putExtra(DownloadService.EXTRA_MODE, format);
        if (queuedId != null) intent.putExtra(DownloadService.EXTRA_ID, queuedId);
        try {
            startForegroundService(intent);
            return true;
        } catch (Exception e) {
            if (DownloadService.ADD.equals(action) && queuedId != null)
                Store.patch(this, queuedId, "FAILED", 0,
                        "Gagal memulai service: " + shortText(e.getMessage(), 180), null, null);
            toast("Cannot start downloader: " + shortText(e.getMessage(), 80));
            return false;
        }
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

        if ("FAILED".equals(state)) {
            Button show = button("WHY FAILED? / COPY ERROR", 0xff70474b);
            LinearLayout.LayoutParams showParams = new LinearLayout.LayoutParams(-1, dp(37));
            showParams.bottomMargin = dp(9);
            card.addView(show, showParams);
            show.setOnClickListener(v -> {
                String detail = job.optString("detail", "Unknown error");
                new android.app.AlertDialog.Builder(this)
                        .setTitle("Download failed")
                        .setMessage(detail + "\n\nURL: " + url)
                        .setPositiveButton("COPY ERROR", (dialog, which) -> {
                            ((ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE))
                                    .setPrimaryClip(ClipData.newPlainText("Save em all error", detail));
                            toast("Error copied");
                        })
                        .setNegativeButton("CLOSE", null)
                        .show();
            });
        }

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
