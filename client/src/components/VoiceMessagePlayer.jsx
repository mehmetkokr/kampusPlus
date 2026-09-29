import React, { useRef, useState, useEffect } from 'react';
import { Play as PlayIcon, Pause as PauseIcon } from 'lucide-react';

export default function VoiceMessagePlayer({ src, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrent(audio.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
    setPlaying(!playing);
  }

  function fmt(sec) {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const progress = duration ? (current / duration) * 100 : 0;

  return (
    <div className={`voice-bubble ${mine ? 'message-mine' : 'message-theirs'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button type="button" className="voice-play-btn" onClick={toggle}>
        {playing ? <PauseIcon width={14} height={14} /> : <PlayIcon width={14} height={14} />}
      </button>
      <div className="voice-track">
        <div className="voice-track-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="voice-time">{fmt(playing || current ? current : duration)}</span>
    </div>
  );
}
