interface FormatPreviewModalProps {
  formattedText: string;
  onApply: () => void;
  onCancel: () => void;
}

export function FormatPreviewModal({ formattedText, onApply, onCancel }: FormatPreviewModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="format-preview-title">
      <div className="modal-content format-preview-modal">
        <h2 id="format-preview-title" className="modal-title">Format JSON — Preview</h2>
        <p className="format-preview-hint">Preview pretty-printed JSON. Apply to replace the tab content.</p>
        <div className="format-preview-body">
          <pre className="format-preview-text">{formattedText}</pre>
        </div>
        <div className="modal-actions">
          <button type="button" className="modal-btn secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="modal-btn primary" onClick={onApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
