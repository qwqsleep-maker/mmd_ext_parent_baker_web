import type {
  ExternalParentBakeRequest,
  ExternalParentEvent,
  ExternalParentTrack,
  ModelInfo,
  SceneSummary,
} from "../../api/types";

export const MIN_VISIBLE_FRAME_COUNT = 24;
export const DEFAULT_VISIBLE_FRAME_COUNT = 96;

export type FrameMode = "blender" | "mmd";

export interface BakerEventDraft extends ExternalParentEvent {
  id: string;
}

export interface BakerTrackDraft extends Omit<ExternalParentTrack, "events"> {
  id: string;
  events: BakerEventDraft[];
}

export interface BakerDraft extends Omit<ExternalParentBakeRequest, "tracks"> {
  frame_mode: FrameMode;
  mmd_import_frame: number;
  mmd_margin: number;
  tracks: BakerTrackDraft[];
}

export interface SelectionState {
  track_id: string | null;
  event_id: string | null;
}

export interface TimelineViewportState {
  cursor_frame: number;
  visible_frame_start: number;
  visible_frame_end: number;
}

export interface DraftReferenceIssues {
  missing_source_model: boolean;
  missing_source_armature: boolean;
  invalid_track_ids: string[];
  invalid_target_root_event_ids: string[];
  invalid_target_bone_event_ids: string[];
}

export function createDraftFromScene(scene: SceneSummary): BakerDraft {
  const model = scene.models[0];
  const sourceActionName = model?.active_action_name ?? "";

  return {
    root_object_name: model?.root_object_name ?? "",
    armature_object_name: model?.armature_object_name ?? "",
    source_action_name: sourceActionName,
    frame_start: scene.frame_start,
    frame_end: scene.frame_end,
    frame_mode: "blender",
    mmd_import_frame: scene.frame_start,
    mmd_margin: 0,
    output_action_name: buildDefaultOutputActionName(sourceActionName),
    tracks: [],
  };
}

export function createTimelineViewport(scene: SceneSummary): TimelineViewportState {
  const visibleFrameCount = Math.min(DEFAULT_VISIBLE_FRAME_COUNT, getFrameCount(scene.frame_start, scene.frame_end));
  return {
    cursor_frame: scene.frame_start,
    visible_frame_start: scene.frame_start,
    visible_frame_end: scene.frame_start + visibleFrameCount - 1,
  };
}

export function resizeTimelineViewport(
  viewport: TimelineViewportState,
  frameStart: number,
  frameEnd: number,
): TimelineViewportState {
  const visibleFrameCount = Math.min(getViewportFrameCount(viewport), getFrameCount(frameStart, frameEnd));
  const nextStart = clampWindowStart(
    frameStart,
    frameEnd,
    visibleFrameCount,
    viewport.visible_frame_start,
  );
  return {
    ...viewport,
    cursor_frame: clampFrame(viewport.cursor_frame, frameStart, frameEnd),
    visible_frame_start: nextStart,
    visible_frame_end: buildWindowEnd(nextStart, visibleFrameCount, frameEnd),
  };
}

export function centerViewportOnFrame(
  viewport: TimelineViewportState,
  frameStart: number,
  frameEnd: number,
  focusFrame: number,
): TimelineViewportState {
  const clampedFocusFrame = clampFrame(focusFrame, frameStart, frameEnd);
  const visibleFrameCount = getViewportFrameCount(viewport);
  const halfWindow = Math.floor((visibleFrameCount - 1) / 2);
  const nextStart = clampWindowStart(frameStart, frameEnd, visibleFrameCount, clampedFocusFrame - halfWindow);

  return {
    ...viewport,
    cursor_frame: clampedFocusFrame,
    visible_frame_start: nextStart,
    visible_frame_end: buildWindowEnd(nextStart, visibleFrameCount, frameEnd),
  };
}

export function shiftViewportWindow(
  viewport: TimelineViewportState,
  frameStart: number,
  frameEnd: number,
  deltaFrames: number,
): TimelineViewportState {
  const visibleFrameCount = getViewportFrameCount(viewport);
  const nextStart = clampWindowStart(
    frameStart,
    frameEnd,
    visibleFrameCount,
    viewport.visible_frame_start + Math.round(deltaFrames),
  );

  return {
    ...viewport,
    visible_frame_start: nextStart,
    visible_frame_end: buildWindowEnd(nextStart, visibleFrameCount, frameEnd),
  };
}

