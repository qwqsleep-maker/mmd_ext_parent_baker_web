import { describe, expect, it } from "vitest";

import {
  addEventToTrack,
  addTrackToDraft,
  centerViewportOnFrame,
  buildBakeRequest,
  createDraftFromScene,
  createEmptySelection,
  createTimelineViewport,
  getFrameOffset,
  inspectDraftReferences,
  reconcileDraftWithScene,
  resizeViewportWindowAroundFrame,
  resizeViewportWindowLeft,
  resizeViewportWindowRight,
  resizeTimelineViewport,
  removeEventFromTrack,
  removeTrackFromDraft,
  shiftViewportWindow,
  toBlenderFrame,
  toDisplayDraft,
  toDisplayFrame,
  toDisplayViewport,
  updateEventInTrack,
  validateDraft,
  type BakerDraft,
  type SelectionState,
} from "./state";

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
        {
          bone_name: "arm.R",
          bone_name_j: "\u53f3\u8155",
          bone_id: 2,
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
} as const;

describe("createDraftFromScene", () => {
  it("defaults to the first model active action and scene frame range", () => {
    const draft = createDraftFromScene(sceneSummary);
    const viewport = createTimelineViewport(sceneSummary);

    expect(draft.root_object_name).toBe("MikuRoot");
    expect(draft.armature_object_name).toBe("MikuArmature");
    expect(draft.source_action_name).toBe("walk_bone");
    expect(draft.output_action_name).toBe("walk_bone__extparent_baked");
    expect(draft.frame_start).toBe(1);
    expect(draft.frame_end).toBe(180);
    expect(draft.frame_mode).toBe("blender");
    expect(draft.mmd_import_frame).toBe(1);
    expect(draft.mmd_margin).toBe(0);
    expect(viewport.cursor_frame).toBe(1);
    expect(viewport.visible_frame_start).toBe(1);
    expect(viewport.visible_frame_end).toBe(96);
  });
});

describe("frame mode conversion helpers", () => {
  it("uses zero offset in Blender frame mode", () => {
    const draft = createDraftFromScene(sceneSummary);

    expect(getFrameOffset(draft)).toBe(0);
    expect(toDisplayFrame(draft, 24)).toBe(24);
    expect(toBlenderFrame(draft, 24)).toBe(24);
  });

  it("converts between MMD display frames and internal Blender frames", () => {
    const draft: BakerDraft = {
      ...createDraftFromScene(sceneSummary),
      frame_mode: "mmd",
      mmd_import_frame: 10,
      mmd_margin: 2,
    };

    expect(getFrameOffset(draft)).toBe(12);
    expect(toDisplayFrame(draft, 36)).toBe(24);
    expect(toBlenderFrame(draft, 24)).toBe(36);
  });

  it("builds display copies without changing internal Blender frames", () => {
    let draft: BakerDraft = {
      ...createDraftFromScene(sceneSummary),
      frame_mode: "mmd",
      mmd_import_frame: 10,
      mmd_margin: 2,
    };
    const trackResult = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    draft = addEventToTrack(trackResult.draft, trackResult.track_id, 36).draft;

    const displayDraft = toDisplayDraft(draft);
    const displayViewport = toDisplayViewport(draft, {
      cursor_frame: 36,
      visible_frame_start: 12,
      visible_frame_end: 48,
    });

    expect(draft.frame_start).toBe(1);
    expect(draft.tracks[0].events[0].frame).toBe(36);
    expect(displayDraft.frame_start).toBe(-11);
    expect(displayDraft.frame_end).toBe(168);
    expect(displayDraft.tracks[0].events[0].frame).toBe(24);
    expect(displayViewport).toEqual({
      cursor_frame: 24,
      visible_frame_start: 0,
      visible_frame_end: 36,
    });
  });
});

