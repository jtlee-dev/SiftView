import { useState } from "react";

export interface DiffBlockUnchanged {
  type: "unchanged";
  count: number;
  lines: string[];
}

export interface DiffBlockChanged {
  type: "changed";
  old_lines: string[];
  new_lines: string[];
}

export type DiffBlock = DiffBlockUnchanged | DiffBlockChanged;

export interface StructuredDiff {
  left_label: string;
  right_label: string;
  blocks: DiffBlock[];
}

interface DiffViewProps {
  data: StructuredDiff;
}

export function DiffView({ data }: DiffViewProps) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());

  const toggleBlock = (index: number) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="diff-view">
      <div className="diff-view-header">
        <div className="diff-col diff-col-left" title={data.left_label}>
          {data.left_label}
        </div>
        <div className="diff-col diff-col-right" title={data.right_label}>
          {data.right_label}
        </div>
      </div>
      <div className="diff-view-body">
        {data.blocks.map((block, i) => {
          if (block.type === "unchanged") {
            if (block.count === 0) return null;
            const expanded = expandedBlocks.has(i);
            return (
              <div key={i} className="diff-block diff-block-unchanged">
                {expanded ? (
                  <>
                    <button
                      type="button"
                      className="diff-collapse-btn"
                      onClick={() => toggleBlock(i)}
                      aria-label="Collapse unchanged lines"
                    >
                      ▼ {block.count} lines unchanged
                    </button>
                    <div className="diff-unchanged-lines">
                      {block.lines.map((line, lineIdx) => (
                        <div key={lineIdx} className="diff-row">
                          <div className="diff-cell diff-cell-left diff-context">
                            {line}
                          </div>
                          <div className="diff-cell diff-cell-right diff-context">
                            {line}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="diff-expand-btn"
                    onClick={() => toggleBlock(i)}
                    aria-label={`Show ${block.count} unchanged lines`}
                  >
                    ▶ {block.count} lines unchanged
                  </button>
                )}
              </div>
            );
          }
          const { old_lines, new_lines } = block;
          const maxRows = Math.max(old_lines.length, new_lines.length, 1);
          return (
            <div key={i} className="diff-block diff-block-changed">
              <div className="diff-changed-rows">
                {Array.from({ length: maxRows }, (_, rowIdx) => (
                  <div key={rowIdx} className="diff-row">
                    <div
                      className={`diff-cell diff-cell-left ${
                        rowIdx < old_lines.length ? "diff-removed" : "diff-empty"
                      }`}
                    >
                      {rowIdx < old_lines.length ? old_lines[rowIdx] : "\u00a0"}
                    </div>
                    <div
                      className={`diff-cell diff-cell-right ${
                        rowIdx < new_lines.length ? "diff-added" : "diff-empty"
                      }`}
                    >
                      {rowIdx < new_lines.length ? new_lines[rowIdx] : "\u00a0"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
