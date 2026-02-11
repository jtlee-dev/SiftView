import type { Segment } from "../App";

interface InspectorPanelProps {
  /** Tab label */
  label?: string;
  /** File path if opened from disk */
  path?: string;
  /** Detected content type */
  detectedKind?: string;
  /** Segment list for mixed-mode */
  segments?: Segment[];
  /** Raw content to compute line count */
  content: string;
  /** Diff mode (structured diff) */
  isDiff?: boolean;
}

export function InspectorPanel({
  label,
  path,
  detectedKind,
  segments,
  content,
  isDiff,
}: InspectorPanelProps) {
  const lines = content ? content.split(/\r?\n/).length : 0;
  const segmentSummary =
    segments && segments.length > 0
      ? segments.map((s) => s.kind).join(", ")
      : null;

  return (
    <div className="inspector-panel">
      <div className="inspector-section">
        <div className="inspector-row">
          <span className="inspector-label">Label</span>
          <span className="inspector-value">{label ?? "—"}</span>
        </div>
        {path != null && (
          <div className="inspector-row">
            <span className="inspector-label">Path</span>
            <span className="inspector-value path" title={path}>
              {path}
            </span>
          </div>
        )}
        <div className="inspector-row">
          <span className="inspector-label">Type</span>
          <span className="inspector-value">{detectedKind ?? (isDiff ? "diff" : "—")}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">Lines</span>
          <span className="inspector-value">{lines}</span>
        </div>
        {segmentSummary != null && (
          <div className="inspector-row">
            <span className="inspector-label">Segments</span>
            <span className="inspector-value" title={segmentSummary}>
              {segments!.length} ({segmentSummary})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
