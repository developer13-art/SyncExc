import { SourceCard } from './SourceCard.jsx';

export function SourceList({ sources = [], onPause, onRevalidate, onRemove, className }) {
  return (
    <div className={className}>
      {sources.map((source) => (
        <SourceCard
          key={source.id}
          source={source}
          onPause={onPause}
          onRevalidate={onRevalidate}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}