export function resizeViewportWindowAroundFrame(
  viewport: TimelineViewportState,
  frameStart: number,
  frameEnd: number,
  requestedVisibleFrameCount: number,
  anchorFrame: number,
): TimelineViewportState {
  const totalFrameCount = getFrameCount(frameStart, frameEnd);
  const nextVisibleFrameCount = clampVisibleFrameCount(requestedVisibleFrameCount, totalFrameCount);
  const clampedAnchorFrame = clampFrame(anchorFrame, frameStart, frameEnd);
  const currentVisibleFrameCount = getViewportFrameCount(viewport);
  const anchorOffsetRatio =
    currentVisibleFrameCount <= 1
      ? 0
      : ((clampedAnchorFrame - viewport.visible_frame_start) + 0.5) / currentVisibleFrameCount;
  const nextStart = clampWindowStart(
    frameStart,
    frameEnd,
    nextVisibleFrameCount,
    clampedAnchorFrame - Math.round(anchorOffsetRatio * (nextVisibleFrameCount - 1)),
  );

  return {
    ...viewport,
    visible_frame_start: nextStart,
    visible_frame_end: buildWindowEnd(nextStart, nextVisibleFrameCount, frameEnd),
  };
}

export function resizeViewportWindowLeft(
  viewport: TimelineViewportState,
  frameStart: number,
  frameEnd: number,
  requestedStart: number,
): TimelineViewportState {
  const totalFrameCount = getFrameCount(frameStart, frameEnd);
  const maxWindowSize = totalFrameCount;
  const nextEnd = clampFrame(viewport.visible_frame_end, frameStart, frameEnd);
  const requestedWindowSize = nextEnd - Math.round(requestedStart) + 1;
  const clampedWindowSize = clampVisibleFrameCount(requestedWindowSize, maxWindowSize);
  const nextStart = Math.max(frameStart, nextEnd - clampedWindowSize + 1);

  return {
    ...viewport,
    visible_frame_start: nextStart,
    visible_frame_end: nextEnd,
  };
}

export function resizeViewportWindowRight(
  viewport: TimelineViewportState,
  frameStart: number,
  frameEnd: number,
  requestedEnd: number,
): TimelineViewportState {
  const totalFrameCount = getFrameCount(frameStart, frameEnd);
  const maxWindowSize = totalFrameCount;
  const nextStart = clampFrame(viewport.visible_frame_start, frameStart, frameEnd);
  const requestedWindowSize = Math.round(requestedEnd) - nextStart + 1;
  const clampedWindowSize = clampVisibleFrameCount(requestedWindowSize, maxWindowSize);
  const nextEnd = Math.min(frameEnd, nextStart + clampedWindowSize - 1);

  return {
    ...viewport,
    visible_frame_start: nextStart,
    visible_frame_end: nextEnd,
  };
}

export function getViewportFrameCount(viewport: TimelineViewportState) {
  return getFrameCount(viewport.visible_frame_start, viewport.visible_frame_end);
}

export function createEmptySelection(): SelectionState {
  return {
    track_id: null,
    event_id: null,
  };
}

export function reconcileDraftWithScene(scene: SceneSummary, draft: BakerDraft): BakerDraft {
  const model = findModelByRoot(scene, draft.root_object_name);
  if (!model) {
    return {
      ...draft,
      frame_start: scene.frame_start,
      frame_end: scene.frame_end,
    };
  }

  return {
    ...draft,
    armature_object_name: model.armature_object_name,
    frame_start: scene.frame_start,
    frame_end: scene.frame_end,
  };
}

export function applyModelSelection(
  scene: SceneSummary,
  draft: BakerDraft,
  rootObjectName: string,
): BakerDraft {
  const model = findModelByRoot(scene, rootObjectName);
  if (!model) {
    return draft;
  }

  const sourceActionName = model.active_action_name ?? "";

  return {
    ...draft,
    root_object_name: model.root_object_name,
    armature_object_name: model.armature_object_name,
    source_action_name: sourceActionName,
    frame_start: scene.frame_start,
    frame_end: scene.frame_end,
    frame_mode: draft.frame_mode,
    mmd_import_frame: draft.mmd_import_frame,
    mmd_margin: draft.mmd_margin,
    output_action_name: buildDefaultOutputActionName(sourceActionName),
    tracks: [],
  };
}

export function getFrameOffset(draft: Pick<BakerDraft, "frame_mode" | "mmd_import_frame" | "mmd_margin">) {
  return draft.frame_mode === "mmd" ? normalizeInteger(draft.mmd_import_frame) + normalizeInteger(draft.mmd_margin) : 0;
}

export function toDisplayFrame(
  draft: Pick<BakerDraft, "frame_mode" | "mmd_import_frame" | "mmd_margin">,
  blenderFrame: number,
) {
  return normalizeInteger(blenderFrame) - getFrameOffset(draft);
}

