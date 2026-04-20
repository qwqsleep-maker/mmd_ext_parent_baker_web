// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SceneSummary } from "../../../api/types";
import { addEventToTrack, addTrackToDraft, createDraftFromScene, createEmptySelection, createTimelineViewport } from "../state";
import { TimelineEditor } from "./TimelineEditor";

const sceneSummary: SceneSummary = {
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
  ],
};

afterEach(() => {
  cleanup();
});

function mockOverviewMetrics(element: HTMLElement) {
  Object.defineProperty(element, "clientWidth", { configurable: true, value: 800 });
  element.getBoundingClientRect = () =>
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
}

function renderTimelineEditor(visibleFrameEnd = 96) {
  const draft = createDraftFromScene(sceneSummary);
  const viewport = {
    ...createTimelineViewport(sceneSummary),
    visible_frame_end: visibleFrameEnd,
  };
  const onViewportChange = vi.fn();
  const onSelectionChange = vi.fn();
  const onMoveKeyframe = vi.fn();

  const view = render(
    <TimelineEditor
      canAddTrack
      draft={draft}
      onAddKeyframe={vi.fn()}
      onAddTrack={vi.fn()}
      onMoveKeyframe={onMoveKeyframe}
      onRemoveTrack={vi.fn()}
      onSelectionChange={onSelectionChange}
      onTrackSourceBoneChange={vi.fn()}
      onViewportChange={onViewportChange}
      referenceIssues={null}
      scene={sceneSummary}
      selectedModel={sceneSummary.models[0]}
      selection={createEmptySelection()}
      viewport={viewport}
    />,
  );

  const overview = screen.getByLabelText("Timeline overview");
  mockOverviewMetrics(overview);

  return { ...view, draft, onMoveKeyframe, onSelectionChange, onViewportChange, overview };
}

function renderLargeRangeTimelineEditor() {
  const largeScene: SceneSummary = {
    ...sceneSummary,
    frame_end: 4351,
  };
  const withTrack = addTrackToDraft(createDraftFromScene(largeScene), "\u53f3\u624b\u9996");
  const withEvent = addEventToTrack(withTrack.draft, withTrack.track_id, 1200);
  const viewport = {
    ...createTimelineViewport(largeScene),
    visible_frame_end: 4351,
  };

  const view = render(
    <TimelineEditor
      canAddTrack
      draft={withEvent.draft}
      onAddKeyframe={vi.fn()}
      onAddTrack={vi.fn()}
      onMoveKeyframe={vi.fn()}
      onRemoveTrack={vi.fn()}
      onSelectionChange={vi.fn()}
      onTrackSourceBoneChange={vi.fn()}
      onViewportChange={vi.fn()}
      referenceIssues={null}
      scene={largeScene}
      selectedModel={largeScene.models[0]}
      selection={createEmptySelection()}
      viewport={viewport}
    />,
  );

  return view;
}

