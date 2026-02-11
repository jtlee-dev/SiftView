import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App, { unifiedDiffWithLabels } from "./App";

// Bridge (Tauri vs web) is mocked so tests run without Tauri.
vi.mock("./core/tauriBridge", () => ({
  isTauri: () => false,
  invoke: vi.fn(() => Promise.resolve("")),
  openDialog: vi.fn(() => Promise.resolve(null)),
  saveDialog: vi.fn(() => Promise.resolve(null)),
  messageDialog: vi.fn(() => Promise.resolve()),
  ask: vi.fn(() => Promise.resolve(true)),
  readText: vi.fn(() => Promise.resolve("")),
  writeText: vi.fn(() => Promise.resolve()),
  registerShortcut: vi.fn(() => Promise.resolve()),
  unregisterShortcut: vi.fn(() => Promise.resolve()),
  getAppVersion: vi.fn(() => Promise.resolve("0.1.0")),
}));

// EditorPane uses CodeMirror which is heavy for unit tests; mock it.
vi.mock("./components/EditorPane", () => ({
  EditorPane: ({
    content,
    onChange,
    language,
  }: {
    content: string;
    onChange: (content: string) => void;
    language?: string;
  }) => (
    <div data-testid="editor-pane" data-language={language}>
      <span data-testid="editor-content">{content}</span>
      <button type="button" onClick={() => onChange("edited")}>
        Type something
      </button>
    </div>
  ),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one tab by default", () => {
    render(<App />);
    expect(screen.getByTestId("editor-pane")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new tab/i })).toBeInTheDocument();
  });

  it("shows status bar with active tab label and state", () => {
    render(<App />);
    const status = screen.getByRole("contentinfo");
    expect(status).toHaveTextContent("ephemeral");
  });

  it("adds a new tab when + is clicked and selects it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const initialTabs = screen.getAllByRole("button", { name: /untitled|close/i });
    await user.click(screen.getByRole("button", { name: /new tab/i }));
    const afterTabs = screen.getAllByRole("button", { name: /untitled|close/i });
    expect(afterTabs.length).toBeGreaterThan(initialTabs.length);
  });

  it("closing the only tab shows empty state and status message", async () => {
    const user = userEvent.setup();
    render(<App />);
    const closeBtn = screen.getByRole("button", { name: /close untitled/i });
    await user.click(closeBtn);
    expect(screen.getByText(/No tab open/)).toBeInTheDocument();
    expect(screen.getByText(/viewer-first, editor-second/)).toBeInTheDocument();
  });

  it("restores most recently closed tab when Restore is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /type something/i })); // tab has "edited"
    const closeBtn = screen.getByRole("button", { name: /close untitled/i });
    await user.click(closeBtn);
    expect(screen.getByText(/No tab open/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /restore closed tab/i }));
    expect(screen.queryByText(/No tab open/)).not.toBeInTheDocument();
    expect(screen.getByTestId("editor-content")).toHaveTextContent("edited");
  });

  it("editing content marks tab as dirty in status bar", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("ephemeral");
    await user.click(screen.getByRole("button", { name: /type something/i }));
    expect(screen.getByRole("contentinfo")).toHaveTextContent("dirty");
  });

  it("opens file in new tab when Open is clicked and dialog returns path", async () => {
    const user = userEvent.setup();
    const { invoke, openDialog } = await import("./core/tauriBridge");
    vi.mocked(openDialog).mockResolvedValueOnce("/some/dir/myfile.txt");
    vi.mocked(invoke)
      .mockResolvedValueOnce("file content here" as never)
      .mockResolvedValueOnce({ kind: "json", confidence: 0.95 } as never);

    render(<App />);
    await user.click(screen.getByRole("button", { name: /open file/i }));

    await waitFor(() => {
      expect(screen.getByText("myfile.txt")).toBeInTheDocument();
    });
    expect(screen.getByTestId("editor-content")).toHaveTextContent("file content here");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("json");
    expect(screen.getByTestId("editor-pane")).toHaveAttribute("data-language", "json");
  });

  it("shows detected content kind in status bar after content change", async () => {
    const { invoke } = await import("./core/tauriBridge");
    vi.mocked(invoke).mockImplementation((cmd: string) =>
      cmd === "detect_content"
        ? Promise.resolve({ kind: "csv", confidence: 0.7 })
        : Promise.resolve("")
    );

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /type something/i }));

    await waitFor(
      () => {
        expect(screen.getByRole("contentinfo")).toHaveTextContent("csv");
      },
      { timeout: 1000 }
    );
  });

  it("does not add tab when Open is clicked and user cancels dialog", async () => {
    const user = userEvent.setup();
    const { openDialog } = await import("./core/tauriBridge");
    vi.mocked(openDialog).mockResolvedValueOnce(null);

    render(<App />);
    const tabsBefore = screen.getAllByRole("tab").length;
    await user.click(screen.getByRole("button", { name: /open file/i }));
    await waitFor(() => {}); // allow async to settle
    const tabsAfter = screen.getAllByRole("tab").length;
    expect(tabsAfter).toBe(tabsBefore);
  });

  it("opens diff picker and new tab with side-by-side diff when Diff then Show diff", async () => {
    const user = userEvent.setup();
    const { invoke, readText } = await import("./core/tauriBridge");
    vi.mocked(readText).mockResolvedValueOnce("clipboard\ncontent");
    vi.mocked(invoke).mockImplementation((cmd: string) =>
      cmd === "compute_diff_structured"
        ? Promise.resolve({
            left_label: "current",
            right_label: "clipboard",
            blocks: [
              { type: "unchanged", count: 0, lines: [] },
              { type: "changed", old_lines: ["edited"], new_lines: ["clipboard", "content"] },
            ],
          })
        : Promise.resolve("")
    );

    render(<App />);
    await user.click(screen.getByRole("button", { name: /type something/i })); // ensure tab has content
    await user.click(screen.getByRole("button", { name: /^diff$/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/left/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/right/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^show diff$/i }));

    await waitFor(() => {
      expect(readText).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("compute_diff_structured", expect.objectContaining({ left: "edited", right: "clipboard\ncontent" }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Diff: Untitled-1 vs Clipboard/i })).toBeInTheDocument();
    expect(screen.getByText("edited")).toBeInTheDocument();
  });

  describe("unifiedDiffWithLabels", () => {
    it("rewrites --- current and +++ clipboard to given labels", () => {
      const unified = "--- current\n+++ clipboard\n\n@@ -1,2 +1,2 @@\n-a\n+b";
      const out = unifiedDiffWithLabels(unified, "Left.txt", "Right.txt");
      expect(out).toContain("--- Left.txt");
      expect(out).toContain("+++ Right.txt");
      expect(out).not.toContain("--- current");
      expect(out).not.toContain("+++ clipboard");
      expect(out).toContain("@@ -1,2 +1,2 @@");
    });

    it("returns unchanged string when first line does not start with --- ", () => {
      const unified = "not a diff header\n+++ clipboard\n";
      expect(unifiedDiffWithLabels(unified, "A", "B")).toBe(unified);
    });

    it("returns unchanged string when second line does not start with +++ ", () => {
      const unified = "--- current\nnot plus plus\n";
      expect(unifiedDiffWithLabels(unified, "A", "B")).toBe(unified);
    });

    it("returns unchanged string when there are fewer than two lines", () => {
      expect(unifiedDiffWithLabels("--- current", "A", "B")).toBe("--- current");
      expect(unifiedDiffWithLabels("", "A", "B")).toBe("");
    });

    it("preserves rest of diff body after header", () => {
      const unified = "--- current\n+++ clipboard\n\nbody\nlines";
      const out = unifiedDiffWithLabels(unified, "L", "R");
      expect(out).toBe("--- L\n+++ R\n\nbody\nlines");
    });
  });

  it("inline diff view shows actual left/right labels instead of current and clipboard", async () => {
    const user = userEvent.setup();
    const { invoke } = await import("./core/tauriBridge");
    const rawUnified = "--- current\n+++ clipboard\n\n@@ -1,1 +1,1 @@\n-old\n+new";
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "compute_diff_structured")
        return Promise.resolve({
          left_label: "current",
          right_label: "clipboard",
          blocks: [{ type: "unchanged", count: 0, lines: [] }, { type: "changed", old_lines: ["old"], new_lines: ["new"] }],
        });
      if (cmd === "compute_diff") return Promise.resolve(rawUnified);
      return Promise.resolve("");
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: /type something/i }));
    await user.click(screen.getByRole("button", { name: /^diff$/i }));
    const dialog = screen.getByRole("dialog");
    const leftSelect = within(dialog).getByLabelText(/left/i);
    const tabOptionValue = within(leftSelect).getAllByRole("option")[0].getAttribute("value")!;
    await user.selectOptions(leftSelect, tabOptionValue);
    const rightSelect = within(dialog).getByLabelText(/right/i);
    await user.selectOptions(rightSelect, tabOptionValue);
    await user.click(within(dialog).getByRole("button", { name: /^show diff$/i }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Diff: Untitled-1 vs Untitled-1/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^inline$/i }));

    const editorContent = screen.getByTestId("editor-content").textContent;
    expect(editorContent).toContain("--- Untitled-1");
    expect(editorContent).toContain("+++ Untitled-1");
    expect(editorContent).not.toContain("--- current");
    expect(editorContent).not.toContain("+++ clipboard");
  });
});
