import { useState, useCallback, useEffect, useRef } from "react";
import {
  invoke,
  readText,
  writeText,
  openDialog,
  saveDialog,
  messageDialog,
  ask,
  registerShortcut,
  unregisterShortcut,
} from "./core/tauriBridge";
import { TabBar } from "./components/TabBar";
import { EditorPane } from "./components/EditorPane";
import { DiffView } from "./components/DiffView";
import { DiffPickerModal } from "./components/DiffPickerModal";
import { FormatPreviewModal } from "./components/FormatPreviewModal";
import { InspectorPanel } from "./components/InspectorPanel";
import { basename, getExtension } from "./utils/path";
import "./App.css";

const NEW_TAB_SHORTCUT = "CommandOrControl+N";

export type TabState = "clean" | "dirty" | "ephemeral";

/** Structured diff for side-by-side view (from compute_diff_structured). */
export interface StructuredDiff {
  left_label: string;
  right_label: string;
  blocks: Array<
    | { type: "unchanged"; count: number; lines: string[] }
    | { type: "changed"; old_lines: string[]; new_lines: string[] }
  >;
}

/** A contiguous region of the buffer with a detected type (1-based inclusive lines). */
export interface Segment {
  start_line: number;
  end_line: number;
  kind: string;
}

export interface Tab {
  id: string;
  label: string;
  content: string;
  state: TabState;
  /** Optional file path when opened from disk */
  path?: string;
  /** Detected content type from backend (e.g. json, csv, text) */
  detectedKind?: string;
  /** When set, tab shows side-by-side diff view instead of editor */
  diffData?: StructuredDiff;
  /** Per-segment detection for mixed-mode (from detect_segments) */
  segments?: Segment[];
  /** When true, show pretty-printed JSON in read-only view; content is unchanged */
  displayAsFormatted?: boolean;
  /** Cached formatted view (when displayAsFormatted is true) */
  formattedView?: string | null;
  /** Pinned tabs can prompt on close */
  pinned?: boolean;
  /** Unified diff text (for inline diff view) */
  diffUnified?: string;
  /** 'side-by-side' | 'inline' for diff tabs */
  diffViewMode?: "side-by-side" | "inline";
}

const DETECT_DEBOUNCE_MS = 400;

interface DetectedType {
  kind: string;
  confidence: number;
}

let tabIdCounter = 0;
function nextTabId(): string {
  return `tab-${++tabIdCounter}`;
}

