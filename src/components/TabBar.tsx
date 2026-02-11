import { useState, useRef, useEffect, useCallback } from "react";
import type { Tab } from "../App";

/** Drag threshold in pixels before treating as drag (not click). */
const DRAG_THRESHOLD = 5;

interface TabBarProps {
  tabs: Tab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
  onOpen?: () => void;
  onDiffClick?: () => void;
  onRestoreClosed?: () => void;
  onFormatClick?: () => void;
  onDisplayFormattedClick?: () => void;
  displayFormattedActive?: boolean;
  onSave?: () => void;
  onSaveAs?: () => void;
  onCloseAll?: () => void;
  onPinToggle?: (id: string) => void;
  onCopy?: () => void;
}

export function TabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
  onReorderTabs,
  onOpen,
  onDiffClick,
  onRestoreClosed,
  onFormatClick,
  onDisplayFormattedClick,
  displayFormattedActive,
  onSave,
  onSaveAs,
  onCloseAll,
  onPinToggle,
  onCopy,
}: TabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [draggingFromIndex, setDraggingFromIndex] = useState<number | null>(null);
  const didDragRef = useRef(false);

  const getTabIndexAt = useCallback((clientX: number, clientY: number): number => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return -1;
    const tab = el.closest("[data-tab-index]");
    return tab != null ? parseInt((tab as HTMLElement).dataset.tabIndex ?? "-1", 10) : -1;
  }, []);

  const handleTabMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      if (onReorderTabs == null) return;
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      let started = false;
      let lastHoverIndex = index;

      const handleMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!started && (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD)) {
          started = true;
          didDragRef.current = true;
          setDraggingFromIndex(index);
        }
        if (started) {
          const idx = getTabIndexAt(ev.clientX, ev.clientY);
          if (idx >= 0) lastHoverIndex = idx;
        }
      };
      const handleUp = (ev: MouseEvent) => {
        if (started) {
          const idx = getTabIndexAt(ev.clientX, ev.clientY);
          const toIndex = idx >= 0 ? idx : lastHoverIndex;
          if (toIndex >= 0 && toIndex !== index) {
            onReorderTabs(index, toIndex);
          }
          setDraggingFromIndex(null);
        }
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [onReorderTabs, getTabIndexAt],
  );

  const handleTabClick = useCallback(
    (id: string) => {
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      onSelect(id);
    },
    [onSelect],
  );

  useEffect(() => {
    if (!moreOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  const hasMoreItems =
    onDisplayFormattedClick != null || onCloseAll != null || onRestoreClosed != null;

  return (
    <div className="tab-bar">
      {/* Row 1: Tab strip — tabs get space, + at end */}
      <div className="tab-strip">
        <div className="tab-strip-scroll" role="tablist">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              role="tab"
              tabIndex={0}
              data-index={index}
              data-tab-index={index}
              className={`tab ${tab.id === activeId ? "active" : ""} ${draggingFromIndex === index ? "tab-dragging" : ""} ${onReorderTabs != null ? "tab-reorderable" : ""}`}
              onClick={() => handleTabClick(tab.id)}
              onMouseDown={(e) => handleTabMouseDown(e, index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(tab.id);
                }
              }}
            >
              {onPinToggle != null && (
                <button
                  type="button"
                  className={`tab-pin${tab.pinned ? " pinned" : ""}`}
                  aria-label={tab.pinned ? "Unpin tab" : "Pin tab"}
                  title={tab.pinned ? "Unpin" : "Pin (prompt when closing)"}
                  draggable={false}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinToggle(tab.id);
                  }}
                >
                  📌
                </button>
              )}
              <span className="label" title={tab.path ?? tab.label}>
                {tab.label}
              </span>
              <button
                type="button"
                className="close"
                aria-label={`Close ${tab.label}`}
                draggable={false}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="new-tab"
            onClick={onNew}
            aria-label="New tab (Ctrl+N)"
            title="New tab"
          >
            +
          </button>
        </div>
      </div>

      {/* Row 2: Toolbar — grouped actions */}
      <div className="toolbar">
        <div className="toolbar-group" data-group="file">
          {onOpen != null && (
            <button type="button" className="toolbar-btn" onClick={onOpen} aria-label="Open file" title="Open file">
              Open
            </button>
          )}
          {onSave != null && (
            <button type="button" className="toolbar-btn" onClick={onSave} aria-label="Save" title="Save">
              Save
            </button>
          )}
          {onSaveAs != null && (
            <button type="button" className="toolbar-btn" onClick={onSaveAs} aria-label="Save As" title="Save As">
              Save As
            </button>
          )}
        </div>

        <div className="toolbar-group" data-group="actions">
          {onDiffClick != null && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={onDiffClick}
              aria-label="Diff"
              title="Compare tabs or clipboard"
            >
              Diff
            </button>
          )}
          {onFormatClick != null && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={onFormatClick}
              aria-label="Format"
              title="Format (JSON, CSV, XML, YAML, etc.)"
            >
              Format
            </button>
          )}
          {onCopy != null && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={onCopy}
              aria-label="Copy"
              title="Copy to clipboard"
            >
              Copy
            </button>
          )}
        </div>

        {hasMoreItems && (
          <>
            <div className="toolbar-group toolbar-group-extra">
              {onDisplayFormattedClick != null && (
                <button
                  type="button"
                  className={`toolbar-btn${displayFormattedActive ? " active" : ""}`}
                  onClick={onDisplayFormattedClick}
                  aria-label="Display formatted"
                  title="Display formatted"
                >
                  {displayFormattedActive ? "✓ " : ""}Display formatted
                </button>
              )}
              {onCloseAll != null && (
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={onCloseAll}
                  aria-label="Close all tabs"
                  title="Close all tabs"
                >
                  Close all tabs
                </button>
              )}
              {onRestoreClosed != null && (
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={onRestoreClosed}
                  aria-label="Restore closed tab"
                  title="Restore closed tab"
                >
                  Restore closed tab
                </button>
              )}
            </div>
            <div className="toolbar-group toolbar-group-more" ref={moreRef}>
              <button
                type="button"
                className="toolbar-btn toolbar-btn-more"
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="More actions"
                aria-expanded={moreOpen}
                aria-haspopup="true"
                title="More actions"
              >
                More ▾
              </button>
              {moreOpen && (
                <div className="more-menu" role="menu">
                  {onDisplayFormattedClick != null && (
                    <button
                      type="button"
                      role="menuitem"
                      className={`more-menu-item${displayFormattedActive ? " active" : ""}`}
                      onClick={() => {
                        onDisplayFormattedClick();
                        setMoreOpen(false);
                      }}
                    >
                      {displayFormattedActive ? "✓ " : ""}Display formatted
                    </button>
                  )}
                  {onCloseAll != null && (
                    <button
                      type="button"
                      role="menuitem"
                      className="more-menu-item"
                      onClick={() => {
                        onCloseAll();
                        setMoreOpen(false);
                      }}
                    >
                      Close all tabs
                    </button>
                  )}
                  {onRestoreClosed != null && (
                    <button
                      type="button"
                      role="menuitem"
                      className="more-menu-item"
                      onClick={() => {
                        onRestoreClosed();
                        setMoreOpen(false);
                      }}
                    >
                      Restore closed tab
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
