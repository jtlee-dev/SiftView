import type { Tab } from "../App";

const CLIPBOARD_ID = "__clipboard__";

interface DiffPickerModalProps {
  tabs: Tab[];
  activeId: string | null;
  onClose: () => void;
  onRun: (leftTabId: string, rightSource: string, leftLabel: string, rightLabel: string) => void;
}

export function DiffPickerModal({
  tabs,
  activeId,
  onClose,
  onRun,
}: DiffPickerModalProps) {
  const editableTabs = tabs.filter((t) => !t.diffData);
  const defaultLeft = editableTabs.some((t) => t.id === activeId) ? activeId : editableTabs[0]?.id ?? "";
  const rightId = CLIPBOARD_ID;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const left = (form.elements.namedItem("diff-left") as HTMLSelectElement).value;
    const right = (form.elements.namedItem("diff-right") as HTMLSelectElement).value;
    const leftTab = tabs.find((t) => t.id === left);
    const rightTab = right === CLIPBOARD_ID ? null : tabs.find((t) => t.id === right);
    const leftLabel = leftTab?.label ?? "Left";
    const rightLabel = right === CLIPBOARD_ID ? "Clipboard" : (rightTab?.label ?? "Right");
    onRun(left, right, leftLabel, rightLabel);
  };

  const canDiff = editableTabs.length >= 1;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="diff-picker-title">
      <div className="modal-content diff-picker-modal">
        <h2 id="diff-picker-title" className="modal-title">Diff</h2>
        <p className="diff-picker-hint">Choose left and right sources to compare.</p>
        <form onSubmit={handleSubmit}>
          <div className="diff-picker-row">
            <label htmlFor="diff-left">Left</label>
            <select id="diff-left" name="diff-left" defaultValue={defaultLeft} className="diff-picker-select">
              {editableTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
              {editableTabs.length === 0 && (
                <option value="">No tabs with content</option>
              )}
            </select>
          </div>
          <div className="diff-picker-row">
            <label htmlFor="diff-right">Right</label>
            <select id="diff-right" name="diff-right" defaultValue={rightId} className="diff-picker-select">
              <option value={CLIPBOARD_ID}>Clipboard</option>
              {editableTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal-btn primary" disabled={!canDiff}>
              Show diff
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
