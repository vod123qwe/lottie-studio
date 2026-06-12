import { useEffect, useRef, useState } from 'react'
import { useStore, type WinWindow } from '../lib/store'
import type { Track } from '../lib/types'
import { loadYouTubeApi } from '../lib/youtube'

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function Winamp({ win: _win }: { win: WinWindow }) {
  const { queue, index, playToken, isPlaying, next, prev, setIndex, setPlaying } = useStore()
  const current: Track | undefined = queue[index]
  const isYouTube = current?.source.kind === 'youtube'

  const audioRef = useRef<HTMLAudioElement>(null)
  const ytRef = useRef<any>(null)
  const ytReady = useRef(false)
  const mountId = useRef(`yt-mount-${Math.random().toString(36).slice(2)}`)

  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)

  // ---- create the YouTube player once ----
  useEffect(() => {
    let cancelled = false
    loadYouTubeApi().then((YT) => {
      if (cancelled || ytRef.current) return
      ytRef.current = new YT.Player(mountId.current, {
        height: '90',
        width: '100%',
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            ytReady.current = true
            ytRef.current?.setVolume?.(volume)
          },
          onStateChange: (e: any) => {
            // 0 = ended, 1 = playing, 2 = paused
            if (e.data === 0) next()
            else if (e.data === 1) setPlaying(true)
            else if (e.data === 2) setPlaying(false)
          },
        },
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- load the current track whenever it changes ----
  useEffect(() => {
    if (!current) return
    const audio = audioRef.current
    if (current.source.kind === 'audio') {
      // stop YouTube, play the audio element
      try {
        ytRef.current?.pauseVideo?.()
      } catch {
        /* not ready */
      }
      if (audio) {
        audio.src = current.source.url
        audio.volume = volume / 100
        audio.play().catch(() => setPlaying(false))
      }
    } else {
      // stop the audio element, play via YouTube
      if (audio) audio.pause()
      const videoId = current.source.videoId
      const tryLoad = () => {
        if (ytReady.current && ytRef.current) {
          ytRef.current.loadVideoById(videoId)
          ytRef.current.setVolume(volume)
        } else {
          setTimeout(tryLoad, 200)
        }
      }
      tryLoad()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playToken])

  // ---- poll the active engine for time / duration ----
  useEffect(() => {
    const id = setInterval(() => {
      if (isYouTube) {
        const p = ytRef.current
        if (p && ytReady.current && p.getDuration) {
          setDuration(p.getDuration() || 0)
          setPosition(p.getCurrentTime() || 0)
        }
      } else {
        const a = audioRef.current
        if (a) {
          setDuration(a.duration || 0)
          setPosition(a.currentTime || 0)
        }
      }
    }, 400)
    return () => clearInterval(id)
  }, [isYouTube])

  const togglePlay = () => {
    if (!current) return
    if (isYouTube) {
      const p = ytRef.current
      if (!p) return
      isPlaying ? p.pauseVideo() : p.playVideo()
    } else {
      const a = audioRef.current
      if (!a) return
      if (isPlaying) {
        a.pause()
        setPlaying(false)
      } else {
        a.play().catch(() => {})
        setPlaying(true)
      }
    }
  }

  const stop = () => {
    if (isYouTube) ytRef.current?.stopVideo?.()
    else if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPlaying(false)
  }

  const seek = (sec: number) => {
    if (isYouTube) ytRef.current?.seekTo?.(sec, true)
    else if (audioRef.current) audioRef.current.currentTime = sec
    setPosition(sec)
  }

  const changeVolume = (v: number) => {
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v / 100
    ytRef.current?.setVolume?.(v)
  }

  const titleText = current ? `${current.artist} — ${current.title}` : 'Winamp — brak utworu'

  return (
    <div className={`window-body winamp ${isPlaying ? 'playing' : ''}`}>
      <div className="lcd">
        <div className="time">{fmt(position)}</div>
        <div className="ticker">
          <span>{titleText}</span>
        </div>
        <div className="viz">
          {Array.from({ length: 16 }).map((_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>

      {/* The YouTube player stays visible per YouTube ToS — hidden only when an
          audio-file track is playing. */}
      <div className={`yt-screen ${isYouTube ? '' : 'hidden'}`}>
        <div id={mountId.current} />
      </div>

      <input
        className="seek"
        type="range"
        min={0}
        max={Math.max(1, duration)}
        step={0.5}
        value={Math.min(position, duration || 0)}
        onChange={(e) => seek(Number(e.target.value))}
      />

      <div className="controls">
        <button className="ctrl" title="Poprzedni" onClick={prev}>
          ⏮
        </button>
        <button className="ctrl" title={isPlaying ? 'Pauza' : 'Graj'} onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="ctrl" title="Stop" onClick={stop}>
          ⏹
        </button>
        <button className="ctrl" title="Następny" onClick={next}>
          ⏭
        </button>
      </div>

      <div className="vol-row">
        <span>VOL</span>
        <input
          style={{ flex: 1 }}
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
        />
        <span>{fmt(duration)}</span>
      </div>

      <div className="playlist">
        {queue.length === 0 && <div className="pl-item">— playlista pusta —</div>}
        {queue.map((t, i) => (
          <div
            key={t.id}
            className={`pl-item ${i === index ? 'current' : ''}`}
            onDoubleClick={() => setIndex(i)}
            title={`${t.artist} — ${t.title}`}
          >
            {String(i + 1).padStart(2, '0')}. {t.artist} — {t.title}
            {t.source.kind === 'youtube' ? ' ▸yt' : ''}
          </div>
        ))}
      </div>

      <audio ref={audioRef} onEnded={next} style={{ display: 'none' }} />
    </div>
  )
}
