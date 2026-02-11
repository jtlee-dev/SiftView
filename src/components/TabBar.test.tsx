import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabBar } from "./TabBar";
import type { Tab } from "../App";

function renderTabBar(props: {
  tabs: Tab[];
  activeId: string | null;
  onSelect?: (id: string) => void;
  onClose?: (id: string) => void;
  onNew?: () => void;
}) {
  const onSelect = props.onSelect ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  const onNew = props.onNew ?? vi.fn();
  render(
    <TabBar
      tabs={props.tabs}
      activeId={props.activeId}
      onSelect={onSelect}
      onClose={onClose}
      onNew={onNew}
    />
  );
  return { onSelect, onClose, onNew };
}

const tab = (id: string, label: string): Tab => ({
  id,
  label,
  content: "",
  state: "ephemeral",
});

describe("TabBar", () => {
  it("renders all tabs with labels", () => {
    const tabs = [tab("a", "First"), tab("b", "Second")];
    renderTabBar({ tabs, activeId: "a" });
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("marks the active tab with active class", () => {
    const tabs = [tab("a", "First"), tab("b", "Second")];
    renderTabBar({ tabs, activeId: "b" });
    const secondTab = screen.getByText("Second").closest("[role='tab']");
    expect(secondTab).toHaveClass("active");
    const firstTab = screen.getByText("First").closest("[role='tab']");
    expect(firstTab).not.toHaveClass("active");
  });

  it("calls onSelect when a tab is clicked", async () => {
    const user = userEvent.setup();
    const tabs = [tab("a", "First"), tab("b", "Second")];
    const { onSelect } = renderTabBar({ tabs, activeId: "a" });
    await user.click(screen.getByText("Second"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("calls onClose when close button is clicked and does not select tab", async () => {
    const user = userEvent.setup();
    const tabs = [tab("a", "First"), tab("b", "Second")];
    const { onSelect, onClose } = renderTabBar({ tabs, activeId: "a" });
    const firstTab = screen.getByText("First").closest("[role='tab']")!;
    const closeBtn = within(firstTab).getByRole("button", { name: /close first/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledWith("a");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onNew when the new-tab button is clicked", async () => {
    const user = userEvent.setup();
    const tabs = [tab("a", "First")];
    const { onNew } = renderTabBar({ tabs, activeId: "a" });
    await user.click(screen.getByRole("button", { name: /new tab/i }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("renders new-tab button when there are no tabs", () => {
    renderTabBar({ tabs: [], activeId: null });
    expect(screen.getByRole("button", { name: /new tab/i })).toBeInTheDocument();
  });
});