export function toBlenderFrame(
  draft: Pick<BakerDraft, "frame_mode" | "mmd_import_frame" | "mmd_margin">,
  displayFrame: number,
) {
  return normalizeInteger(displayFrame) + getFrameOffset(draft);
}

export function toDisplayDraft(draft: BakerDraft): BakerDraft {
  if (draft.frame_mode === "blender") {
    return draft;
  }

  return {
    ...draft,
    frame_start: toDisplayFrame(draft, draft.frame_start),
    frame_end: toDisplayFrame(draft, draft.frame_end),
    tracks: draft.tracks.map((track) => ({
      ...track,
      events: track.events.map((event) => ({
        ...event,
        frame: toDisplayFrame(draft, event.frame),
      })),
    })),
  };
}

export function toDisplayViewport(draft: BakerDraft, viewport: TimelineViewportState): TimelineViewportState {
  if (draft.frame_mode === "blender") {
    return viewport;
  }

  return {
    cursor_frame: toDisplayFrame(draft, viewport.cursor_frame),
    visible_frame_start: toDisplayFrame(draft, viewport.visible_frame_start),
    visible_frame_end: toDisplayFrame(draft, viewport.visible_frame_end),
  };
}

export function toBlenderViewport(draft: BakerDraft, viewport: TimelineViewportState): TimelineViewportState {
  if (draft.frame_mode === "blender") {
    return viewport;
  }

  return {
    cursor_frame: toBlenderFrame(draft, viewport.cursor_frame),
    visible_frame_start: toBlenderFrame(draft, viewport.visible_frame_start),
    visible_frame_end: toBlenderFrame(draft, viewport.visible_frame_end),
  };
}

export function createEmptyTrack(sourceBoneNameJ = ""): BakerTrackDraft {
  return {
    id: createDraftId("track"),
    source_bone_name_j: sourceBoneNameJ,
    events: [],
  };
}

export function createEmptyEvent(frame: number): BakerEventDraft {
  return {
    id: createDraftId("event"),
    frame,
    enabled: true,
    target_root_object_name: null,
    target_bone_name_j: null,
  };
}

export function addTrackToDraft(draft: BakerDraft, sourceBoneNameJ = "") {
  const nextTrack = createEmptyTrack(sourceBoneNameJ);
  return {
    draft: {
      ...draft,
      tracks: [...draft.tracks, nextTrack],
    },
    track_id: nextTrack.id,
  };
}

export function removeTrackFromDraft(draft: BakerDraft, selection: SelectionState, trackId: string) {
  return {
    draft: {
      ...draft,
      tracks: draft.tracks.filter((track) => track.id !== trackId),
    },
    selection: selection.track_id === trackId ? createEmptySelection() : selection,
  };
}

export function updateTrackInDraft(draft: BakerDraft, trackId: string, patch: Partial<BakerTrackDraft>): BakerDraft {
  return {
    ...draft,
    tracks: draft.tracks.map((track) =>
      track.id === trackId
        ? {
            ...track,
            ...patch,
            events: sortEvents(patch.events ?? track.events),
          }
        : track,
    ),
  };
}

export function addEventToTrack(draft: BakerDraft, trackId: string, frame: number) {
  const nextFrame = clampFrame(frame, draft.frame_start, draft.frame_end);
  const track = draft.tracks.find((item) => item.id === trackId);
  const existingEvent = track?.events.find((event) => event.frame === nextFrame) ?? null;

  if (existingEvent) {
    return {
      draft,
      event_id: existingEvent.id,
      created: false,
    };
  }

  const nextEvent = createEmptyEvent(nextFrame);
  return {
    draft: {
      ...draft,
      tracks: draft.tracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              events: sortEvents([...track.events, nextEvent]),
            }
          : track,
      ),
    },
    event_id: nextEvent.id,
    created: true,
  };
}

