package art.lafrich.screenoff;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Private on-device listening history, most recently played first. */
public final class PlaybackHistory {
    private static final String PREFERENCES = "free_youtube_history_v1";
    private static final String KEY = "recent";
    private static final int MAX_ENTRIES = 50;

    public static final class Entry {
        public final String url;
        public final String title;
        public final long playedAt;
        public final long positionMs;

        Entry(String url, String title, long playedAt, long positionMs) {
            this.url = url;
            this.title = title;
            this.playedAt = playedAt;
            this.positionMs = positionMs;
        }
    }

    private PlaybackHistory() { }

    private static SharedPreferences preferences(Context context) {
        return context.getApplicationContext()
                .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    public static synchronized List<Entry> list(Context context) {
        List<Entry> result = new ArrayList<>();
        String raw = preferences(context).getString(KEY, "[]");
        try {
            JSONArray json = new JSONArray(raw);
            for (int i = 0; i < json.length(); i++) {
                JSONObject entry = json.optJSONObject(i);
                if (entry == null) continue;
                String url = entry.optString("url", "");
                if (!url.startsWith("https://www.youtube.com/")
                        && !url.startsWith("https://m.youtube.com/")
                        && !url.startsWith("https://youtu.be/")) continue;
                result.add(new Entry(url,
                        entry.optString("title", "YouTube"),
                        entry.optLong("playedAt", 0L),
                        Math.max(0L, entry.optLong("positionMs", 0L))));
            }
        } catch (JSONException ignored) {
            // Unexpected local data should not crash playback.
        }
        return result;
    }

    public static synchronized void record(Context context, String url, String title, long atMs) {
        if (url == null || !url.startsWith("https://")) return;
        List<Entry> entries = list(context);
        entries.removeIf(e -> e.url.equals(url));
        entries.add(0, new Entry(url,
                title == null || title.trim().isEmpty() ? "YouTube" : title,
                System.currentTimeMillis(), Math.max(0L, atMs)));
        while (entries.size() > MAX_ENTRIES) entries.remove(entries.size() - 1);
        write(context, entries);
    }

    public static synchronized void savePosition(Context context, String url, long atMs) {
        if (url == null) return;
        List<Entry> entries = list(context);
        for (int i = 0; i < entries.size(); i++) {
            Entry e = entries.get(i);
            if (!url.equals(e.url)) continue;
            if (e.positionMs != atMs) {
                entries.set(i, new Entry(e.url, e.title, e.playedAt, Math.max(0L, atMs)));
                write(context, entries);
            }
            return;
        }
    }

    public static synchronized void clear(Context context) {
        preferences(context).edit().remove(KEY).apply();
    }

    private static void write(Context context, List<Entry> entries) {
        JSONArray all = new JSONArray();
        for (Entry e : entries) {
            JSONObject obj = new JSONObject();
            try {
                obj.put("url", e.url);
                obj.put("title", e.title);
                obj.put("playedAt", e.playedAt);
                obj.put("positionMs", e.positionMs);
                all.put(obj);
            } catch (JSONException ignored) { }
        }
        preferences(context).edit().putString(KEY, all.toString()).apply();
    }
}
