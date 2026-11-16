package art.lafrich.screenoff;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.google.common.util.concurrent.ListenableFuture;
import org.json.JSONArray;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Browser tabs + one native Media3 mini-player.
 *
 * MediaController talks to PlaybackService; the WebView and Activity can be
 * backgrounded/hidden without stopping playback. One MediaSession powers the
 * Android lock-screen/media notification and this app's mini-player.
 */
public final class MainActivity extends Activity {
    private static final int YOUTUBE = 0;
    private static final int MUSIC = 1;
    private static final int PLAYER_TAB = 2;
    private static final int HISTORY_TAB = 3;
    private static final int LCD = 0xffc5ff79;
    private static final int PANEL = 0xff1d2430;

    private final WebView[] pages = new WebView[2];
    private final String[] addressDrafts = {"", ""};
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
    private int currentTab = YOUTUBE;
    private int lastBrowserTab = YOUTUBE;
    private boolean musicLoaded;
    private boolean dragging;
    private boolean destroyed;
    private boolean tickerRunning;

    private EditText address;
    private TextView hint;
    private TextView miniTitle;
    private TextView miniQueue;
    private TextView timeInfo;
    private TextView detailTitle;
    private TextView queueDetails;
    private Button youtubeTab;
    private Button musicTab;
    private Button playerTab;
    private Button historyTab;
    private LinearLayout historyList;
    private ScrollView historyPage;
    private Button playButton;
    private Button playPauseBtn;
    private Button prevBtn;
    private Button nextBtn;
    private Button speedBtn;
    private SeekBar progress;
    private LinearLayout linkRow;
    private LinearLayout playRow;
    private FrameLayout browserHolder;
    private ScrollView detailPage;

    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;