function defaultLabel(id: string): string {
  return `Untitled-${id.replace("tab-", "")}`;
}

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => [
    {
      id: nextTabId(),
      label: defaultLabel("1"),
      content: "",
      state: "ephemeral",
    },
  ]);
  const [activeId, setActiveId] = useState<string | null>(tabs[0]?.id ?? null);
  const [showDiffPicker, setShowDiffPicker] = useState(false);
  const [formatPreview, setFormatPreview] = useState<{ formatted: string; tabId: string } | null>(null);
  const [recentlyClosed, setRecentlyClosed] = useState<{ tab: Tab; index: number }[]>([]);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const MAX_RECENTLY_CLOSED = 10;

  const addTab = useCallback(() => {
    const id = nextTabId();
    const newTab: Tab = {
      id,
      label: defaultLabel(id),
      content: "",
      state: "ephemeral",
    };
    setTabs((t) => [...t, newTab]);
    setActiveId(id);
  }, []);

  const addTabRef = useRef(addTab);
  addTabRef.current = addTab;

  useEffect(() => {
    let mounted = true;
    registerShortcut(NEW_TAB_SHORTCUT, (event) => {
      if (event.state === "Pressed" && mounted) addTabRef.current?.();
    }).catch(() => {});
    return () => {
      mounted = false;
      unregisterShortcut(NEW_TAB_SHORTCUT).catch(() => {});
    };
  }, []);

  const closeTab = useCallback((id: string) => {
    const closedIndex = tabs.findIndex((tab) => tab.id === id);
    const closedTab = tabs.find((tab) => tab.id === id);
    const remaining = tabs.filter((tab) => tab.id !== id);
    const nextActive =
      remaining.length > 0
        ? remaining[Math.min(closedIndex, remaining.length - 1)]?.id ?? remaining[0].id
        : null;
    if (closedTab != null) {
      setRecentlyClosed((prev) => [{ tab: closedTab, index: closedIndex }, ...prev].slice(0, MAX_RECENTLY_CLOSED));
    }
    setTabs(remaining);
    setActiveId((cur) => (cur === id ? nextActive : cur));
  }, [tabs]);

  const closeTabMaybeConfirm = useCallback(
    async (id: string) => {
      const tab = tabs.find((t) => t.id === id);
      if (tab?.pinned) {
        const yes = await ask("Close pinned tab? This tab is pinned.", {
          title: "Close tab",
          kind: "warning",
          okLabel: "Close",
          cancelLabel: "Cancel",
        });
        if (!yes) return;
      }
      closeTab(id);
    },
    [tabs, closeTab]
  );

  const setTabPinned = useCallback((id: string, pinned: boolean) => {
    setTabs((t) => t.map((tab) => (tab.id === id ? { ...tab, pinned } : tab)));
  }, []);

  const toggleTabPin = useCallback(
    (id: string) => {
      const tab = tabs.find((t) => t.id === id);
      if (tab) setTabPinned(id, !tab.pinned);
    },
    [tabs, setTabPinned]
  );

  const setTabDiffViewMode = useCallback((id: string, mode: "side-by-side" | "inline") => {
    setTabs((t) => t.map((tab) => (tab.id === id ? { ...tab, diffViewMode: mode } : tab)));
  }, []);

  const copyActiveTabToClipboard = useCallback(async () => {
    const tab = tabs.find((t) => t.id === activeId);
    if (!tab) return;
    const text =
      tab.diffData && tab.diffViewMode === "inline" && tab.diffUnified != null
        ? tab.diffUnified
        : tab.content;
    try {
      await writeText(text);
    } catch (err) {
      await messageDialog(String(err), { title: "Copy", kind: "error" });
    }
  }, [tabs, activeId]);

  const restoreClosedTab = useCallback(() => {
    const next = recentlyClosed[0];
    if (!next) return;
    setRecentlyClosed((prev) => prev.slice(1));
    const { tab, index } = next;
    setTabs((t) => {
      const i = Math.min(index, t.length);
      return [...t.slice(0, i), tab, ...t.slice(i)];
    });
    setActiveId(tab.id);
  }, [recentlyClosed]);

  const closeAllTabs = useCallback(() => {
    if (tabs.length === 0) return;
    const closed = tabs.map((tab, index) => ({ tab, index })).reverse();
    setRecentlyClosed((prev) => [...closed, ...prev].slice(0, MAX_RECENTLY_CLOSED));
    setTabs([]);
    setActiveId(null);
  }, [tabs]);

  const setTabContent = useCallback((id: string, content: string) => {
    setTabs((t) =>
      t.map((tab) =>
        tab.id === id ? { ...tab, content, state: "dirty" as TabState } : tab
      )
    );
  }, []);

  const setTabDetectedKind = useCallback((id: string, kind: string) => {
    setTabs((t) =>
      t.map((tab) => (tab.id === id ? { ...tab, detectedKind: kind } : tab))
    );
  }, []);

  const setTabSegments = useCallback((id: string, segments: Segment[]) => {
    setTabs((t) =>
      t.map((tab) => (tab.id === id ? { ...tab, segments } : tab))
    );
  }, []);

  const setTabDisplayFormatted = useCallback((id: string, formattedView: string | null, on: boolean) => {
    setTabs((t) =>
      t.map((tab) =>
        tab.id === id ? { ...tab, displayAsFormatted: on, formattedView } : tab
      )
    );
  }, []);

  const toggleDisplayFormatted = useCallback(async () => {
    const tab = tabs.find((t) => t.id === activeId);
    if (!tab || tab.diffData) return;
    if (tab.displayAsFormatted) {
      setTabDisplayFormatted(tab.id, null, false);
      return;
    }
    try {
      const formatted = await invoke<string>("format_content_segmented", {
        content: tab.content,
        segments: tab.segments ?? [],
      });
      setTabDisplayFormatted(tab.id, formatted, true);
    } catch (err) {
      await messageDialog(String(err), { title: "Display as formatted", kind: "error" });
    }
  }, [tabs, activeId, setTabDisplayFormatted]);

  const setTabSaved = useCallback((id: string, path: string, label: string) => {
    setTabs((t) =>
      t.map((tab) =>
        tab.id === id ? { ...tab, path, label, state: "clean" as TabState } : tab
      )
    );
  }, []);

  const setTabStateClean = useCallback((id: string) => {
    setTabs((t) =>
      t.map((tab) => (tab.id === id ? { ...tab, state: "clean" as TabState } : tab))
    );
  }, []);

  const saveCurrentTab = useCallback(async () => {
    const tab = tabs.find((t) => t.id === activeId);
    if (!tab?.path || tab.diffData) return;
    try {
      await invoke("write_file", { path: tab.path, content: tab.content });
      setTabStateClean(tab.id);
    } catch (err) {
      await messageDialog(String(err), { title: "Save", kind: "error" });
    }
  }, [tabs, activeId, setTabStateClean]);

  const saveAsCurrentTab = useCallback(async () => {
    const tab = tabs.find((t) => t.id === activeId);
    if (!tab || tab.diffData) return;
    const path = await saveDialog({ defaultPath: tab.path ?? tab.label });
    if (path == null) return;
    try {
      await invoke("write_file", { path, content: tab.content });
      setTabSaved(tab.id, path, basename(path));
    } catch (err) {
      await messageDialog(String(err), { title: "Save As", kind: "error" });
    }
  }, [tabs, activeId, setTabSaved]);

  const openFile = useCallback(async () => {
    const result = await openDialog({
      multiple: false,
      directory: false,
    });
    if (result == null) return;
    try {
      let path: string;
      let content: string;
      if (typeof result === "object" && "content" in result) {
        path = result.path;
        content = result.content;
      } else {
        path = Array.isArray(result) ? result[0] : result;
        content = await invoke<string>("read_file", { path });
      }
      const id = nextTabId();
      const extension = getExtension(path);
      const [detected, segments] = await Promise.all([
        invoke<DetectedType>("detect_content", { content, extension: extension || undefined }),
        invoke<Segment[]>("detect_segments", { content, extension: extension || undefined }),
      ]);
      const newTab: Tab = {
        id,
        label: basename(path),
        content,
        state: "clean",
        path,
        detectedKind: detected.kind,
        segments: segments.length > 0 ? segments : undefined,
      };
      setTabs((t) => [...t, newTab]);
      setActiveId(id);
    } catch (err) {
      await messageDialog(String(err), {
        title: "Open file",
        kind: "error",
      });
    }
  }, []);

  const activeTab = tabs.find((t) => t.id === activeId);

  const requestFormatJson = useCallback(async () => {
    if (!activeTab || activeTab.diffData) return;
    try {
      const formatted = await invoke<string>("format_content_segmented", {
        content: activeTab.content,
        segments: activeTab.segments ?? [],
      });
      setFormatPreview({ formatted, tabId: activeTab.id });
    } catch (err) {
      await messageDialog(String(err), { title: "Format", kind: "error" });
    }
  }, [activeTab]);

  const applyFormatPreview = useCallback(() => {
    if (!formatPreview) return;
    setTabContent(formatPreview.tabId, formatPreview.formatted);
    setFormatPreview(null);
  }, [formatPreview, setTabContent]);

  const runDiff = useCallback(
    async (leftTabId: string, rightSource: string, leftLabel: string, rightLabel: string) => {
      const leftTab = tabs.find((t) => t.id === leftTabId);
      if (!leftTab) return;
      let rightContent: string;
      if (rightSource === "__clipboard__") {
        try {
          rightContent = (await readText()) ?? "";
        } catch (err) {
          await messageDialog(String(err), { title: "Diff", kind: "error" });
          return;
        }
      } else {
        const rightTab = tabs.find((t) => t.id === rightSource);
        rightContent = rightTab?.content ?? "";
      }
      try {
        const [result, unified] = await Promise.all([
          invoke<StructuredDiff>("compute_diff_structured", {
            left: leftTab.content,
            right: rightContent,
          }),
          invoke<string>("compute_diff", {
            left: leftTab.content,
            right: rightContent,
          }),
        ]);
        const diffData: StructuredDiff = {
          ...result,
          left_label: leftLabel,
          right_label: rightLabel,
        };
        const id = nextTabId();
        setTabs((t) => [
          ...t,
          {
            id,
            label: `Diff: ${leftLabel} vs ${rightLabel}`,
            content: "",
            state: "ephemeral",
            detectedKind: "diff",
            diffData,
            diffUnified: unified,
            diffViewMode: "side-by-side" as const,
          },
        ]);
        setActiveId(id);
        setShowDiffPicker(false);
      } catch (err) {
        await messageDialog(String(err), { title: "Diff", kind: "error" });
      }
    },
    [tabs]
  );

  // Debounced content detection and segmentation when active tab content changes
  const detectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeTab || activeTab.diffData) return;
    const runDetection = async () => {
      const content = activeTab.content;
      const extension = activeTab.path ? getExtension(activeTab.path) : undefined;
      try {
        const [detected, segments] = await Promise.all([
          invoke<DetectedType>("detect_content", { content, extension: extension || undefined }),
          invoke<Segment[]>("detect_segments", { content, extension: extension || undefined }),
        ]);
        setTabDetectedKind(activeTab.id, detected.kind);
        setTabSegments(activeTab.id, segments);
      } catch {
        // Ignore (e.g. not in Tauri env)
      }
    };
    if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
    detectTimeoutRef.current = setTimeout(runDetection, DETECT_DEBOUNCE_MS);
    return () => {
      if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
      detectTimeoutRef.current = null;
    };
  }, [activeTab?.id, activeTab?.content, activeTab?.path, activeTab?.diffData, setTabDetectedKind, setTabSegments]);

  // When content changes while "display as formatted" is on, refresh the formatted view
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeId);
    if (!tab?.displayAsFormatted) return;
    let cancelled = false;
    invoke<string>("format_content_segmented", {
      content: tab.content,
      segments: tab.segments ?? [],
    })
      .then((formatted) => {
        if (!cancelled)
          setTabs((t) => t.map((tb) => (tb.id === activeId ? { ...tb, formattedView: formatted } : tb)));
      })
      .catch(() => {
        if (!cancelled) setTabDisplayFormatted(activeId!, null, false);
      });
    return () => { cancelled = true; };
  }, [activeId, tabs.find((t) => t.id === activeId)?.content, tabs.find((t) => t.id === activeId)?.displayAsFormatted, tabs.find((t) => t.id === activeId)?.segments, setTabDisplayFormatted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const inInput = target.closest("input, textarea, [contenteditable=true]");
      if (inInput) return;

      if (mod && e.shiftKey && e.key === "T") {
        e.preventDefault();
        e.stopPropagation();
        if (recentlyClosed.length > 0) restoreClosedTab();
        return;
      }
      if (mod && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (activeTab?.path && activeTab.state === "dirty") saveCurrentTab();
        else if (activeTab && !activeTab.diffData) saveAsCurrentTab();
        return;
      }
      if (mod && e.key === "w") {
        e.preventDefault();
        e.stopPropagation();
        if (activeId) closeTabMaybeConfirm(activeId);
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recentlyClosed.length, restoreClosedTab, activeTab, activeId, saveCurrentTab, saveAsCurrentTab, closeTabMaybeConfirm, addTab]);

  return (
    <div className="app">
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={closeTabMaybeConfirm}
        onNew={addTab}
        onOpen={openFile}
        onDiffClick={() => setShowDiffPicker(true)}
        onRestoreClosed={recentlyClosed.length > 0 ? restoreClosedTab : undefined}
        onFormatClick={activeTab && !activeTab.diffData ? requestFormatJson : undefined}
        onDisplayFormattedClick={activeTab && !activeTab.diffData ? toggleDisplayFormatted : undefined}
        displayFormattedActive={!!activeTab?.displayAsFormatted}
        onSave={activeTab?.path && activeTab.state === "dirty" ? saveCurrentTab : undefined}
        onSaveAs={activeTab && !activeTab.diffData ? saveAsCurrentTab : undefined}
        onCloseAll={tabs.length > 0 ? closeAllTabs : undefined}
        onPinToggle={toggleTabPin}
        onCopy={activeTab ? copyActiveTabToClipboard : undefined}
      />
      {formatPreview && (
        <FormatPreviewModal
          formattedText={formatPreview.formatted}
          onApply={applyFormatPreview}
          onCancel={() => setFormatPreview(null)}
        />
      )}
      {showDiffPicker && (
        <DiffPickerModal
          tabs={tabs}
          activeId={activeId}
          onClose={() => setShowDiffPicker(false)}
          onRun={runDiff}
        />
      )}
      <div className="main-area">
        <div className="editor-pane">
          {activeTab ? (
            activeTab.diffData ? (
              <div className="diff-tab-wrap">
                <div className="diff-view-toolbar">
                  <span className="diff-view-mode-label">View:</span>
                  <button
                    type="button"
                    className={`diff-mode-btn${activeTab.diffViewMode !== "inline" ? " active" : ""}`}
                    onClick={() => setTabDiffViewMode(activeTab.id, "side-by-side")}
                  >
                    Side-by-side
                  </button>
                  <button
                    type="button"
                    className={`diff-mode-btn${activeTab.diffViewMode === "inline" ? " active" : ""}`}
                    onClick={() => setTabDiffViewMode(activeTab.id, "inline")}
                  >
                    Inline
                  </button>
                </div>
                <div className="diff-tab-content">
                  {activeTab.diffViewMode === "inline" && activeTab.diffUnified != null ? (
                    <EditorPane
                      key={`${activeTab.id}-inline-diff`}
                      content={activeTab.diffUnified}
                      onChange={() => {}}
                      language="diff"
                      readOnly
                    />
                  ) : (
                    <DiffView data={activeTab.diffData} />
                  )}
                </div>
              </div>
            ) : (
              <EditorPane
              key={`${activeTab.id}-${!!activeTab.displayAsFormatted}`}
              content={activeTab.displayAsFormatted && activeTab.formattedView != null ? activeTab.formattedView : activeTab.content}
              onChange={(content) => setTabContent(activeTab.id, content)}
              language={activeTab.detectedKind}
              segments={activeTab.displayAsFormatted ? undefined : activeTab.segments}
              readOnly={!!activeTab.displayAsFormatted}
            />
            )
          ) : (
            <div style={{ padding: 24, color: "#666" }}>
              No tab open. Click “+” to add a tab.
            </div>
          )}
        </div>
        {inspectorOpen && (
          <InspectorPanel
            label={activeTab?.label}
            path={activeTab?.path}
            detectedKind={activeTab?.detectedKind}
            segments={activeTab?.segments}
            content={activeTab?.content ?? ""}
            isDiff={!!activeTab?.diffData}
          />
        )}
      </div>
      <footer className="status-bar">
        <span className="status-bar-left">
          {activeTab
            ? `${activeTab.label} · ${activeTab.state}${activeTab.detectedKind ? ` · ${activeTab.detectedKind}` : ""}`
            : "SiftView — viewer-first, editor-second"}
        </span>
        <button
          type="button"
          className={`inspector-toggle${inspectorOpen ? " open" : ""}`}
          onClick={() => setInspectorOpen((v) => !v)}
          aria-label={inspectorOpen ? "Hide inspector" : "Show inspector"}
          title={inspectorOpen ? "Hide inspector" : "Show inspector"}
        >
          Inspector
        </button>
      </footer>
    </div>
  );
}