describe("timeline viewport helpers", () => {
  it("clamps the visible window to the current scene range without changing its size when possible", () => {
    const viewport = {
      ...createTimelineViewport(sceneSummary),
      cursor_frame: 170,
      visible_frame_start: 90,
      visible_frame_end: 180,
    };
    const resized = resizeTimelineViewport(viewport, 1, 120);

    expect(resized.cursor_frame).toBe(120);
    expect(resized.visible_frame_start).toBe(30);
    expect(resized.visible_frame_end).toBe(120);
  });

  it("centers the viewport on a requested frame without leaving the scene range", () => {
    const viewport = createTimelineViewport(sceneSummary);
    const centered = centerViewportOnFrame(viewport, 1, 180, 150);

    expect(centered.cursor_frame).toBe(150);
    expect(centered.visible_frame_start).toBe(85);
    expect(centered.visible_frame_end).toBe(180);
  });

  it("shifts the viewport window by frame delta and clamps at the end of the scene", () => {
    const viewport = createTimelineViewport(sceneSummary);
    const shifted = shiftViewportWindow(viewport, 1, 180, 120);

    expect(shifted.visible_frame_start).toBe(85);
    expect(shifted.visible_frame_end).toBe(180);
  });

  it("resizes the left edge while keeping the right edge fixed", () => {
    const viewport = {
      ...createTimelineViewport(sceneSummary),
      visible_frame_start: 25,
      visible_frame_end: 96,
    };

    const resized = resizeViewportWindowLeft(viewport, 1, 180, 40);

    expect(resized.visible_frame_start).toBe(40);
    expect(resized.visible_frame_end).toBe(96);
  });

  it("clamps left-edge resizing to the minimum visible frame count", () => {
    const viewport = {
      ...createTimelineViewport(sceneSummary),
      visible_frame_start: 25,
      visible_frame_end: 96,
    };

    const resized = resizeViewportWindowLeft(viewport, 1, 180, 90);

    expect(resized.visible_frame_start).toBe(73);
    expect(resized.visible_frame_end).toBe(96);
  });

  it("resizes the right edge while keeping the left edge fixed", () => {
    const viewport = {
      ...createTimelineViewport(sceneSummary),
      visible_frame_start: 25,
      visible_frame_end: 96,
    };

    const resized = resizeViewportWindowRight(viewport, 1, 180, 140);

    expect(resized.visible_frame_start).toBe(25);
    expect(resized.visible_frame_end).toBe(140);
  });

  it("clamps right-edge resizing to the full frame range", () => {
    const viewport = {
      ...createTimelineViewport(sceneSummary),
      visible_frame_start: 25,
      visible_frame_end: 96,
    };

    const resized = resizeViewportWindowRight(viewport, 1, 180, 260);

    expect(resized.visible_frame_start).toBe(25);
    expect(resized.visible_frame_end).toBe(180);
  });

  it("resizes the window around an anchor frame while keeping its relative position", () => {
    const viewport = {
      ...createTimelineViewport(sceneSummary),
      visible_frame_start: 1,
      visible_frame_end: 96,
    };

    const resized = resizeViewportWindowAroundFrame(viewport, 1, 180, 48, 49);

    expect(resized.visible_frame_start).toBe(25);
    expect(resized.visible_frame_end).toBe(72);
  });

  it("clamps anchor-based resizing to the minimum visible frame count", () => {
    const viewport = {
      ...createTimelineViewport(sceneSummary),
      visible_frame_start: 1,
      visible_frame_end: 96,
    };

    const resized = resizeViewportWindowAroundFrame(viewport, 1, 180, 8, 49);

    expect(resized.visible_frame_start).toBe(37);
    expect(resized.visible_frame_end).toBe(60);
  });

  it("clamps anchor-based resizing to the full frame range", () => {
    const viewport = {
      ...createTimelineViewport(sceneSummary),
      visible_frame_start: 25,
      visible_frame_end: 96,
    };

    const resized = resizeViewportWindowAroundFrame(viewport, 1, 180, 400, 60);

    expect(resized.visible_frame_start).toBe(1);
    expect(resized.visible_frame_end).toBe(180);
  });
});

