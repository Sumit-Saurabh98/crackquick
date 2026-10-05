"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseYouTube, type Playlist } from "@/lib/youtube";

// YT.PlayerState values
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;

const STORAGE_KEY = "crackquick.music.playlistId";

let apiPromise: Promise<typeof YT> | null = null;

/** Loads the YouTube IFrame API script once. */
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Floating music player for the playlists saved in Settings. Minimize hides the panel (video
 * included) while the music keeps playing; the floating button shows the song and brings it back.
 * Note: YouTube's embed terms ask for a visible player, so hiding it is a deliberate personal-use choice.
 * Lives in the root layout, so playback continues across page navigation.
 */
export function MusicDock({ playlists }: { playlists: Playlist[] }) {
  /** Panel visible. When hidden with music loaded, the player keeps playing off-screen. */
  const [open, setOpen] = useState(false);
  // Last playlist (name). The dock renders closed first, so reading storage here can't cause a hydration mismatch.
  const [selected, setSelected] = useState(readSaved); // playlist id
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [track, setTrack] = useState({ title: "", index: 0, total: 0 });
  const [notice, setNotice] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YT.Player | null>(null);

  const current = playlists.find((p) => p.id === selected) ?? playlists[0];

  const refreshTrack = useCallback(() => {
    const p = player.current;
    if (!p) return;
    setTrack({
      title: p.getVideoData()?.title ?? "",
      index: Math.max(0, p.getPlaylistIndex()),
      total: p.getPlaylist()?.length ?? 0,
    });
  }, []);

  const start = useCallback(
    async (pl: Playlist) => {
      const ids = parseYouTube(pl.url);
      if (!ids || !host.current) return;
      setNotice("");
      const api = await loadYouTubeApi();
      player.current?.destroy();
      // The API replaces the element it's given, so hand it a fresh child each time.
      host.current.innerHTML = "";
      const el = document.createElement("div");
      host.current.appendChild(el);
      player.current = new api.Player(el, {
        width: "100%",
        height: "100%",
        videoId: ids.videoId || undefined,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          rel: 0,
          ...(ids.listId ? { list: ids.listId, listType: "playlist" } : {}),
        },
        events: {
          onReady: (e) => {
            e.target.playVideo();
            refreshTrack();
          },
          onStateChange: (e) => {
            setPlaying(e.data === PLAYING);
            if (e.data === PLAYING || e.data === PAUSED || e.data === ENDED) refreshTrack();
          },
          // 100 / 101 / 150: removed or not embeddable → skip to the next song.
          onError: (e) => {
            setNotice("Skipped a song YouTube won't play here.");
            e.target.nextVideo();
          },
        },
      });
      setLoaded(true);
    },
    [refreshTrack],
  );

  useEffect(() => () => player.current?.destroy(), []);

  function choose(id: string) {
    setSelected(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // storage unavailable: just don't remember it
    }
    const pl = playlists.find((p) => p.id === id);
    if (pl && loaded) void start(pl);
  }

  function toggle() {
    const p = player.current;
    if (!p) {
      if (current) void start(current);
      return;
    }
    if (playing) p.pauseVideo();
    else p.playVideo();
  }

  function close() {
    player.current?.destroy();
    player.current = null;
    if (host.current) host.current.innerHTML = "";
    setLoaded(false);
    setPlaying(false);
    setTrack({ title: "", index: 0, total: 0 });
    setOpen(false);
  }

  const playPauseIcon = playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />;

  const controls = (
    <div className="flex items-center justify-center gap-2">
      <IconButton label="Previous song" disabled={!loaded} onClick={() => player.current?.previousVideo()}>
        <path d="M6 5h2v14H6zM20 5v14L9 12z" />
      </IconButton>
      <button
        type="button"
        onClick={toggle}
        disabled={!current}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-brass text-bg hover:bg-brass2 disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
          {playPauseIcon}
        </svg>
      </button>
      <IconButton label="Next song" disabled={!loaded} onClick={() => player.current?.nextVideo()}>
        <path d="M16 5h2v14h-2zM4 5l11 7-11 7z" />
      </IconButton>
    </div>
  );

  return (
    <>
      {!open ? (
        <div className="fixed right-4 bottom-4 z-30 flex max-w-[min(280px,calc(100vw-2rem))] items-center rounded-full border border-brass/40 bg-bg2 text-sm text-brass2 shadow-lg">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`flex min-w-0 items-center gap-2 rounded-full py-2 pl-4 hover:bg-brass/10 ${loaded ? "pr-2" : "pr-4"}`}
            aria-label="Open music player"
            title={loaded ? track.title : undefined}
          >
            <span aria-hidden className={playing ? "animate-pulse" : ""}>
              ♪
            </span>
            <span className="truncate">{loaded ? track.title || "Loading…" : "Music"}</span>
          </button>
          {loaded ? (
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "Pause" : "Play"}
              className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass text-bg hover:bg-brass2"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                {playPauseIcon}
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Mounted while open or while music is loaded; when minimized it moves off-screen so audio keeps playing. */}
      {open || loaded ? (
        <section
          aria-label="Music player"
          aria-hidden={!open}
          inert={!open}
          className={`card fixed bottom-4 z-30 grid w-[min(320px,calc(100vw-2rem))] gap-3 p-3 shadow-2xl ${
            open ? "right-4" : "pointer-events-none -left-[9999px] opacity-0"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">♪ Music</p>
            <div className="flex gap-1">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-sm" aria-label="Minimize player">
                –
              </button>
              <button type="button" onClick={close} className="btn btn-sm" aria-label="Stop and close player">
                ✕
              </button>
            </div>
          </div>

          {playlists.length === 0 ? (
            <p className="text-sm text-muted">
              No playlists yet.{" "}
              <Link href="/settings" className="text-brass2 underline">
                Add them in Settings
              </Link>
              .
            </p>
          ) : (
            <>
              <select
                value={current?.id ?? ""}
                onChange={(e) => choose(e.target.value)}
                className="field"
                aria-label="Playlist"
              >
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <div ref={host} className={`h-[200px] w-full overflow-hidden rounded-lg bg-black ${loaded ? "" : "hidden"}`} />

              {loaded ? (
                <div className="min-w-0 text-center">
                  <p className="truncate text-sm" title={track.title}>
                    {track.title || "Loading…"}
                  </p>
                  {track.total ? (
                    <p className="text-xs text-muted">
                      Song {track.index + 1} of {track.total}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-center text-xs text-muted">Press play to start {current?.name}.</p>
              )}

              {controls}
              {notice ? <p className="text-center text-xs text-warn">{notice}</p> : null}
            </>
          )}
        </section>
      ) : null}
    </>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink hover:border-brass/50 disabled:opacity-40"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