export function updateEventInTrack(
  draft: BakerDraft,
  trackId: string,
  eventId: string,
  patch: Partial<BakerEventDraft>,
): { draft: BakerDraft; selected_event_id: string } {
  let selectedEventId = eventId;

  return {
    draft: {
      ...draft,
      tracks: draft.tracks.map((track) => {
        if (track.id !== trackId) {
          return track;
        }

        const nextFrame = patch.frame !== undefined ? clampFrame(patch.frame, draft.frame_start, draft.frame_end) : null;
        const conflictingEvent =
          nextFrame !== null
            ? track.events.find((event) => event.id !== eventId && event.frame === nextFrame) ?? null
            : null;

        if (conflictingEvent) {
          selectedEventId = conflictingEvent.id;
          return track;
        }

        const nextEvents = track.events.map((event) => {
          if (event.id !== eventId) {
            return event;
          }

          const nextEvent: BakerEventDraft = {
            ...event,
            ...patch,
          };

          if (nextFrame !== null) {
            nextEvent.frame = nextFrame;
          }
          if (patch.enabled === false) {
            nextEvent.target_root_object_name = patch.target_root_object_name ?? event.target_root_object_name;
            nextEvent.target_bone_name_j = patch.target_bone_name_j ?? event.target_bone_name_j;
          }

          return nextEvent;
        });

        return {
          ...track,
          events: sortEvents(nextEvents),
        };
      }),
    },
    selected_event_id: selectedEventId,
  };
}

export function removeEventFromTrack(
  draft: BakerDraft,
  selection: SelectionState,
  trackId: string,
  eventId: string,
) {
  return {
    draft: {
      ...draft,
      tracks: draft.tracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              events: track.events.filter((event) => event.id !== eventId),
            }
          : track,
      ),
    },
    selection: selection.event_id === eventId ? createEmptySelection() : selection,
  };
}

export function validateDraft(draft: BakerDraft, scene?: SceneSummary): string[] {
  const errors: string[] = [];

  if (!draft.root_object_name) {
    errors.push("Select a source model");
  }
  if (!draft.armature_object_name) {
    errors.push("Selected source model does not have an armature");
  }
  if (!draft.source_action_name.trim()) {
    errors.push("source_action_name is required");
  }
  if (draft.frame_end < draft.frame_start) {
    errors.push("frame_end must be greater than or equal to frame_start");
  }

  const seenSourceBones = new Set<string>();
  for (const track of draft.tracks) {
    if (!track.source_bone_name_j.trim()) {
      errors.push("Each track requires a source bone");
      continue;
    }
    if (seenSourceBones.has(track.source_bone_name_j)) {
      errors.push(`Duplicate track source bone: ${track.source_bone_name_j}`);
    }
    seenSourceBones.add(track.source_bone_name_j);

    if (track.events.length === 0) {
      errors.push(`Track "${track.source_bone_name_j}" must contain at least one event`);
      continue;
    }

    const seenFrames = new Set<number>();
    for (const event of track.events) {
      if (seenFrames.has(event.frame)) {
        errors.push(`Duplicate event frame on track "${track.source_bone_name_j}": ${toDisplayFrame(draft, event.frame)}`);
      }
      seenFrames.add(event.frame);

      if (event.enabled && (!event.target_root_object_name || !event.target_bone_name_j)) {
        errors.push("Enabled events require target root and target bone");
      }
    }
  }

  if (scene) {
    const issues = inspectDraftReferences(scene, draft);
    if (issues.missing_source_model) {
      errors.push(`Selected source model is missing from the current scene: ${draft.root_object_name}`);
    }
    if (issues.missing_source_armature) {
      errors.push(`Selected armature is missing from the current scene: ${draft.armature_object_name}`);
    }

    for (const trackId of issues.invalid_track_ids) {
      const track = draft.tracks.find((item) => item.id === trackId);
      if (track) {
        errors.push(`Track source bone is missing from the source model: ${track.source_bone_name_j}`);
      }
    }

    for (const eventId of issues.invalid_target_root_event_ids) {
      const event = findEventById(draft, eventId);
      if (event?.event.target_root_object_name) {
        errors.push(
          `Event at frame ${toDisplayFrame(draft, event.event.frame)} references a missing target root: ${event.event.target_root_object_name}`,
        );
      }
    }

    for (const eventId of issues.invalid_target_bone_event_ids) {
      const event = findEventById(draft, eventId);
      if (event?.event.target_bone_name_j) {
        errors.push(
          `Event at frame ${toDisplayFrame(draft, event.event.frame)} references a missing target bone: ${event.event.target_bone_name_j}`,
        );
      }
    }
  }

  return errors;
}

