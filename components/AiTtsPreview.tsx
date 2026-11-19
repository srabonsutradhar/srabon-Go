/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Loader2, Volume2, AlertCircle, ChevronDown, Download } from 'lucide-react';
import { Voice } from '../types';
import AudioVisualizer from './AudioVisualizer';
import { decodeBase64, decodeAudioToBuffer, createWavBlob, generateTtsAudio } from '../utils/audio';

interface AiTtsPreviewProps {
  text: string;
  voices: Voice[];
  onBeforeGenerate?: () => Promise<boolean>;
}

const AiTtsPreview: React.FC<AiTtsPreviewProps> = ({ text, voices, onBeforeGenerate }) => {
  const [selectedVoiceName, setSelectedVoiceName] = useState(voices[0]?.name || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAudioBytes, setLastAudioBytes] = useState<Uint8Array | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopAudio();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
    if (voices.length > 0 && !voices.find(v => v.name === selectedVoiceName)) {
      setSelectedVoiceName(voices[0].name);
    }
  }, [voices, selectedVoiceName]);

  useEffect(() => {
    setLastAudioBytes(null);
  }, [text, selectedVoiceName]);

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    if (isMountedRef.current) {
      setIsPlaying(false);
    }
  };

  const handlePlay = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isLoading) return;

    if (isPlaying) {
      stopAudio();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (onBeforeGenerate) {
        const allowed = await onBeforeGenerate();
        if (!allowed) {
          return;
        }
      }

      const { audioData } = await generateTtsAudio({
        text,
        voiceName: selectedVoiceName,
      });

      if (!isMountedRef.current) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const rawBytes = decodeBase64(audioData);
      setLastAudioBytes(rawBytes);

      const audioBuffer = await decodeAudioToBuffer(rawBytes, audioContextRef.current, 24000);
      if (!isMountedRef.current) return;

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        if (isMountedRef.current) setIsPlaying(false);
      };

      sourceNodeRef.current = source;
      source.start();
      setIsPlaying(true);
    } catch (err: any) {
      console.error("TTS Error:", err);
      if (isMountedRef.current) {
        setError(err?.message || "Failed to generate speech. Please try again.");
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lastAudioBytes) return;
    const blob = createWavBlob(lastAudioBytes, 24000);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-${selectedVoiceName.toLowerCase()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header / Controls */}
      <div className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700">
        {/* Voice Selector */}
        <div className="relative group w-full sm:w-auto">
          <select
            value={selectedVoiceName}
            onChange={(e) => setSelectedVoiceName(e.target.value)}
            className="appearance-none w-full sm:w-48 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-2 pl-3 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-600 cursor-pointer transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
            disabled={isLoading || isPlaying}
          >
            {voices.map(voice => (
              <option key={voice.name} value={voice.name}>
                {voice.name} ({voice.analysis.gender})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {lastAudioBytes && (
            <button
              onClick={handleDownload}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              title="Download WAV"
              aria-label="Download WAV"
            >
              <Download size={16} />
            </button>
          )}

          {/* Play Button */}
          <button
            onClick={handlePlay}
            disabled={isLoading}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 transform active:scale-95 ${
              isPlaying
                ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                : 'bg-zinc-900 dark:bg-indigo-600 text-white hover:bg-zinc-800 dark:hover:bg-indigo-500 shadow-md'
            } ${isLoading ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isPlaying ? (
              <Square size={16} className="fill-current" />
            ) : (
              <Play size={16} className="fill-current" />
            )}
            <span>{isLoading ? 'Generating...' : isPlaying ? 'Stop Preview' : 'Listen'}</span>
          </button>
        </div>
      </div>

      {/* Visualizer Area */}
      <div
        className={`h-24 relative flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 overflow-hidden group ${isLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={handlePlay}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePlay(); }}
        aria-label={isPlaying ? "Stop audio preview" : "Play audio preview"}
      >
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '8px 8px' }}></div>

        {/* Icon or Visualizer */}
        <div className="w-full h-full absolute inset-0 flex items-center justify-center pointer-events-none">
          {isPlaying ? (
            <div className="w-full h-full opacity-80">
              <AudioVisualizer isPlaying={true} color={document.documentElement.classList.contains('dark') ? '#a5b4fc' : '#18181b'} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-300 dark:text-zinc-600">
              <Volume2 size={24} />
              <span className="text-xs font-medium">Click to preview audio</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute inset-0 bg-zinc-50/95 dark:bg-zinc-900/95 px-4 flex items-center justify-center text-red-500 dark:text-red-400 gap-2 text-xs text-center z-20">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiTtsPreview;