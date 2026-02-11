import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { StateField, RangeSetBuilder, Compartment } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { EditorView, Decoration, type DecorationSet } from "@codemirror/view";
import { json } from "@codemirror/lang-json";

/** Line decorations for unified-diff view: removed, added, context, headers. */
function buildDiffDecorations(state: { doc: { lines: number; line: (n: number) => { from: number; text: string } } }): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const text = line.text;
    const first = text.charAt(0);
    let cls = "";
    if (text.startsWith("---") || text.startsWith("+++")) cls = "cm-diff-header";
    else if (text.startsWith("@@")) cls = "cm-diff-hunk";
    else if (first === "-") cls = "cm-diff-removed";
    else if (first === "+") cls = "cm-diff-added";
    else if (first === " " || first === "") cls = "cm-diff-context";
    if (cls) builder.add(line.from, line.from, Decoration.line({ class: cls }));
  }
  return builder.finish();
}

const diffDecorationField = StateField.define<DecorationSet>({
  create(state) {
    return buildDiffDecorations(state);
  },
  update(value, tr) {
    if (tr.docChanged) return buildDiffDecorations(tr.state);
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

import type { Segment } from "../App";

/** Build a StateField that decorates lines by segment type (cm-segment-json, etc.). */
function segmentDecorationExtension(segments: Segment[] | undefined) {
  if (!segments?.length) return [];
  const segs = segments;
  const field = StateField.define<DecorationSet>({
    create(state) {
      const builder = new RangeSetBuilder<Decoration>();
      for (const seg of segs) {
        const kind = seg.kind === "xml" ? "html" : seg.kind; // map xml to existing class
        const cls = `cm-segment-${kind}`;
        for (let lineNum = seg.start_line; lineNum <= seg.end_line; lineNum++) {
          if (lineNum < 1 || lineNum > state.doc.lines) continue;
          const line = state.doc.line(lineNum);
          builder.add(line.from, line.from, Decoration.line({ class: cls }));
        }
      }
      return builder.finish();
    },
    update(value, tr) {
      if (tr.docChanged) {
        const builder = new RangeSetBuilder<Decoration>();
        for (const seg of segs) {
          const kind = seg.kind === "xml" ? "html" : seg.kind;
          const cls = `cm-segment-${kind}`;
          for (let lineNum = seg.start_line; lineNum <= seg.end_line; lineNum++) {
            if (lineNum < 1 || lineNum > tr.state.doc.lines) continue;
            const line = tr.state.doc.line(lineNum);
            builder.add(line.from, line.from, Decoration.line({ class: cls }));
          }
        }
        return builder.finish();
      }
      return value.map(tr.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
  return [field];
}

interface EditorPaneProps {
  content: string;
  onChange: (content: string) => void;
  /** Detected content type (e.g. 'json', 'csv', 'text', 'diff') for syntax highlighting */
  language?: string;
  /** Per-segment types for mixed-mode visual grouping */
  segments?: Segment[];
  /** When true, show content read-only (e.g. "display as formatted" view) */
  readOnly?: boolean;
}

export function EditorPane({ content, onChange, language, segments, readOnly }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const segmentCompartmentRef = useRef<Compartment | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** Previous content prop. Only sync from parent when prop actually changed (e.g. Apply format), not on every re-render. */
  const prevContentRef = useRef<string>(content);

  // Create editor once per language (not per segments — remounting on segments change caused focus/cursor loss)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isDiff = language === "diff";
    const languageExt = language === "json" ? json() : [];
    const diffExt = isDiff ? [diffDecorationField] : [];
    const segmentCompartment = new Compartment();
    segmentCompartmentRef.current = segmentCompartment;
    const segmentExt = segmentCompartment.of(segmentDecorationExtension(segments));

    const extensions = [
      basicSetup,
      languageExt,
      ...diffExt,
      segmentExt,
    ];
    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
    } else {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        })
      );
    }
    const view = new EditorView({
      doc: content,
      extensions,
      parent: container,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
      segmentCompartmentRef.current = null;
    };
  }, [language, readOnly]); // do not depend on segments — reconfigure via compartment instead

  // Reconfigure segment decorations when segments change (no remount, preserves focus/cursor)
  useEffect(() => {
    const view = viewRef.current;
    const compartment = segmentCompartmentRef.current;
    if (!view || !compartment) return;
    view.dispatch({
      effects: compartment.reconfigure(segmentDecorationExtension(segments)),
    });
  }, [segments]);

  // Sync content only when the content prop actually changed (e.g. Apply format, tab switch).
  // If we always synced when current !== content, we'd overwrite the editor right after undo (parent state not updated yet).
  useEffect(() => {
    if (content === prevContentRef.current) return;
    prevContentRef.current = content;
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content },
      });
    }
  }, [content]);

  return <div ref={containerRef} />;
}