export function inspectDraftReferences(scene: SceneSummary, draft: BakerDraft): DraftReferenceIssues {
  const hasSourceModelSelection = draft.root_object_name.trim().length > 0;
  const sourceModel = hasSourceModelSelection ? findModelByRoot(scene, draft.root_object_name) : undefined;
  const invalidTrackIds: string[] = [];
  const invalidTargetRootEventIds: string[] = [];
  const invalidTargetBoneEventIds: string[] = [];

  for (const track of draft.tracks) {
    if (sourceModel && !sourceModel.bones.some((bone) => bone.bone_name_j === track.source_bone_name_j)) {
      invalidTrackIds.push(track.id);
    }

    for (const event of track.events) {
      if (!event.enabled) {
        continue;
      }

      const targetModel = event.target_root_object_name
        ? findModelByRoot(scene, event.target_root_object_name)
        : undefined;
      if (event.target_root_object_name && !targetModel) {
        invalidTargetRootEventIds.push(event.id);
        continue;
      }
      if (
        targetModel &&
        event.target_bone_name_j &&
        !targetModel.bones.some((bone) => bone.bone_name_j === event.target_bone_name_j)
      ) {
        invalidTargetBoneEventIds.push(event.id);
      }
    }
  }

  return {
    missing_source_model: hasSourceModelSelection && sourceModel === undefined,
    missing_source_armature:
      hasSourceModelSelection &&
      sourceModel !== undefined &&
      sourceModel.armature_object_name !== draft.armature_object_name,
    invalid_track_ids: invalidTrackIds,
    invalid_target_root_event_ids: invalidTargetRootEventIds,
    invalid_target_bone_event_ids: invalidTargetBoneEventIds,
  };
}

export function buildBakeRequest(draft: BakerDraft): ExternalParentBakeRequest {
  return {
    root_object_name: draft.root_object_name,
    armature_object_name: draft.armature_object_name,
    source_action_name: draft.source_action_name.trim(),
    frame_start: draft.frame_start,
    frame_end: draft.frame_end,
    output_action_name:
      draft.output_action_name.trim() || buildDefaultOutputActionName(draft.source_action_name),
    tracks: draft.tracks.map((track) => ({
      source_bone_name_j: track.source_bone_name_j,
      events: sortEvents(track.events).map((event) => ({
        frame: event.frame,
        enabled: event.enabled,
        target_root_object_name: event.enabled ? event.target_root_object_name : null,
        target_bone_name_j: event.enabled ? event.target_bone_name_j : null,
      })),
    })),
  };
}

export function getAvailableSourceBones(
  scene: SceneSummary | null,
  draft: BakerDraft,
  currentSourceBoneNameJ = "",
) {
  const model = scene ? findModelByRoot(scene, draft.root_object_name) : undefined;
  if (!model) {
    return [];
  }

  const usedSourceBones = new Set(
    draft.tracks
      .map((track) => track.source_bone_name_j)
      .filter((boneName) => boneName && boneName !== currentSourceBoneNameJ),
  );

  return model.bones.filter(
    (bone) => bone.bone_name_j === currentSourceBoneNameJ || !usedSourceBones.has(bone.bone_name_j),
  );
}

export function findModelByRoot(scene: SceneSummary, rootObjectName: string): ModelInfo | undefined {
  return scene.models.find((model) => model.root_object_name === rootObjectName);
}

export function buildDefaultOutputActionName(sourceActionName: string) {
  const trimmed = sourceActionName.trim();
  return trimmed ? `${trimmed}__extparent_baked` : "";
}

function findEventById(draft: BakerDraft, eventId: string) {
  for (const track of draft.tracks) {
    const event = track.events.find((item) => item.id === eventId);
    if (event) {
      return { track, event };
    }
  }
  return null;
}

function sortEvents(events: BakerEventDraft[]) {
  return [...events].sort((left, right) => left.frame - right.frame);
}

function clampVisibleFrameCount(requestedCount: number, maxVisibleFrameCount: number) {
  const minimumVisibleFrameCount = Math.min(MIN_VISIBLE_FRAME_COUNT, maxVisibleFrameCount);
  return Math.max(minimumVisibleFrameCount, Math.min(maxVisibleFrameCount, Math.round(requestedCount)));
}

function getFrameCount(frameStart: number, frameEnd: number) {
  return Math.max(1, frameEnd - frameStart + 1);
}

function buildWindowEnd(windowStart: number, visibleFrameCount: number, frameEnd: number) {
  return Math.min(frameEnd, windowStart + visibleFrameCount - 1);
}

function clampWindowStart(frameStart: number, frameEnd: number, visibleFrameCount: number, requestedStart: number) {
  const maxWindowStart = Math.max(frameStart, frameEnd - visibleFrameCount + 1);
  return Math.max(frameStart, Math.min(maxWindowStart, Math.round(requestedStart)));
}

function clampFrame(frame: number, frameStart: number, frameEnd: number) {
  return Math.max(frameStart, Math.min(frameEnd, Math.round(frame)));
}

function normalizeInteger(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

let nextDraftId = 1;

function createDraftId(prefix: string) {
  const identifier = nextDraftId;
  nextDraftId += 1;
  return `${prefix}-${identifier}`;
}
