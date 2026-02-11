import { useState, useRef, useEffect } from "react";
import type { Tab } from "../App";

interface TabBarProps {
  tabs: Tab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
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
          {tabs.map((tab) => (
            <div
              key={tab.id}
              role="tab"
              tabIndex={0}
              className={`tab ${tab.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(tab.id)}
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