    private final Player.Listener listener = new Player.Listener() {
        @Override public void onEvents(Player player, Player.Events events) {
            refreshPlayer();
        }
    };
    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            if (!tickerRunning || destroyed) return;
            refreshProgress();
            uiHandler.postDelayed(this, 500);
        }
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xff10151b);
        getWindow().setNavigationBarColor(0xff10151b);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xff161c25);
        root.setPadding(dp(12), dp(8), dp(12), dp(8));

        LinearLayout brandRow = new LinearLayout(this);
        brandRow.setGravity(Gravity.CENTER_VERTICAL);
        brandRow.setPadding(dp(4), dp(3), dp(4), dp(11));
        TextView heading = label("FREE YOUTUBE", 19, 0xfff0f2f6, true);
        heading.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        brandRow.addView(heading, new LinearLayout.LayoutParams(0, -2, 1));
        TextView credit = label("by Lafrich", 11, 0xffb5c8e4, false);
        credit.setTypeface(Typeface.MONOSPACE);
        brandRow.addView(credit);
        root.addView(brandRow);

        LinearLayout tabRow = new LinearLayout(this);
        youtubeTab = button("VIDEO", 0xff303b50);
        musicTab = button("MUSIC", 0xff303b50);
        playerTab = button("PLAYER", 0xff303b50);
        historyTab = button("HISTORY", 0xff303b50);
        tabRow.addView(youtubeTab, tabParams(0));
        tabRow.addView(musicTab, tabParams(5));
        tabRow.addView(playerTab, tabParams(5));
        tabRow.addView(historyTab, tabParams(5));
        root.addView(tabRow);
        youtubeTab.setOnClickListener(v -> switchTo(YOUTUBE));
        musicTab.setOnClickListener(v -> switchTo(MUSIC));
        playerTab.setOnClickListener(v -> switchTo(PLAYER_TAB));
        historyTab.setOnClickListener(v -> switchTo(HISTORY_TAB));

        linkRow = new LinearLayout(this);
        linkRow.setOrientation(LinearLayout.HORIZONTAL);
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextColor(LCD);
        address.setHintTextColor(0xff82977a);
        address.setTextSize(12);
        address.setTypeface(Typeface.MONOSPACE);
        address.setHint("Link YouTube atau cari video");
        address.setPadding(dp(12), 0, dp(8), 0);
        address.setBackground(lcd());
        linkRow.addView(address, new LinearLayout.LayoutParams(0, dp(48), 1));

        Button go = button("GO", 0xff39435a);
        LinearLayout.LayoutParams goParams = new LinearLayout.LayoutParams(dp(72), dp(48));
        goParams.leftMargin = dp(8);
        linkRow.addView(go, goParams);
        go.setOnClickListener(v -> navigate());
        LinearLayout.LayoutParams linkParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
        linkParams.topMargin = dp(10);
        root.addView(linkRow, linkParams);

        FrameLayout contentHost = new FrameLayout(this);
        LinearLayout.LayoutParams contentParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1);
        contentParams.topMargin = dp(10);
        root.addView(contentHost, contentParams);

        browserHolder = new FrameLayout(this);
        pages[YOUTUBE] = makeBrowser();
        pages[MUSIC] = makeBrowser();
        browserHolder.addView(pages[YOUTUBE], new FrameLayout.LayoutParams(-1, -1));
        browserHolder.addView(pages[MUSIC], new FrameLayout.LayoutParams(-1, -1));
        pages[MUSIC].setVisibility(View.GONE);
        contentHost.addView(browserHolder, new FrameLayout.LayoutParams(-1, -1));

        detailPage = makeDetailPage();
        detailPage.setVisibility(View.GONE);
        contentHost.addView(detailPage, new FrameLayout.LayoutParams(-1, -1));

        historyPage = makeHistoryPage();
        historyPage.setVisibility(View.GONE);
        contentHost.addView(historyPage, new FrameLayout.LayoutParams(-1, -1));

        playRow = new LinearLayout(this);
        playRow.setOrientation(LinearLayout.HORIZONTAL);
        playButton = button("▶ PLAY NOW", 0xff416047);
        playRow.addView(playButton, new LinearLayout.LayoutParams(0, dp(50), 1));
        playButton.setOnClickListener(v -> playSelected(false));

        Button enqueueButton = button("+ QUEUE", 0xff303b50);
        LinearLayout.LayoutParams queueParams = new LinearLayout.LayoutParams(0, dp(50), 0.65f);
        queueParams.leftMargin = dp(8);
        playRow.addView(enqueueButton, queueParams);
        enqueueButton.setOnClickListener(v -> playSelected(true));
        LinearLayout.LayoutParams controlsParams = new LinearLayout.LayoutParams(-1, dp(50));
        controlsParams.topMargin = dp(8);
        root.addView(playRow, controlsParams);

        root.addView(makeMiniPlayer());

        hint = new TextView(this);
        hint.setTextColor(0xff99a8bd);
        hint.setTypeface(Typeface.MONOSPACE);
        hint.setTextSize(10);
        hint.setPadding(dp(3), dp(7), dp(3), dp(2));
        root.addView(hint);

        setContentView(root);
        updateTabs();
        refreshPlayer();
        pages[YOUTUBE].loadUrl("https://m.youtube.com/");
        consumeSharedIntent(getIntent());
        connectPlayer();
    }

    private LinearLayout.LayoutParams tabParams(int left) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(42), 1);
        p.leftMargin = dp(left);
        return p;
    }

    private ScrollView makeDetailPage() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout detail = new LinearLayout(this);
        detail.setOrientation(LinearLayout.VERTICAL);
        detail.setPadding(dp(16), dp(18), dp(16), dp(18));

        TextView eyebrow = label("PLAYLIST EDITOR / NOW PLAYING", 12, LCD, true);
        detail.addView(eyebrow);

        detailTitle = label("NO TRACK LOADED", 23, LCD, true);
        detailTitle.setTypeface(Typeface.MONOSPACE);
        detailTitle.setBackground(lcd());
        detailTitle.setPadding(dp(12), dp(12), dp(12), dp(12));
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(-1, -2);
        titleParams.topMargin = dp(18);
        detail.addView(detailTitle, titleParams);

        TextView desc = label(
                "Kontrol player selalu tersedia di bagian bawah, termasuk saat kamu berpindah tab.",
                13, 0xffb8bbca, false);
        LinearLayout.LayoutParams descParams = new LinearLayout.LayoutParams(-1, -2);
        descParams.topMargin = dp(18);
        detail.addView(desc, descParams);

        TextView upnext = label("QUEUE / PLAYLIST", 13, LCD, true);
        LinearLayout.LayoutParams queueHeadingParams = new LinearLayout.LayoutParams(-1, -2);
        queueHeadingParams.topMargin = dp(34);
        detail.addView(upnext, queueHeadingParams);

        queueDetails = label("NO TRACKS", 13, LCD, false);
        queueDetails.setTypeface(Typeface.MONOSPACE);
        queueDetails.setBackground(lcd());
        queueDetails.setPadding(dp(12), dp(12), dp(12), dp(12));
        queueDetails.setLineSpacing(dp(6), 1);
        LinearLayout.LayoutParams queueListParams = new LinearLayout.LayoutParams(-1, -2);
        queueListParams.topMargin = dp(12);
        detail.addView(queueDetails, queueListParams);

        TextView note = label(
                "ADD TO PLAYLIST: pilih lagu di VIDEO atau MUSIC lalu tekan + QUEUE. NEXT hanya tersedia jika ada lebih dari satu track.",
                12, 0xff9b9fae, false);
        LinearLayout.LayoutParams noteParams = new LinearLayout.LayoutParams(-1, -2);
        noteParams.topMargin = dp(28);
        detail.addView(note, noteParams);
        scroll.addView(detail);
        return scroll;
    }

    private ScrollView makeHistoryPage() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout outer = new LinearLayout(this);
        outer.setOrientation(LinearLayout.VERTICAL);
        outer.setPadding(dp(5), dp(10), dp(5), dp(10));

        LinearLayout headingRow = new LinearLayout(this);
        headingRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = label("RECENTLY PLAYED", 17, LCD, true);
        title.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        headingRow.addView(title, new LinearLayout.LayoutParams(0, dp(44), 1));
        Button erase = button("CLEAR", 0xff3c4457);
        headingRow.addView(erase, new LinearLayout.LayoutParams(dp(76), dp(38)));
        erase.setOnClickListener(v -> new android.app.AlertDialog.Builder(this)
                .setTitle("Hapus riwayat?")
                .setMessage("Semua riwayat pemutaran di HP ini akan dihapus.")
                .setNegativeButton("BATAL", null)
                .setPositiveButton("HAPUS", (dialog, which) -> {
                    PlaybackHistory.clear(this);
                    refreshHistory();
                }).show());
        outer.addView(headingRow);

        TextView explanation = label(
                "50 LAST TRACKS   /   SAVED ON THIS DEVICE\nRESUME: LANJUT  •  RESTART: AWAL",
                11, 0xffa4bbd6, false);
        explanation.setTypeface(Typeface.MONOSPACE);
        explanation.setPadding(dp(3), dp(7), dp(3), dp(12));
        outer.addView(explanation);

        historyList = new LinearLayout(this);
        historyList.setOrientation(LinearLayout.VERTICAL);
        outer.addView(historyList);
        scroll.addView(outer);
        return scroll;
    }

    private void refreshHistory() {
        if (historyList == null) return;
        historyList.removeAllViews();
        java.util.List<PlaybackHistory.Entry> entries = PlaybackHistory.list(this);
        if (entries.isEmpty()) {
            TextView empty = label(
                    "NO HISTORY\n\nPutar video atau musik. Riwayat akan tercatat saat audio mulai diputar.",
                    13, LCD, false);
            empty.setTypeface(Typeface.MONOSPACE);
            empty.setBackground(lcd());
            empty.setPadding(dp(16), dp(22), dp(16), dp(22));
            historyList.addView(empty);
            return;
        }
        java.text.SimpleDateFormat date =
                new java.text.SimpleDateFormat("dd MMM  HH:mm", Locale.getDefault());
        int number = 1;
        for (PlaybackHistory.Entry entry : entries) {
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setBackground(lcd());
            card.setPadding(dp(12), dp(10), dp(12), dp(12));

            TextView title = label(
                    String.format(Locale.US, "%02d  %s", number++, entry.title),
                    13, LCD, true);
            title.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
            title.setMaxLines(2);
            title.setEllipsize(android.text.TextUtils.TruncateAt.END);
            card.addView(title);

            String details = date.format(new java.util.Date(entry.playedAt))
                    + "   /   LAST POS " + formatTime(entry.positionMs);
            TextView info = label(details, 10, 0xff8fa979, false);
            info.setTypeface(Typeface.MONOSPACE);
            LinearLayout.LayoutParams infoParams = new LinearLayout.LayoutParams(-1, -2);
            infoParams.topMargin = dp(5);
            card.addView(info, infoParams);

            LinearLayout actions = new LinearLayout(this);
            LinearLayout.LayoutParams actionsParams = new LinearLayout.LayoutParams(-1, dp(40));
            actionsParams.topMargin = dp(9);
            Button resume = button("▶ LANJUT", 0xff416047);
            Button restart = button("↻ AWAL", 0xff39435a);
            Button queue = button("+ QUEUE", 0xff39435a);
            actions.addView(resume, new LinearLayout.LayoutParams(0, dp(40), 1));
            LinearLayout.LayoutParams restartParams = new LinearLayout.LayoutParams(0, dp(40), .8f);
            restartParams.leftMargin = dp(5);
            actions.addView(restart, restartParams);
            LinearLayout.LayoutParams queueParams = new LinearLayout.LayoutParams(0, dp(40), .85f);
            queueParams.leftMargin = dp(5);
            actions.addView(queue, queueParams);
            resume.setOnClickListener(v -> playHistory(entry, true, false));
            restart.setOnClickListener(v -> playHistory(entry, false, false));
            queue.setOnClickListener(v -> playHistory(entry, false, true));
            card.addView(actions, actionsParams);

            LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1, -2);
            cardParams.bottomMargin = dp(8);
            historyList.addView(card, cardParams);
        }
    }

    private void playHistory(PlaybackHistory.Entry entry, boolean resume, boolean queue) {
        Intent i = new Intent(this, PlaybackService.class);
        i.setAction(queue ? PlaybackService.ACTION_QUEUE_URL : PlaybackService.ACTION_PLAY_URL);
        i.putExtra(PlaybackService.EXTRA_URL, entry.url);
        if (resume && !queue) i.putExtra(
                PlaybackService.EXTRA_POSITION_MS, entry.positionMs);
        startService(i);
        toast(queue ? "Menambahkan ke antrean…" :
                resume ? "Melanjutkan lagu…" : "Memutar dari awal…");
    }

    private LinearLayout makeMiniPlayer() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(10), dp(9), dp(10), dp(10));
        card.setBackground(metal(0xff495568, 0xff212a37));
        LinearLayout.LayoutParams outerParams = new LinearLayout.LayoutParams(-1, -2);
        outerParams.topMargin = dp(8);

        LinearLayout head = new LinearLayout(this);
        head.setOrientation(LinearLayout.HORIZONTAL);
        miniTitle = label("NO TRACK LOADED", 13, LCD, true);
        miniTitle.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        miniTitle.setPadding(dp(8), dp(6), dp(8), dp(6));
        miniTitle.setSingleLine(true);
        miniTitle.setEllipsize(android.text.TextUtils.TruncateAt.END);
        head.addView(miniTitle, new LinearLayout.LayoutParams(0, -2, 1));
        miniQueue = label("00/00", 11, LCD, false);
        miniQueue.setTypeface(Typeface.MONOSPACE);
        miniQueue.setPadding(dp(4), dp(6), dp(8), dp(6));
        LinearLayout.LayoutParams queuePosition = new LinearLayout.LayoutParams(-2, -2);
        queuePosition.leftMargin = dp(8);
        head.addView(miniQueue, queuePosition);
        head.setBackground(lcd());
        card.addView(head);

        TextView eq = label("▂ ▅ █ ▆ ▃  · · ·    44.1 kHz   /   STEREO   /   AUDIO", 10, LCD, false);
        eq.setTypeface(Typeface.MONOSPACE);
        eq.setPadding(dp(8), dp(3), dp(8), 0);
        card.addView(eq);

        LinearLayout timeline = new LinearLayout(this);
        timeline.setOrientation(LinearLayout.HORIZONTAL);
        progress = new SeekBar(this);
        progress.setMax(1000);
        timeline.addView(progress, new LinearLayout.LayoutParams(0, dp(32), 1));
        timeInfo = label("00:00 / --:--", 10, LCD, false);
        timeInfo.setTypeface(Typeface.MONOSPACE);
        timeInfo.setGravity(Gravity.CENTER_VERTICAL);
        timeline.addView(timeInfo, new LinearLayout.LayoutParams(-2, dp(32)));
        card.addView(timeline);
        progress.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onStartTrackingTouch(SeekBar seekBar) {
                dragging = true;
            }
            @Override public void onStopTrackingTouch(SeekBar seekBar) {
                dragging = false;
                if (controller == null) return;
                long d = controller.getDuration();
                if (d > 0 && d != C.TIME_UNSET) {
                    controller.seekTo((long) ((double) d * seekBar.getProgress() / 1000.0));
                }
            }
            @Override public void onProgressChanged(SeekBar seekBar, int value, boolean fromUser) { }
        });

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        Button backward = button("−15", 0xff303b50);
        prevBtn = button("⏮", 0xff303b50);
        playPauseBtn = button("▶", 0xff416047);
        nextBtn = button("⏭", 0xff303b50);
        Button forward = button("+15", 0xff303b50);
        speedBtn = button("1×", 0xff303b50);
        Button[] all = {backward, prevBtn, playPauseBtn, nextBtn, forward, speedBtn};
        for (int i = 0; i < all.length; i++) {
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(42), 1);
            if (i != 0) p.leftMargin = dp(4);
            buttons.addView(all[i], p);
        }
        backward.setOnClickListener(v -> jump(-15000));
        forward.setOnClickListener(v -> jump(15000));
        prevBtn.setOnClickListener(v -> previousTrack());
        nextBtn.setOnClickListener(v -> nextTrack());
        playPauseBtn.setOnClickListener(v -> togglePlayback());
        speedBtn.setOnClickListener(v -> cycleSpeed());
        card.addView(buttons);

        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        wrapper.addView(card, outerParams);
        return wrapper;
    }

    private TextView label(String value, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextColor(color);
        t.setTextSize(size);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return t;
    }

    private void connectPlayer() {
        SessionToken token = new SessionToken(
                this, new ComponentName(this, PlaybackService.class));
        controllerFuture = new MediaController.Builder(this, token).buildAsync();
        controllerFuture.addListener(() -> {
            if (destroyed) return;
            try {
                controller = controllerFuture.get();
                controller.addListener(listener);
                refreshPlayer();
            } catch (Exception e) {
                hint.setText("Gagal menghubungkan player. Coba tutup lalu buka lagi aplikasi.");
            }
        }, command -> runOnUiThread(command));
    }

    private void refreshPlayer() {
        if (miniTitle == null) return;

        boolean hasItem = controller != null && controller.getMediaItemCount() > 0;
        int count = hasItem ? controller.getMediaItemCount() : 0;
        int index = hasItem ? controller.getCurrentMediaItemIndex() : 0;
        MediaItem item = hasItem ? controller.getCurrentMediaItem() : null;
        CharSequence title = item == null ? null : item.mediaMetadata.title;
        String name = title == null || title.length() == 0
                ? (hasItem ? "Track " + (index + 1) : "Belum ada lagu") : title.toString();

        miniTitle.setText(name);
        miniQueue.setText(hasItem ? (index + 1) + "/" + count : "0/0");
        if (detailTitle != null) detailTitle.setText(name);

        if (playPauseBtn != null) {
            playPauseBtn.setText(controller != null && controller.getPlayWhenReady() ? "Ⅱ" : "▶");
            playPauseBtn.setEnabled(hasItem);
            prevBtn.setEnabled(hasItem && controller.hasPreviousMediaItem());
            nextBtn.setEnabled(hasItem && controller.hasNextMediaItem());
            speedBtn.setEnabled(hasItem);
        }
        if (speedBtn != null && hasItem) {
            speedBtn.setText(formatSpeed(controller.getPlaybackParameters().speed));
        }
        if (queueDetails != null) {
            if (!hasItem) {
                queueDetails.setText("Belum ada lagu dalam antrean.");
            } else {
                StringBuilder s = new StringBuilder();
                for (int i = 0; i < count; i++) {
                    CharSequence label = controller.getMediaItemAt(i).mediaMetadata.title;
                    s.append(i == index ? "▶ " : "    ");
                    s.append(i + 1).append(". ");
                    s.append(label == null ? "Lagu " + (i + 1) : label);
                    if (i + 1 < count) s.append("\n\n");
                }
                queueDetails.setText(s.toString());
            }
        }
        refreshProgress();
    }

    private void refreshProgress() {
        if (progress == null || timeInfo == null) return;
        if (controller == null || controller.getMediaItemCount() == 0) {
            progress.setEnabled(false);
            if (!dragging) progress.setProgress(0);
            timeInfo.setText("00:00 / --:--");
            return;
        }
        long duration = controller.getDuration();
        long position = Math.max(0, controller.getCurrentPosition());
        boolean canSeek = duration != C.TIME_UNSET && duration > 0;
        progress.setEnabled(canSeek);
        if (!dragging && canSeek) {
            progress.setProgress((int) Math.min(1000, position * 1000L / duration));
        }
        timeInfo.setText(formatTime(position) + " / " + (canSeek ? formatTime(duration) : "--:--"));
    }

    private String formatTime(long ms) {
        long total = Math.max(0, ms / 1000);
        if (total >= 3600) return String.format(Locale.US, "%d:%02d:%02d",
                total / 3600, (total / 60) % 60, total % 60);
        return String.format(Locale.US, "%02d:%02d", total / 60, total % 60);
    }

    private String formatSpeed(float value) {
        return (value == (int) value ? String.valueOf((int) value) : String.valueOf(value)) + "×";
    }

    private void togglePlayback() {
        if (controller == null || controller.getMediaItemCount() == 0) return;
        if (controller.getPlayWhenReady()) controller.pause();
        else controller.play();
        refreshPlayer();
    }

    private void previousTrack() {
        if (controller == null || controller.getMediaItemCount() == 0) return;
        if (controller.getCurrentPosition() > 3000L) controller.seekTo(0);
        else if (controller.hasPreviousMediaItem()) controller.seekToPreviousMediaItem();
        else controller.seekTo(0);
        refreshPlayer();
    }

    private void nextTrack() {
        if (controller == null) return;
        if (controller.hasNextMediaItem()) controller.seekToNextMediaItem();
        else toast("Antrean habis. Pilih lagu lain lalu tekan + ANTREAN.");
        refreshPlayer();
    }

    private void jump(long offset) {
        if (controller == null || controller.getMediaItemCount() == 0) return;
        long target = Math.max(0, controller.getCurrentPosition() + offset);
        long duration = controller.getDuration();
        if (duration > 0 && duration != C.TIME_UNSET) target = Math.min(target, duration);
        controller.seekTo(target);
        refreshProgress();
    }

    private void cycleSpeed() {
        if (controller == null || controller.getMediaItemCount() == 0) return;
        float current = controller.getPlaybackParameters().speed;
        float next = current < 1.25f ? 1.25f
                : current < 1.5f ? 1.5f : current < 2f ? 2f : 1f;
        controller.setPlaybackSpeed(next);
        speedBtn.setText(formatSpeed(next));
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
                return !("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme));
            }
            @Override public void onPageFinished(WebView view, String url) {
                int index = view == pages[MUSIC] ? MUSIC : YOUTUBE;
                if (address != null && !address.hasFocus()) {
                    addressDrafts[index] = url;
                    if (currentTab == index) address.setText(url);
                }
            }
        });
        return w;
    }

    private void switchTo(int tab) {
        if (tab < 0 || tab > HISTORY_TAB) return;
        if (tab != currentTab) {
            if (currentTab == YOUTUBE || currentTab == MUSIC) {
                addressDrafts[currentTab] = address.getText().toString();
                pauseWebAudio(pages[currentTab]);
                pages[currentTab].onPause();
            }
            currentTab = tab;
            if (tab == YOUTUBE || tab == MUSIC) {
                lastBrowserTab = tab;
                pages[tab].onResume();
                address.setText(addressDrafts[tab]);
            }
        }
        if (tab == MUSIC && !musicLoaded) {
            musicLoaded = true;
            pages[MUSIC].loadUrl("https://music.youtube.com/");
        }
        address.clearFocus();
        updateTabs();
        if (tab == HISTORY_TAB) refreshHistory();
    }

    private void updateTabs() {
        youtubeTab.setBackground(metal(currentTab == YOUTUBE ? 0xff526349 : 0xff495568,
                currentTab == YOUTUBE ? 0xff223f2a : 0xff212a37));
        musicTab.setBackground(metal(currentTab == MUSIC ? 0xff526349 : 0xff495568,
                currentTab == MUSIC ? 0xff223f2a : 0xff212a37));
        playerTab.setBackground(metal(currentTab == PLAYER_TAB ? 0xff526349 : 0xff495568,
                currentTab == PLAYER_TAB ? 0xff223f2a : 0xff212a37));
        historyTab.setBackground(metal(currentTab == HISTORY_TAB ? 0xff526349 : 0xff495568,
                currentTab == HISTORY_TAB ? 0xff223f2a : 0xff212a37));

        boolean browser = currentTab == YOUTUBE || currentTab == MUSIC;
        browserHolder.setVisibility(browser ? View.VISIBLE : View.GONE);
        detailPage.setVisibility(currentTab == PLAYER_TAB ? View.VISIBLE : View.GONE);
        historyPage.setVisibility(currentTab == HISTORY_TAB ? View.VISIBLE : View.GONE);
        linkRow.setVisibility(browser ? View.VISIBLE : View.GONE);
        playRow.setVisibility(browser ? View.VISIBLE : View.GONE);
        pages[YOUTUBE].setVisibility(currentTab == YOUTUBE ? View.VISIBLE : View.GONE);
        pages[MUSIC].setVisibility(currentTab == MUSIC ? View.VISIBLE : View.GONE);
        if (browser) {
            address.setHint(currentTab == MUSIC
                    ? "Link YouTube Music atau cari lagu"
                    : "Link YouTube atau cari video");
        }
        hint.setText(currentTab == HISTORY_TAB
                ? "RECENT / RESUME  •  50 LAST TRACKS  •  LOCAL"
                : currentTab == PLAYER_TAB
                ? "PLAYLIST EDITOR  •  BACKGROUND AUDIO: ON"
                : "PLAY NOW = mulai lagi  /  + QUEUE = tambah ke antrean");
    }

    private WebView activeBrowser() {
        return pages[(currentTab == YOUTUBE || currentTab == MUSIC)
                ? currentTab : lastBrowserTab];
    }

    private void navigate() {
        if (currentTab == PLAYER_TAB || currentTab == HISTORY_TAB) return;
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

    private void playSelected(boolean enqueue) {
        if (currentTab == PLAYER_TAB || currentTab == HISTORY_TAB) {
            toast("Buka tab YouTube atau Music untuk memilih lagu.");
            return;
        }
        String typedLink = address.getText().toString().trim();
        WebView web = activeBrowser();
        if (address.hasFocus() && isYouTubeVideo(typedLink)) {
            sendAudioCommand(typedLink, enqueue);
            return;
        }
        web.evaluateJavascript("window.location.href", raw -> {
            String currentUrl = web.getUrl();
            try {
                currentUrl = new JSONArray("[" + raw + "]").getString(0);
            } catch (Exception ignored) { }
            if (isYouTubeVideo(currentUrl)) {
                sendAudioCommand(currentUrl, enqueue);
            } else if (isYouTubeVideo(typedLink)) {
                sendAudioCommand(typedLink, enqueue);
            } else {
                toast("Pilih satu video/lagu dulu atau tempel link YouTube watch.");
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
        } catch (Exception e) {
            return false;
        }
    }

    private String normalizeForExtractor(String link) {
        Uri uri = Uri.parse(link);
        String host = uri.getHost();
        if (host != null && "music.youtube.com".equalsIgnoreCase(host)) {
            String id = uri.getQueryParameter("v");
            if (id != null && id.matches("[A-Za-z0-9_-]{11}")) {
                return "https://www.youtube.com/watch?v=" + id;
            }
            return uri.buildUpon().authority("www.youtube.com").build().toString();
        }
        return link;
    }

    private void sendAudioCommand(String source, boolean enqueue) {
        if (!isYouTubeVideo(source)) {
            toast("Link video/lagu tidak valid");
            return;
        }
        pauseWebAudio(activeBrowser());
        Intent intent = new Intent(this, PlaybackService.class);
        intent.setAction(enqueue ? PlaybackService.ACTION_QUEUE_URL : PlaybackService.ACTION_PLAY_URL);
        intent.putExtra(PlaybackService.EXTRA_URL, normalizeForExtractor(source));
        startService(intent);
        toast(enqueue ? "Memuat lagu ke antrean…" : "Memuat audio di background…");
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
        shared = shared.replaceAll("[),.]+$", "");
        Uri uri = Uri.parse(shared);
        if ("music.youtube.com".equalsIgnoreCase(uri.getHost())) switchTo(MUSIC);
        else if (currentTab == PLAYER_TAB || currentTab == HISTORY_TAB)
            switchTo(lastBrowserTab);
        address.setText(shared);
        addressDrafts[currentTab] = shared;
        if (isYouTubeVideo(shared)) activeBrowser().loadUrl(shared);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        consumeSharedIntent(intent);
    }

    @Override protected void onResume() {
        super.onResume();
        if (currentTab == HISTORY_TAB) refreshHistory();
    }

    @Override protected void onStart() {
        super.onStart();
        tickerRunning = true;
        uiHandler.removeCallbacks(ticker);
        uiHandler.post(ticker);
    }

    @Override protected void onStop() {
        tickerRunning = false;
        uiHandler.removeCallbacks(ticker);
        // Browser videos should not cause a second audio stream when screen is locked.
        pauseWebAudio(pages[YOUTUBE]);
        pauseWebAudio(pages[MUSIC]);
        super.onStop();
    }

    @Override public void onBackPressed() {
        if (currentTab == PLAYER_TAB || currentTab == HISTORY_TAB) {
            switchTo(lastBrowserTab);
        } else if (activeBrowser().canGoBack()) {
            activeBrowser().goBack();
        } else if (currentTab == MUSIC) {
            switchTo(YOUTUBE);
        } else {
            super.onBackPressed();
        }
    }

    @Override protected void onDestroy() {
        destroyed = true;
        tickerRunning = false;
        uiHandler.removeCallbacks(ticker);
        if (controller != null) controller.removeListener(listener);
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
        for (WebView web : pages) {
            if (web != null) web.destroy();
        }
        super.onDestroy();
    }

    private Button button(String label, int color) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextColor(0xffe9edf4);
        b.setTextSize(10);
        b.setAllCaps(false);
        b.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        b.setMinWidth(0);
        b.setMinimumWidth(0);
        b.setPadding(dp(3), 0, dp(3), 0);
        b.setBackground(metal(color, dim(color)));
        b.setGravity(Gravity.CENTER);
        return b;
    }

    private int dim(int color) {
        return Color.rgb((int)(Color.red(color) * .55),
                (int)(Color.green(color) * .55),
                (int)(Color.blue(color) * .55));
    }

    private GradientDrawable metal(int top, int bottom) {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{top, bottom});
        d.setCornerRadius(dp(4));
        d.setStroke(dp(1), 0xff667182);
        return d;
    }

    private GradientDrawable lcd() {
        GradientDrawable d = new GradientDrawable();
        d.setColor(0xff101b12);
        d.setStroke(dp(1), 0xff506a4b);
        d.setCornerRadius(dp(3));
        return d;
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

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }
}
