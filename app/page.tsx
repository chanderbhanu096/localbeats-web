"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { allTracks, importFiles, logPlay, type Track } from "@/lib/db";
import { dominantColor, mmss } from "@/lib/color";
import { coarsePosition, geoEnabled, setGeoEnabled } from "@/lib/geo";

export default function Page() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ at: 0, of: 0 });
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [geo, setGeo] = useState(false);
  const [atRisk, setAtRisk] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const wantPlay = useRef(false);
  const logged = useRef<string | null>(null);

  const current: Track | undefined = tracks[index];
  const count = tracks.length;

  useEffect(() => {
    allTracks().then((t) => {
      setTracks(t);
      setLoaded(true);
    });
    setGeo(geoEnabled());
    // Ask to be exempt from Safari evicting the library as an "unused origin".
    // A refusal is silent, so surface it rather than losing music quietly.
    navigator.storage?.persist?.().then((ok) => setAtRisk(!ok));
    navigator.serviceWorker?.register("sw.js").catch(() => {});
  }, []);

  const next = useCallback(
    () => setIndex((i) => (count ? (i + 1) % count : 0)),
    [count],
  );
  const prev = useCallback(
    () => setIndex((i) => (count ? (i - 1 + count) % count : 0)),
    [count],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      wantPlay.current = true;
      audio.play().catch(() => {});
    } else {
      wantPlay.current = false;
      audio.pause();
    }
  }, [current]);

  // Swap the audio source. The object URL is revoked on the way out; leaking
  // one per track change is how a long listening session runs the tab out of
  // memory.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    const url = URL.createObjectURL(current.file);
    audio.src = url;
    logged.current = null;
    if (wantPlay.current) audio.play().catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, [current?.id]);

  useEffect(() => {
    if (!current?.artwork) {
      setArtUrl(null);
      setAccent(null);
      return;
    }
    const url = URL.createObjectURL(current.artwork);
    setArtUrl(url);
    dominantColor(current.artwork).then(setAccent);
    return () => URL.revokeObjectURL(url);
  }, [current?.id]);

  // Lock screen / Control Centre.
  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album,
      artwork: artUrl ? [{ src: artUrl, sizes: "512x512" }] : [],
    });
  }, [current, artUrl]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", toggle],
      ["pause", toggle],
      ["nexttrack", next],
      ["previoustrack", prev],
    ];
    for (const [action, fn] of handlers) ms.setActionHandler(action, fn);
    return () => {
      for (const [action] of handlers) ms.setActionHandler(action, null);
    };
  }, [toggle, next, prev]);

  // The next *button* wraps; reaching the end of the library on its own does
  // not, or a queue that runs out at 2am just starts over.
  const onEnded = useCallback(() => {
    if (index + 1 < count) next();
    else {
      wantPlay.current = false;
      setPlaying(false);
    }
  }, [index, count, next]);

  const onPlay = () => {
    setPlaying(true);
    if (!current || logged.current === current.id) return;
    // One event per track start, not per resume — otherwise a fidgety commute
    // writes fifty plays of the same song.
    logged.current = current.id;
    const id = current.id;
    coarsePosition().then((pos) => logPlay(id, pos));
  };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setImporting(`0 / ${files.length}`);
    const { added, skipped } = await importFiles(files, (d, t) =>
      setImporting(`${d} / ${t}`),
    );
    setTracks(await allTracks());
    setImporting(null);
    // Reset so re-picking the same files fires change again.
    e.target.value = "";
    if (!added && skipped) alert(`Already imported (${skipped} skipped)`);
  };

  const play = (i: number) => {
    wantPlay.current = true;
    if (i === index) toggle();
    else setIndex(i);
    setFull(true);
  };

  // Swipe up/down to change track. A touch delta is fewer moving parts than a
  // scroll-snap list kept in sync with the playing index.
  const touchY = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => {
    touchY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - touchY.current;
    if (Math.abs(dy) > 60) (dy < 0 ? next : prev)();
  };

  return (
    <main
      className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col"
      style={{
        background: accent
          ? `linear-gradient(180deg, ${accent} -60%, #08080b 55%)`
          : undefined,
      }}
    >
      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        onPlay={onPlay}
        onPause={() => setPlaying(false)}
        onEnded={onEnded}
        onTimeUpdate={(e) =>
          setTime({
            at: e.currentTarget.currentTime,
            of: e.currentTarget.duration,
          })
        }
      />

      {!loaded ? null : count === 0 ? (
        <Empty importing={importing} onPick={pick} />
      ) : full && current ? (
        <NowPlaying
          track={current}
          artUrl={artUrl}
          accent={accent}
          playing={playing}
          time={time}
          onSeek={(v) => {
            if (audioRef.current) audioRef.current.currentTime = v;
          }}
          onToggle={toggle}
          onNext={next}
          onPrev={prev}
          onClose={() => setFull(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        />
      ) : (
        <Library
          tracks={tracks}
          index={index}
          playing={playing}
          importing={importing}
          geo={geo}
          atRisk={atRisk}
          onGeo={(on) => {
            setGeoEnabled(on);
            setGeo(on);
          }}
          onPick={pick}
          onPlay={play}
          onOpen={() => setFull(true)}
        />
      )}
    </main>
  );
}

function Empty({
  importing,
  onPick,
}: {
  importing: string | null;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-10 text-center">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">LocalBeats</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Your library lives on this phone. Nothing is uploaded.
        </p>
      </div>
      <ImportButton importing={importing} onPick={onPick} label="Import music" />
    </div>
  );
}

function ImportButton({
  importing,
  onPick,
  label,
}: {
  importing: string | null;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
}) {
  return (
    <label className="cursor-pointer rounded-full bg-zinc-100 px-6 py-3 text-sm font-medium text-zinc-900 active:opacity-70">
      {importing ? `Importing ${importing}…` : label}
      <input
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.aac,.flac,.wav,.ogg,.opus"
        className="hidden"
        disabled={importing !== null}
        onChange={onPick}
      />
    </label>
  );
}

function Library({
  tracks,
  index,
  playing,
  importing,
  geo,
  atRisk,
  onGeo,
  onPick,
  onPlay,
  onOpen,
}: {
  tracks: Track[];
  index: number;
  playing: boolean;
  importing: string | null;
  geo: boolean;
  atRisk: boolean;
  onGeo: (on: boolean) => void;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPlay: (i: number) => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-baseline justify-between px-5 pt-6 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <span className="font-mono text-xs text-zinc-500">
          {tracks.length} tracks
        </span>
      </header>

      <ul className="flex-1">
        {tracks.map((t, i) => (
          <li key={t.id}>
            <button
              onClick={() => onPlay(i)}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:bg-zinc-800/40"
            >
              <span
                className={`w-4 shrink-0 font-mono text-xs ${
                  i === index ? "text-emerald-400" : "text-zinc-600"
                }`}
              >
                {i === index && playing ? "▶" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{t.title}</span>
                <span className="block truncate text-xs text-zinc-500">
                  {t.artist}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs text-zinc-600">
                {mmss(t.duration)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {atRisk && (
        <p className="mx-5 mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-400">
          Storage is not persisted — iOS may evict this library if the app goes
          unused. Open it from the Home Screen and play something to build up
          enough engagement for Safari to grant it.
        </p>
      )}
      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-zinc-800 bg-zinc-950/90 px-5 py-3 backdrop-blur">
        <ImportButton importing={importing} onPick={onPick} label="Import" />
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={geo}
            onChange={(e) => onGeo(e.target.checked)}
            className="accent-emerald-400"
          />
          Tag plays with location
        </label>
        <button
          onClick={onOpen}
          className="text-xs text-zinc-400 active:opacity-60"
        >
          Now playing
        </button>
      </div>
    </div>
  );
}

function NowPlaying({
  track,
  artUrl,
  accent,
  playing,
  time,
  onSeek,
  onToggle,
  onNext,
  onPrev,
  onClose,
  onTouchStart,
  onTouchEnd,
}: {
  track: Track;
  artUrl: string | null;
  accent: string | null;
  playing: boolean;
  time: { at: number; of: number };
  onSeek: (v: number) => void;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}) {
  return (
    <div
      className="flex flex-1 flex-col px-8 pb-10"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        onClick={onClose}
        className="self-start py-4 text-xs tracking-widest text-zinc-400 active:opacity-60"
      >
        ▼ LIBRARY
      </button>

      <div className="flex flex-1 items-center justify-center">
        {artUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={artUrl}
            alt=""
            className="aspect-square w-full rounded-2xl object-cover shadow-2xl shadow-black/60"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-zinc-800/60 text-5xl text-zinc-700">
            ♪
          </div>
        )}
      </div>

      <div className="pt-8">
        <h2 className="truncate text-xl font-semibold">{track.title}</h2>
        <p className="truncate text-sm text-zinc-400">{track.artist}</p>
      </div>

      <input
        type="range"
        min={0}
        max={time.of || track.duration || 0}
        value={time.at}
        step="any"
        onChange={(e) => onSeek(Number(e.target.value))}
        className="mt-5 w-full"
        style={{ accentColor: accent ?? "#f4f4f5" }}
      />
      <div className="flex justify-between font-mono text-[11px] text-zinc-500">
        <span>{mmss(time.at)}</span>
        <span>{mmss(time.of || track.duration)}</span>
      </div>

      <div className="flex items-center justify-center gap-12 pt-6 text-2xl">
        <button onClick={onPrev} className="active:opacity-50" aria-label="Previous track">
          ◁
        </button>
        <button
          onClick={onToggle}
          className="active:opacity-50"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button onClick={onNext} className="active:opacity-50" aria-label="Next track">
          ▷
        </button>
      </div>

      <p className="pt-6 text-center text-[11px] text-zinc-600">
        swipe up / down to change track
      </p>
    </div>
  );
}