describe("draft editing helpers", () => {
  it("adds tracks and prevents duplicate source-bone submissions through validation", () => {
    let draft = createDraftFromScene(sceneSummary);
    ({ draft } = addTrackToDraft(draft, "\u53f3\u624b\u9996"));
    ({ draft } = addTrackToDraft(draft, "\u53f3\u624b\u9996"));

    expect(validateDraft(draft, sceneSummary)).toContain(
      "Duplicate track source bone: \u53f3\u624b\u9996",
    );
  });

  it("sorts events by frame when they are added or updated", () => {
    let draft = createDraftFromScene(sceneSummary);
    const trackResult = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    draft = trackResult.draft;

    const laterEvent = addEventToTrack(draft, trackResult.track_id, 30);
    draft = laterEvent.draft;

    const earlierEvent = addEventToTrack(draft, trackResult.track_id, 10);
    draft = earlierEvent.draft;

    const updateResult = updateEventInTrack(draft, trackResult.track_id, laterEvent.event_id!, {
      frame: 5,
      target_root_object_name: "PropRoot",
      target_bone_name_j: "\u89aa",
    });
    draft = updateResult.draft;

    expect(draft.tracks[0].events.map((event) => event.frame)).toEqual([5, 10]);
    expect(updateResult.selected_event_id).toBe(laterEvent.event_id);
  });

  it("reuses an existing keyframe when adding at an occupied frame", () => {
    let draft = createDraftFromScene(sceneSummary);
    const trackResult = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    draft = trackResult.draft;

    const firstEvent = addEventToTrack(draft, trackResult.track_id, 12);
    draft = firstEvent.draft;

    const duplicateEvent = addEventToTrack(draft, trackResult.track_id, 12);

    expect(duplicateEvent.created).toBe(false);
    expect(duplicateEvent.event_id).toBe(firstEvent.event_id);
    expect(duplicateEvent.draft.tracks[0].events).toHaveLength(1);
  });

  it("keeps the original keyframe in place and selects the existing one when moving to an occupied frame", () => {
    let draft = createDraftFromScene(sceneSummary);
    const trackResult = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    draft = trackResult.draft;

    const firstEvent = addEventToTrack(draft, trackResult.track_id, 12);
    draft = firstEvent.draft;
    const secondEvent = addEventToTrack(draft, trackResult.track_id, 24);
    draft = secondEvent.draft;

    const updateResult = updateEventInTrack(draft, trackResult.track_id, secondEvent.event_id!, {
      frame: 12,
    });

    expect(updateResult.selected_event_id).toBe(firstEvent.event_id);
    expect(updateResult.draft.tracks[0].events.map((event) => event.frame)).toEqual([12, 24]);
  });

  it("clears the selected event when the event or track is removed", () => {
    let draft = createDraftFromScene(sceneSummary);
    const trackResult = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    draft = trackResult.draft;

    const eventResult = addEventToTrack(draft, trackResult.track_id, 20);
    draft = eventResult.draft;

    let selection: SelectionState = {
      track_id: trackResult.track_id,
      event_id: eventResult.event_id,
    };

    ({ draft, selection } = removeEventFromTrack(draft, selection, trackResult.track_id, eventResult.event_id));
    expect(selection).toEqual(createEmptySelection());

    const nextEvent = addEventToTrack(draft, trackResult.track_id, 24);
    draft = nextEvent.draft;
    selection = {
      track_id: trackResult.track_id,
      event_id: nextEvent.event_id,
    };

    ({ draft, selection } = removeTrackFromDraft(draft, selection, trackResult.track_id));
    expect(selection).toEqual(createEmptySelection());
    expect(draft.tracks).toHaveLength(0);
  });
});

