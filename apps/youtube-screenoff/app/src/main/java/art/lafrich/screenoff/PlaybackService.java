package art.lafrich.screenoff;

import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * One shared player for YouTube and YouTube Music.
 * Audio-only URLs are resolved on a serial background worker. Media3 owns
 * the foreground media notification, headset controls and lock-screen playback.
 */
public final class PlaybackService extends MediaSessionService {
    public static final String ACTION_PLAY_URL = "art.lafrich.screenoff.PLAY_URL";
    public static final String ACTION_QUEUE_URL = "art.lafrich.screenoff.QUEUE_URL";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_POSITION_MS = "position_ms";

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    // Invalidate queued resolver responses after a new Play Now request.
    private final AtomicInteger generation = new AtomicInteger();
    private ExoPlayer player;
    private MediaSession mediaSession;
    private final Runnable progressSaver = new Runnable() {
        @Override public void run() {
            persistCurrentPosition();
            main.postDelayed(this, 5000L);
        }
    };

    private void persistCurrentPosition() {
        if (player == null || player.getCurrentMediaItem() == null) return;
        PlaybackHistory.savePosition(this, player.getCurrentMediaItem().mediaId,
                Math.max(0L, player.getCurrentPosition()));
    }

    private void markCurrentAsPlayed() {
        if (player == null || !player.isPlaying()) return;
        MediaItem item = player.getCurrentMediaItem();
        if (item == null) return;
        CharSequence title = item.mediaMetadata.title;
        PlaybackHistory.record(this, item.mediaId,
                title == null ? "YouTube" : title.toString(),
                Math.max(0L, player.getCurrentPosition()));
    }

    @Override public void onCreate() {
        super.onCreate();
        player = new ExoPlayer.Builder(this).build();
        player.setAudioAttributes(
                new AudioAttributes.Builder()
                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                        .setUsage(C.USAGE_MEDIA)
                        .build(), true);
        player.setRepeatMode(Player.REPEAT_MODE_OFF);
        player.addListener(new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean playing) {
                if (playing) markCurrentAsPlayed();
                else persistCurrentPosition();
            }
            @Override public void onMediaItemTransition(@Nullable MediaItem item, int reason) {
                if (player != null && player.isPlaying()) markCurrentAsPlayed();
            }
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED && player != null
                        && player.getCurrentMediaItem() != null) {
                    PlaybackHistory.savePosition(PlaybackService.this,
                            player.getCurrentMediaItem().mediaId, 0);
                }
            }
        });
        mediaSession = new MediaSession.Builder(this, player).build();
        main.postDelayed(progressSaver, 5000L);
    }

    @Nullable @Override public MediaSession onGetSession(
            MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            boolean playNow = ACTION_PLAY_URL.equals(intent.getAction());
            boolean queueNext = ACTION_QUEUE_URL.equals(intent.getAction());
            if (playNow || queueNext) {
                String link = intent.getStringExtra(EXTRA_URL);
                if (link != null && !link.trim().isEmpty()) {
                    int requestId = playNow ? generation.incrementAndGet() : generation.get();
                    long resumeMs = playNow
                            ? Math.max(0L, intent.getLongExtra(EXTRA_POSITION_MS, 0L)) : 0L;
                    // Resolving serially preserves the queue order selected by the user.
                    worker.execute(() -> resolveAndApply(link, requestId, playNow, resumeMs));
                }
            }
        }
        super.onStartCommand(intent, flags, startId);
        return START_NOT_STICKY;
    }

    private void resolveAndApply(String link, int requestId, boolean playNow, long resumeMs) {
        try {
            YouTubeResolver.Result stream = YouTubeResolver.resolve(link);
            main.post(() -> {
                if (generation.get() != requestId || player == null) return;

                MediaMetadata metadata = new MediaMetadata.Builder()
                        .setTitle(stream.title)
                        .setArtist("YouTube / Music")
                        .build();
                MediaItem item = new MediaItem.Builder()
                        .setMediaId(link)
                        .setUri(stream.audioUrl)
                        .setMediaMetadata(metadata)
                        .build();

                if (playNow) {
                    // "Play now" replaces the old queue. "Queue" only appends.
                    player.setMediaItem(item);
                    if (resumeMs > 0L) player.seekTo(resumeMs);
                    player.prepare();
                    player.play();
                } else if (player.getMediaItemCount() == 0) {
                    player.setMediaItem(item);
                    player.prepare();
                    player.play();
                } else {
                    player.addMediaItem(item);
                    // ExoPlayer automatically advances into the next queued item.
                    // The MediaSession publishes Next/Previous when available.
                }
            });
        } catch (Exception error) {
            Log.e("YouTubeScreenOff", "Cannot resolve stream: " + link, error);
            main.post(() -> {
                if (generation.get() != requestId) return;
                String details = error.getMessage();
                if (details == null || details.trim().isEmpty()) details = "Tidak ada detail tambahan";
                if (details.length() > 120) details = details.substring(0, 120) + "…";
                Toast.makeText(this, "Gagal memuat lagu: "
                                + error.getClass().getSimpleName() + " — " + details,
                        Toast.LENGTH_LONG).show();
            });
        }
    }

    @Override public void onDestroy() {
        generation.incrementAndGet();
        main.removeCallbacks(progressSaver);
        persistCurrentPosition();
        worker.shutdownNow();
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
