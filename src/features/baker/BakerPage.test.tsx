// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BakerPage } from "./BakerPage";

const fetchSceneSummary = vi.fn();
const bakeExternalParent = vi.fn();

vi.mock("../../api/client", () => ({
  fetchSceneSummary: (...args: unknown[]) => fetchSceneSummary(...args),
  bakeExternalParent: (...args: unknown[]) => bakeExternalParent(...args),
}));

const sceneSummary = {
  frame_start: 1,
  frame_end: 180,
  fps: 30,
  models: [
    {
      root_object_name: "MikuRoot",
      armature_object_name: "MikuArmature",
      active_action_name: "walk_bone",
      bones: [
        {
          bone_name: "wrist.R",
          bone_name_j: "\u53f3\u624b\u9996",
          bone_id: 1,
        },
      ],
    },
    {
      root_object_name: "PropRoot",
      armature_object_name: "PropArmature",
      active_action_name: "prop_bone",
      bones: [
        {
          bone_name: "parent",
          bone_name_j: "\u89aa",
          bone_id: 8,
        },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
  fetchSceneSummary.mockReset();
  bakeExternalParent.mockReset();
});

describe("BakerPage timeline workflow", () => {
  function getTrackLane(container: HTMLElement) {
    return container.querySelectorAll(".timeline-row__lane")[1] as HTMLDivElement;
  }

  it("keeps source configuration in the main editor area and removes global zoom buttons", async () => {
    fetchSceneSummary.mockResolvedValue(sceneSummary);

    render(<BakerPage />);

    await screen.findByDisplayValue("walk_bone");

    expect(screen.getByText("MMD Ext Parent Baker")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "XS" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Fit" })).toBeNull();
    expect(screen.getByLabelText("Source Model")).not.toBeNull();
    expect(screen.getByLabelText("Source Action")).not.toBeNull();
    expect(screen.getByLabelText("Frame Start")).not.toBeNull();
    expect(screen.getByLabelText("Frame End")).not.toBeNull();
    expect(screen.getByLabelText("Output Action")).not.toBeNull();
  });

  it("selects a newly added keyframe and exposes it in the inspector", async () => {
    fetchSceneSummary.mockResolvedValue(sceneSummary);
    const user = userEvent.setup();

    const { container } = render(<BakerPage />);

    await screen.findByDisplayValue("walk_bone");
    await user.click(screen.getByRole("button", { name: "Add Track" }));
    await user.click(screen.getByRole("button", { name: /Add Keyframe/i }));

    const inspector = screen.getByRole("region", { name: "Keyframe Inspector" });
    expect((within(inspector).getByLabelText("Frame") as HTMLInputElement).value).toBe("1");
    expect((within(inspector).getByLabelText("Enabled") as HTMLInputElement).checked).toBe(true);

    fireEvent.pointerDown(getTrackLane(container), { clientX: 0, pointerId: 1 });
    fireEvent.pointerUp(getTrackLane(container), { clientX: 0, pointerId: 1 });
    await user.click(screen.getByRole("button", { name: /Add Keyframe/i }));

    expect(screen.getAllByRole("button", { name: "Keyframe 1" })).toHaveLength(1);
  });

  it("moves track controls into a dedicated inspector and keeps rows compact", async () => {
    fetchSceneSummary.mockResolvedValue(sceneSummary);
    const user = userEvent.setup();

    render(<BakerPage />);

    await screen.findByDisplayValue("walk_bone");
    await user.click(screen.getByRole("button", { name: "Add Track" }));

    const trackInspector = screen.getByRole("region", { name: "Track Inspector" });
    expect(within(trackInspector).getByLabelText("Source Bone")).not.toBeNull();
    expect(within(trackInspector).getByRole("button", { name: "Add Keyframe" })).not.toBeNull();
    expect(within(trackInspector).getByRole("button", { name: "Remove Track" })).not.toBeNull();

    const timeline = screen.getByRole("region", { name: "Timeline" });
    expect(within(timeline).queryByText("Source Bone")).toBeNull();
    expect(within(timeline).queryByRole("button", { name: "Remove Track" })).toBeNull();
  });

  it("switches the right inspector from track mode to keyframe mode when a keyframe is selected", async () => {
    fetchSceneSummary.mockResolvedValue(sceneSummary);
    const user = userEvent.setup();

    render(<BakerPage />);

    await screen.findByDisplayValue("walk_bone");
    await user.click(screen.getByRole("button", { name: "Add Track" }));

    const trackInspector = screen.getByRole("region", { name: "Track Inspector" });
    await user.click(within(trackInspector).getByRole("button", { name: "Add Keyframe" }));

    expect(screen.queryByRole("region", { name: "Track Inspector" })).toBeNull();
    expect(screen.getByRole("region", { name: "Keyframe Inspector" })).not.toBeNull();
  });

  it("updates the timeline marker when the inspector frame changes", async () => {
    fetchSceneSummary.mockResolvedValue(sceneSummary);
    const user = userEvent.setup();

    render(<BakerPage />);

    await screen.findByDisplayValue("walk_bone");
    await user.click(screen.getByRole("button", { name: "Add Track" }));
    await user.click(screen.getByRole("button", { name: /Add Keyframe/i }));

    const inspector = screen.getByRole("region", { name: "Keyframe Inspector" });
    const frameInput = within(inspector).getByLabelText("Frame");

    fireEvent.change(frameInput, { target: { value: "12" } });

    expect(screen.getByRole("button", { name: "Keyframe 12" })).not.toBeNull();
  });

  it("selects the existing keyframe when inspector frame changes to an occupied frame", async () => {
    fetchSceneSummary.mockResolvedValue(sceneSummary);
    const user = userEvent.setup();

    const { container } = render(<BakerPage />);

    await screen.findByDisplayValue("walk_bone");
    await user.click(screen.getByRole("button", { name: "Add Track" }));
    await user.click(screen.getByRole("button", { name: /Add Keyframe/i }));

    fireEvent.pointerDown(getTrackLane(container), { clientX: 0, pointerId: 2 });
    fireEvent.pointerUp(getTrackLane(container), { clientX: 0, pointerId: 2 });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Cursor" }), { target: { value: "12" } });
    await user.click(screen.getByRole("button", { name: /Add Keyframe/i }));

    const inspector = screen.getByRole("region", { name: "Keyframe Inspector" });
    fireEvent.change(within(inspector).getByLabelText("Frame"), { target: { value: "1" } });

    expect((within(inspector).getByLabelText("Frame") as HTMLInputElement).value).toBe("1");
    expect(screen.getAllByRole("button", { name: "Keyframe 1" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Keyframe 12" })).toHaveLength(1);
  });

  it("keeps the selected keyframe after timeline navigation changes", async () => {
    fetchSceneSummary.mockResolvedValue(sceneSummary);
    const user = userEvent.setup();

    render(<BakerPage />);

    await screen.findByDisplayValue("walk_bone");
    await user.click(screen.getByRole("button", { name: "Add Track" }));
    await user.click(screen.getByRole("button", { name: /Add Keyframe/i }));

    const inspector = screen.getByRole("region", { name: "Keyframe Inspector" });
    fireEvent.change(within(inspector).getByLabelText("Frame"), { target: { value: "48" } });
    const overview = screen.getByLabelText("Timeline overview");
    Object.defineProperty(overview, "clientWidth", { configurable: true, value: 800 });
    overview.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 800,
        height: 40,
        top: 0,
        left: 0,
        bottom: 40,
        right: 800,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(overview, { clientX: 600 });

    expect((within(inspector).getByLabelText("Frame") as HTMLInputElement).value).toBe("48");
  });
});