describe("TimelineEditor overview navigation", () => {
  it("fills the detail lane width when the visible frame window shrinks", () => {
    const { container } = renderTimelineEditor(24);

    const rulerStrip = container.querySelector(".timeline-row--ruler .timeline-strip") as HTMLDivElement | null;
    const lastTick = screen.getByText("24").closest(".timeline-tick") as HTMLDivElement | null;

    expect(rulerStrip?.style.width).toBe("240px");
    expect(lastTick?.style.left).toBe("230px");
  });

  it("renders sparse labeled major ticks and layered grid lines for huge spans", () => {
    const { container } = renderLargeRangeTimelineEditor();

    const majorLabels = container.querySelectorAll(".timeline-tick--major span");
    const minorLabels = container.querySelectorAll(".timeline-tick--minor span");
    const laneMinorGrid = container.querySelector(".timeline-grid-line--minor");
    const laneMajorGrid = container.querySelector(".timeline-grid-line--major");

    expect(majorLabels.length).toBeLessThanOrEqual(4);
    expect(majorLabels[0]?.textContent).toBe("1");
    expect(minorLabels.length).toBe(0);
    expect(laneMajorGrid).not.toBeNull();
    expect(laneMinorGrid).not.toBeNull();
  });

  it("moves the visible window when the overview is clicked", () => {
    const { onViewportChange, overview } = renderTimelineEditor();

    fireEvent.click(overview, { clientX: 720 });

    expect(onViewportChange).toHaveBeenCalled();
    expect(onViewportChange.mock.calls.at(-1)?.[0]).toMatchObject({
      visible_frame_start: 85,
      visible_frame_end: 180,
    });
  });

  it("resizes the visible window from the left handle", () => {
    const { onViewportChange, overview } = renderTimelineEditor();

    const leftHandle = screen.getByLabelText("Resize visible timeline window start");
    fireEvent.pointerDown(leftHandle, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(overview, { clientX: 120, pointerId: 1 });

    expect(onViewportChange).toHaveBeenCalled();
    expect(onViewportChange.mock.calls.at(-1)?.[0]).toMatchObject({
      visible_frame_start: 28,
      visible_frame_end: 96,
    });

    fireEvent.pointerUp(overview, { pointerId: 1 });
  });

  it("toggles a dragging class while the overview drag session is active", () => {
    const { container, overview } = renderTimelineEditor();

    const windowBody = screen.getByLabelText("Visible timeline window");
    fireEvent.pointerDown(windowBody, { clientX: 0, pointerId: 3 });

    expect((container.firstChild as HTMLElement).classList.contains("timeline-shell--dragging")).toBe(true);

    fireEvent.pointerUp(overview, { pointerId: 3 });

    expect((container.firstChild as HTMLElement).classList.contains("timeline-shell--dragging")).toBe(false);
  });

  it("resizes the visible window from the right handle", () => {
    const { onViewportChange, overview } = renderTimelineEditor();

    const rightHandle = screen.getByLabelText("Resize visible timeline window end");
    fireEvent.pointerDown(rightHandle, { clientX: 0, pointerId: 2 });
    fireEvent.pointerMove(overview, { clientX: 120, pointerId: 2 });

    expect(onViewportChange).toHaveBeenCalled();
    expect(onViewportChange.mock.calls.at(-1)?.[0]).toMatchObject({
      visible_frame_start: 1,
      visible_frame_end: 123,
    });

    fireEvent.pointerUp(overview, { pointerId: 2 });
  });

  it("keeps window width unchanged when dragging the overview window body", () => {
    const { onViewportChange, overview } = renderTimelineEditor();

    const windowBody = screen.getByLabelText("Visible timeline window");
    fireEvent.pointerDown(windowBody, { clientX: 0, pointerId: 4 });
    fireEvent.pointerMove(overview, { clientX: 120, pointerId: 4 });

    expect(onViewportChange).toHaveBeenCalled();
    expect(onViewportChange.mock.calls.at(-1)?.[0]).toMatchObject({
      visible_frame_start: 28,
      visible_frame_end: 123,
    });

    fireEvent.pointerUp(overview, { pointerId: 4 });
  });

  it("ignores the synthetic overview click that follows a resize drag", () => {
    const { onViewportChange, overview } = renderTimelineEditor();

    const leftHandle = screen.getByLabelText("Resize visible timeline window start");
    fireEvent.pointerDown(leftHandle, { clientX: 0, pointerId: 5 });
    fireEvent.pointerMove(overview, { clientX: 120, pointerId: 5 });

    const callCountAfterDragMove = onViewportChange.mock.calls.length;

    fireEvent.pointerUp(overview, { pointerId: 5 });
    fireEvent.click(overview, { clientX: 120 });

    expect(onViewportChange).toHaveBeenCalledTimes(callCountAfterDragMove);
  });

  it("scrubs the cursor continuously while dragging on the ruler lane", () => {
    const { container, onViewportChange } = renderTimelineEditor();

    const rulerLane = container.querySelector(".timeline-row__lane--ruler") as HTMLDivElement | null;
    expect(rulerLane).not.toBeNull();

    Object.defineProperty(rulerLane, "clientWidth", { configurable: true, value: 240 });
    rulerLane!.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 240,
        height: 28,
        top: 0,
        left: 0,
        bottom: 28,
        right: 240,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.pointerDown(rulerLane!, { clientX: 0, pointerId: 10 });
    fireEvent.pointerMove(rulerLane!, { clientX: 60, pointerId: 10 });

    expect(onViewportChange).toHaveBeenCalledTimes(2);
    expect(onViewportChange.mock.calls[0]?.[0]).toMatchObject({ cursor_frame: 1 });
    expect(onViewportChange.mock.calls[1]?.[0]).toMatchObject({ cursor_frame: 25 });

    fireEvent.pointerUp(rulerLane!, { pointerId: 10 });
    fireEvent.pointerMove(rulerLane!, { clientX: 120, pointerId: 10 });

    expect(onViewportChange).toHaveBeenCalledTimes(2);
  });

  it("zooms the visible window around the mouse frame on alt+wheel", () => {
    const { container, onViewportChange } = renderTimelineEditor();

    const rulerLane = container.querySelector(".timeline-row__lane--ruler") as HTMLDivElement | null;
    expect(rulerLane).not.toBeNull();

    Object.defineProperty(rulerLane, "clientWidth", { configurable: true, value: 240 });
    rulerLane!.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 240,
        height: 28,
        top: 0,
        left: 0,
        bottom: 28,
        right: 240,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.wheel(rulerLane!, { altKey: true, deltaY: -100, clientX: 120 });

    expect(onViewportChange).toHaveBeenCalledTimes(1);
    expect(onViewportChange.mock.calls[0]?.[0]).toMatchObject({
      visible_frame_start: 11,
      visible_frame_end: 87,
    });
  });

  it("shifts the visible window horizontally on shift+wheel", () => {
    const { container, onViewportChange } = renderTimelineEditor();

    const rulerLane = container.querySelector(".timeline-row__lane--ruler") as HTMLDivElement | null;
    expect(rulerLane).not.toBeNull();

    Object.defineProperty(rulerLane, "clientWidth", { configurable: true, value: 240 });
    rulerLane!.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 240,
        height: 28,
        top: 0,
        left: 0,
        bottom: 28,
        right: 240,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.wheel(rulerLane!, { shiftKey: true, deltaY: 120, clientX: 120 });

    expect(onViewportChange).toHaveBeenCalledTimes(1);
    expect(onViewportChange.mock.calls[0]?.[0]).toMatchObject({
      visible_frame_start: 15,
      visible_frame_end: 110,
    });
  });

  it("does not hijack plain wheel scrolling on the detail timeline", () => {
    const { container, onViewportChange } = renderTimelineEditor();

    const rulerLane = container.querySelector(".timeline-row__lane--ruler") as HTMLDivElement | null;
    expect(rulerLane).not.toBeNull();

    fireEvent.wheel(rulerLane!, { deltaY: 120, clientX: 120 });

    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("scrubs the cursor continuously on track lanes without hijacking keyframe drags", () => {
    const { draft, onMoveKeyframe, onSelectionChange, onViewportChange } = renderTimelineEditor();
    const withTrack = addTrackToDraft(draft, "右手首");
    const withEvent = addEventToTrack(withTrack.draft, withTrack.track_id, 12);
    cleanup();

    const viewport = createTimelineViewport(sceneSummary);
    const view = render(
      <TimelineEditor
        canAddTrack
        draft={withEvent.draft}
        onAddKeyframe={vi.fn()}
        onAddTrack={vi.fn()}
        onMoveKeyframe={onMoveKeyframe}
        onRemoveTrack={vi.fn()}
        onSelectionChange={onSelectionChange}
        onTrackSourceBoneChange={vi.fn()}
        onViewportChange={onViewportChange}
        referenceIssues={null}
        scene={sceneSummary}
        selectedModel={sceneSummary.models[0]}
        selection={createEmptySelection()}
        viewport={viewport}
      />,
    );

    const lane = view.container.querySelectorAll(".timeline-row__lane")[1] as HTMLDivElement | undefined;
    expect(lane).toBeDefined();

    Object.defineProperty(lane!, "clientWidth", { configurable: true, value: 240 });
    lane!.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 240,
        height: 40,
        top: 0,
        left: 0,
        bottom: 40,
        right: 240,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.pointerDown(lane!, { clientX: 0, pointerId: 11 });
    fireEvent.pointerMove(lane!, { clientX: 60, pointerId: 11 });

    expect(onViewportChange.mock.calls.at(-1)?.[0]).toMatchObject({ cursor_frame: 25 });
    expect(onSelectionChange.mock.calls.at(-1)?.[0]).toMatchObject({
      track_id: withTrack.track_id,
      event_id: null,
    });

    const keyframe = screen.getByLabelText("Keyframe 12");
    fireEvent.pointerDown(keyframe, { clientX: 110, pointerId: 12 });
    fireEvent.pointerMove(window, { clientX: 150, pointerId: 12 });

    expect(onMoveKeyframe).toHaveBeenCalled();
  });

  it("selects the track when the left meta summary area is clicked", () => {
    const { draft, onSelectionChange } = renderTimelineEditor();
    const withTrack = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    cleanup();

    const view = render(
      <TimelineEditor
        canAddTrack
        draft={withTrack.draft}
        onAddKeyframe={vi.fn()}
        onAddTrack={vi.fn()}
        onMoveKeyframe={vi.fn()}
        onRemoveTrack={vi.fn()}
        onSelectionChange={onSelectionChange}
        onTrackSourceBoneChange={vi.fn()}
        onViewportChange={vi.fn()}
        referenceIssues={null}
        scene={sceneSummary}
        selectedModel={sceneSummary.models[0]}
        selection={createEmptySelection()}
        viewport={createTimelineViewport(sceneSummary)}
      />,
    );

    const meta = view.container.querySelector(".timeline-row__meta-summary") as HTMLDivElement | null;
    expect(meta).not.toBeNull();

    fireEvent.click(meta!);

    expect(onSelectionChange).toHaveBeenCalledWith({
      track_id: withTrack.track_id,
      event_id: null,
    });
  });
});
