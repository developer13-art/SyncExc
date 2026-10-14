import { Pause, Play, SkipForward, Square } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Slider } from '../../../components/ui/Slider.jsx';
import { formatQuantity } from '../../../lib/formatters/number.formatter.js';

const SPEED_OPTIONS = [1, 2, 5, 10, 25, 50, 100];

export function ReplayControls({ state = {}, onPlay, onPause, onStop, onStep, onSpeedChange }) {
  const isPlaying = state.status === 'playing';
  const speed = state.speed ?? 1;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        {isPlaying ? (
          <Button variant="outline" size="sm" onClick={onPause}>
            <Pause className="h-3.5 w-3.5" /> Pause
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onPlay}>
            <Play className="h-3.5 w-3.5" /> Play
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onStep} disabled={isPlaying}>
          <SkipForward className="h-3.5 w-3.5" /> Step
        </Button>
        <Button variant="outline" size="sm" onClick={onStop}>
          <Square className="h-3.5 w-3.5" /> Stop
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-2xs uppercase tracking-wide text-muted-foreground">Speed</span>
          <select
            value={speed}
            onChange={(e) => onSpeedChange?.(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-2xs text-muted-foreground">
          {state.currentTime ? String(state.currentTime).slice(11, 19) : '—'}
        </span>
        <div className="flex-1">
          <Slider
            value={[state.progress ?? 0]}
            min={0}
            max={100}
            step={0.1}
            onValueChange={(v) => onSeek?.(v[0])}
          />
        </div>
        <span className="w-20 shrink-0 text-right text-2xs text-muted-foreground">
          {state.endTime ? String(state.endTime).slice(11, 19) : '—'}
        </span>
      </div>

      <div className="flex items-center justify-between text-2xs text-muted-foreground">
        <span>
          Event {state.currentEventIndex ?? 0} of {state.totalEvents ?? 0}
        </span>
        <span>
          Playback {formatQuantity(state.processedEvents ?? 0, 0)} events processed
        </span>
      </div>
    </div>
  );
}