describe("scene reconciliation and validation", () => {
  it("preserves draft data when refreshing into a scene missing referenced models", () => {
    let draft = createDraftFromScene(sceneSummary);
    const trackResult = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    draft = trackResult.draft;
    const eventResult = addEventToTrack(draft, trackResult.track_id, 12);
    draft = updateEventInTrack(eventResult.draft, trackResult.track_id, eventResult.event_id!, {
      target_root_object_name: "PropRoot",
      target_bone_name_j: "\u89aa",
    }).draft;

    const refreshed = reconcileDraftWithScene(
      {
        ...sceneSummary,
        models: [sceneSummary.models[0]],
      },
      draft,
    );

    expect(refreshed.root_object_name).toBe("MikuRoot");
    expect(refreshed.tracks).toHaveLength(1);
    expect(refreshed.tracks[0].events[0].target_root_object_name).toBe("PropRoot");
  });

  it("reports invalid scene references without discarding the browser draft", () => {
    let draft = createDraftFromScene(sceneSummary);
    const trackResult = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    draft = trackResult.draft;
    const eventResult = addEventToTrack(draft, trackResult.track_id, 12);
    draft = updateEventInTrack(eventResult.draft, trackResult.track_id, eventResult.event_id!, {
      target_root_object_name: "MissingRoot",
      target_bone_name_j: "\u89aa",
    }).draft;

    const issues = inspectDraftReferences(
      {
        ...sceneSummary,
        models: [sceneSummary.models[0]],
      },
      draft,
    );

    expect(issues.invalid_target_root_event_ids).toEqual([eventResult.event_id]);
    expect(validateDraft(draft, {
      ...sceneSummary,
      models: [sceneSummary.models[0]],
    })).toContain('Event at frame 12 references a missing target root: MissingRoot');
  });

  it("reports event frame numbers in the current display frame mode", () => {
    let draft: BakerDraft = {
      ...createDraftFromScene(sceneSummary),
      frame_mode: "mmd",
      mmd_import_frame: 10,
      mmd_margin: 2,
    };
    const trackResult = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    draft = trackResult.draft;
    const eventResult = addEventToTrack(draft, trackResult.track_id, 36);
    draft = updateEventInTrack(eventResult.draft, trackResult.track_id, eventResult.event_id!, {
      target_root_object_name: "MissingRoot",
      target_bone_name_j: "\u89aa",
    }).draft;

    expect(validateDraft(draft, {
      ...sceneSummary,
      models: [sceneSummary.models[0]],
    })).toContain('Event at frame 24 references a missing target root: MissingRoot');
  });
});

describe("buildBakeRequest", () => {
  it("strips local ids, sorts events, and preserves disabled events without targets", () => {
    let draft: BakerDraft = createDraftFromScene(sceneSummary);
    const trackResult = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    draft = trackResult.draft;

    const disabledEvent = addEventToTrack(draft, trackResult.track_id, 20);
    draft = updateEventInTrack(disabledEvent.draft, trackResult.track_id, disabledEvent.event_id!, {
      enabled: false,
      target_root_object_name: "ignored",
      target_bone_name_j: "ignored",
    }).draft;

    const enabledEvent = addEventToTrack(draft, trackResult.track_id, 10);
    draft = updateEventInTrack(enabledEvent.draft, trackResult.track_id, enabledEvent.event_id!, {
      target_root_object_name: "PropRoot",
      target_bone_name_j: "\u89aa",
    }).draft;

    const request = buildBakeRequest(draft);

    expect(request.tracks[0]).toEqual({
      source_bone_name_j: "\u53f3\u624b\u9996",
      events: [
        {
          frame: 10,
          enabled: true,
          target_root_object_name: "PropRoot",
          target_bone_name_j: "\u89aa",
        },
        {
          frame: 20,
          enabled: false,
          target_root_object_name: null,
          target_bone_name_j: null,
        },
      ],
    });
  });

  it("flags duplicate frames within the same track during validation", () => {
    let draft: BakerDraft = createDraftFromScene(sceneSummary);
    const trackResult = addTrackToDraft(draft, "\u53f3\u624b\u9996");
    draft = trackResult.draft;
    const firstEvent = addEventToTrack(draft, trackResult.track_id, 20);
    draft = firstEvent.draft;

    draft = {
      ...draft,
      tracks: draft.tracks.map((track) =>
        track.id === trackResult.track_id
          ? {
              ...track,
              events: [
                ...track.events,
                {
                  ...track.events[0],
                  id: "event-duplicate",
                },
              ],
            }
          : track,
      ),
    };

    expect(validateDraft(draft, sceneSummary)).toContain('Duplicate event frame on track "\u53f3\u624b\u9996": 20');
  });
});
