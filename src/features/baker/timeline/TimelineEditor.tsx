import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import type { ModelInfo, SceneSummary } from "../../../api/types";
import {
  centerViewportOnFrame,
  getViewportFrameCount,
  resizeViewportWindowAroundFrame,
  resizeViewportWindowLeft,
  resizeViewportWindowRight,
  shiftViewportWindow,
  type BakerDraft,
  type DraftReferenceIssues,
  type SelectionState,
  type TimelineViewportState,
} from "../state";
import {
  buildTimelineTicks,
  frameToOffset,
  getDetailPixelsPerFrame,
  frameToOverviewOffset,
  getOverviewPixelsPerFrame,
  getOverviewWindowPercentages,
  offsetToFrame,
  overviewOffsetToFrame,
} from "./layout";

const TIMELINE_META_WIDTH = 224;
const DEFAULT_DETAIL_VIEWPORT_WIDTH = 960;
const TIMELINE_WHEEL_ZOOM_RATIO = 0.2;
const TIMELINE_WHEEL_PAN_RATIO = 0.15;

interface TimelineEditorProps {
  scene: SceneSummary | null;
  selectedModel: ModelInfo | null;
  draft: BakerDraft;
  selection: SelectionState;
  viewport: TimelineViewportState;
  referenceIssues: DraftReferenceIssues | null;
  canAddTrack: boolean;
  onSelectionChange: (selection: SelectionState) => void;
  onViewportChange: (viewport: TimelineViewportState) => void;
  onAddTrack: () => void;
  onRemoveTrack?: (trackId: string) => void;
  onTrackSourceBoneChange?: (trackId: string, sourceBoneNameJ: string) => void;
  onAddKeyframe?: (trackId: string) => void;
  onMoveKeyframe: (trackId: string, eventId: string, frame: number) => void;
}

interface DragState {
  track_id: string;
  event_id: string;
  start_frame: number;
  start_client_x: number;
}

interface OverviewDragState {
  mode: "move" | "resize-left" | "resize-right";
  pointer_id: number;
  start_client_x: number;
  start_visible_frame_start: number;
  start_visible_frame_end: number;
}

interface CursorScrubState {
  pointer_id: number;
}

export function TimelineEditor({
  scene: _scene,
  selectedModel: _selectedModel,
  draft,
  selection,
  viewport,
  referenceIssues,
  canAddTrack,
  onSelectionChange,
  onViewportChange,
  onAddTrack,
  onRemoveTrack: _onRemoveTrack,
  onTrackSourceBoneChange: _onTrackSourceBoneChange,
  onAddKeyframe: _onAddKeyframe,
  onMoveKeyframe,
}: TimelineEditorProps) {
  const detailRef = useRef<HTMLDivElement | null>(null);
  const overviewRef = useRef<HTMLDivElement | null>(null);
  const suppressOverviewClickRef = useRef(false);
  const [detailViewportWidth, setDetailViewportWidth] = useState(DEFAULT_DETAIL_VIEWPORT_WIDTH);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [overviewDragState, setOverviewDragState] = useState<OverviewDragState | null>(null);
  const [cursorScrubState, setCursorScrubState] = useState<CursorScrubState | null>(null);

  const visibleFrameCount = getViewportFrameCount(viewport);
  const detailPixelsPerFrame = useMemo(
    () => getDetailPixelsPerFrame(visibleFrameCount, detailViewportWidth),
    [detailViewportWidth, visibleFrameCount],
  );
  const detailStripStyle = useMemo(
    () =>
      ({
        width: `${detailViewportWidth}px`,
      }) as CSSProperties,
    [detailViewportWidth],
  );
  const detailTicks = useMemo(
    () => buildTimelineTicks(viewport.visible_frame_start, viewport.visible_frame_end, detailPixelsPerFrame),
    [detailPixelsPerFrame, viewport.visible_frame_end, viewport.visible_frame_start],
  );
  const invalidTrackIds = useMemo(() => new Set(referenceIssues?.invalid_track_ids ?? []), [referenceIssues]);
  const invalidTargetRootEventIds = useMemo(
    () => new Set(referenceIssues?.invalid_target_root_event_ids ?? []),
    [referenceIssues],
  );
  const invalidTargetBoneEventIds = useMemo(
    () => new Set(referenceIssues?.invalid_target_bone_event_ids ?? []),
    [referenceIssues],
  );
  const overviewWindowStyle = useMemo(() => {
    const { left, width } = getOverviewWindowPercentages(
      viewport.visible_frame_start,
      viewport.visible_frame_end,
      draft.frame_start,
      draft.frame_end,
    );
    return {
      left: `${left}%`,
      width: `${Math.max(4 / Math.max(1, overviewRef.current?.clientWidth ?? 1) * 100, width)}%`,
    };
  }, [draft.frame_end, draft.frame_start, viewport.visible_frame_end, viewport.visible_frame_start]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const activeDragState = dragState;

    function handlePointerMove(event: PointerEvent) {
      const deltaFrames = Math.round((event.clientX - activeDragState.start_client_x) / detailPixelsPerFrame);
      onMoveKeyframe(activeDragState.track_id, activeDragState.event_id, activeDragState.start_frame + deltaFrames);
    }

    function handlePointerUp() {
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [detailPixelsPerFrame, dragState, onMoveKeyframe]);

  useEffect(() => {
    const detailElement = detailRef.current;
    if (!detailElement) {
      return undefined;
    }

    const publishViewportWidth = () =>
      setDetailViewportWidth(Math.max(240, detailElement.clientWidth - TIMELINE_META_WIDTH));

    publishViewportWidth();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(publishViewportWidth);
    observer.observe(detailElement);

    return () => observer.disconnect();
  }, []);

  function setCursorFromDetailLane(clientX: number, currentTarget: HTMLDivElement) {
    const rect = currentTarget.getBoundingClientRect();
    const frame = offsetToFrame(
      clientX - rect.left,
      viewport.visible_frame_start,
      viewport.visible_frame_end,
      detailPixelsPerFrame,
    );

    onViewportChange({
      ...viewport,
      cursor_frame: frame,
    });
  }

  function startCursorScrub(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setCursorScrubState({
      pointer_id: event.pointerId,
    });
    setCursorFromDetailLane(event.clientX, event.currentTarget);
  }

  function handleCursorScrubMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!cursorScrubState || event.pointerId !== cursorScrubState.pointer_id) {
      return;
    }

    event.preventDefault();
    setCursorFromDetailLane(event.clientX, event.currentTarget);
  }

  function finishCursorScrub(event: ReactPointerEvent<HTMLDivElement>) {
    if (!cursorScrubState || event.pointerId !== cursorScrubState.pointer_id) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setCursorScrubState(null);
  }

  function handleOverviewJump(clientX: number, currentTarget: HTMLDivElement) {
    const rect = currentTarget.getBoundingClientRect();
    const frame = overviewOffsetToFrame(clientX - rect.left, draft.frame_start, draft.frame_end, rect.width);
    onViewportChange(centerViewportOnFrame(viewport, draft.frame_start, draft.frame_end, frame));
  }

  function startOverviewDrag(
    event: ReactPointerEvent<HTMLElement>,
    mode: OverviewDragState["mode"],
  ) {
    event.preventDefault();
    event.stopPropagation();
    overviewRef.current?.setPointerCapture?.(event.pointerId);
    setOverviewDragState({
      mode,
      pointer_id: event.pointerId,
      start_client_x: event.clientX,
      start_visible_frame_start: viewport.visible_frame_start,
      start_visible_frame_end: viewport.visible_frame_end,
    });
  }

  function finishOverviewDrag(pointerId: number) {
    suppressOverviewClickRef.current = true;
    overviewRef.current?.releasePointerCapture?.(pointerId);
    setOverviewDragState(null);
  }

  function handleOverviewPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!overviewDragState || event.pointerId !== overviewDragState.pointer_id) {
      return;
    }

    event.preventDefault();
    const overviewWidth = overviewRef.current?.clientWidth ?? 1;
    const overviewPixelsPerFrame = getOverviewPixelsPerFrame(draft.frame_start, draft.frame_end, overviewWidth);
    const deltaFrames = Math.round((event.clientX - overviewDragState.start_client_x) / overviewPixelsPerFrame);
    const dragViewport = {
      ...viewport,
      visible_frame_start: overviewDragState.start_visible_frame_start,
      visible_frame_end: overviewDragState.start_visible_frame_end,
    };

    if (overviewDragState.mode === "resize-left") {
      onViewportChange(
        resizeViewportWindowLeft(
          dragViewport,
          draft.frame_start,
          draft.frame_end,
          overviewDragState.start_visible_frame_start + deltaFrames,
        ),
      );
      return;
    }

    if (overviewDragState.mode === "resize-right") {
      onViewportChange(
        resizeViewportWindowRight(
          dragViewport,
          draft.frame_start,
          draft.frame_end,
          overviewDragState.start_visible_frame_end + deltaFrames,
        ),
      );
      return;
    }

    onViewportChange(shiftViewportWindow(dragViewport, draft.frame_start, draft.frame_end, deltaFrames));
  }

  function handleOverviewClick(event: React.MouseEvent<HTMLDivElement>) {
    if (suppressOverviewClickRef.current) {
      suppressOverviewClickRef.current = false;
      return;
    }

    handleOverviewJump(event.clientX, event.currentTarget);
  }

  function handleDetailWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!event.altKey && !event.shiftKey) {
      return;
    }

    event.preventDefault();

    const delta = getPrimaryWheelDelta(event);
    const wheelStepCount = Math.max(1, Math.round(Math.abs(delta) / 100));

    if (event.altKey) {
      const rect = event.currentTarget.getBoundingClientRect();
      const anchorFrame = offsetToFrame(
        event.clientX - rect.left,
        viewport.visible_frame_start,
        viewport.visible_frame_end,
        detailPixelsPerFrame,
      );
      const zoomStepFrames = Math.max(4, Math.round(visibleFrameCount * TIMELINE_WHEEL_ZOOM_RATIO)) * wheelStepCount;
      const requestedVisibleFrameCount = visibleFrameCount + (delta < 0 ? -zoomStepFrames : zoomStepFrames);

      onViewportChange(
        resizeViewportWindowAroundFrame(
          viewport,
          draft.frame_start,
          draft.frame_end,
          requestedVisibleFrameCount,
          anchorFrame,
        ),
      );
      return;
    }

    const panStepFrames = Math.max(1, Math.round(visibleFrameCount * TIMELINE_WHEEL_PAN_RATIO)) * wheelStepCount;
    onViewportChange(
      shiftViewportWindow(
        viewport,
        draft.frame_start,
        draft.frame_end,
        delta < 0 ? -panStepFrames : panStepFrames,
      ),
    );
  }

  function selectTrack(trackId: string) {
    onSelectionChange({
      track_id: trackId,
      event_id: null,
    });
  }

  return (
    <div className={`timeline-shell ${overviewDragState || cursorScrubState ? "timeline-shell--dragging" : ""}`}>
      <div className="timeline-toolbar">
        <div className="timeline-toolbar__group">
          <button className="button" disabled={!canAddTrack} onClick={onAddTrack} type="button">
            Add Track
          </button>
          <p className="timeline-toolbar__hint">One track per source bone. Add discrete target keys, then bake.</p>
        </div>
        <div className="timeline-toolbar__group timeline-toolbar__group--compact">
          <div className="timeline-toolbar__readout">
            <span>Visible</span>
            <strong>
              {viewport.visible_frame_start}-{viewport.visible_frame_end}
            </strong>
          </div>
          <label className="field">
            <span>Cursor</span>
            <input
              type="number"
              value={viewport.cursor_frame}
              onChange={(event) =>
                onViewportChange(
                  centerViewportOnFrame(
                    viewport,
                    draft.frame_start,
                    draft.frame_end,
                    Number.parseInt(event.target.value || "0", 10),
                  ),
                )
              }
            />
          </label>
        </div>
      </div>

      <div className="timeline-overview">
        <div className="timeline-overview__meta">Overview</div>
        <div
          aria-label="Timeline overview"
          className="timeline-overview__lane"
          ref={overviewRef}
          onPointerMove={handleOverviewPointerMove}
          onPointerUp={(event) => {
            if (overviewDragState && event.pointerId === overviewDragState.pointer_id) {
              finishOverviewDrag(event.pointerId);
            }
          }}
          onPointerCancel={(event) => {
            if (overviewDragState && event.pointerId === overviewDragState.pointer_id) {
              finishOverviewDrag(event.pointerId);
            }
          }}
          onClick={handleOverviewClick}
        >
          {draft.tracks.map((track) =>
            track.events.map((event) => (
              <span
                className={`timeline-overview__marker ${event.enabled ? "timeline-overview__marker--enabled" : ""}`}
                key={`${track.id}-${event.id}`}
                style={{
                  left: `${frameToOverviewOffset(event.frame, draft.frame_start, draft.frame_end, 100)}%`,
                }}
              />
            )),
          )}
          <div className="timeline-overview__window" style={overviewWindowStyle} onClick={(event) => event.stopPropagation()}>
            <button
              aria-label="Resize visible timeline window start"
              className="timeline-overview__handle timeline-overview__handle--left"
              type="button"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => startOverviewDrag(event, "resize-left")}
            />
            <div
              aria-label="Visible timeline window"
              className="timeline-overview__window-body"
              onPointerDown={(event) => startOverviewDrag(event, "move")}
            />
            <button
              aria-label="Resize visible timeline window end"
              className="timeline-overview__handle timeline-overview__handle--right"
              type="button"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => startOverviewDrag(event, "resize-right")}
            />
          </div>
        </div>
      </div>

      <div className="timeline-detail" ref={detailRef}>
        <div className="timeline-row timeline-row--ruler">
          <div className="timeline-row__meta timeline-row__meta--ruler">
            <span>Tracks</span>
          </div>
          <div
            className="timeline-row__lane timeline-row__lane--ruler"
            onWheel={handleDetailWheel}
            onPointerCancel={finishCursorScrub}
            onPointerDown={startCursorScrub}
            onPointerMove={handleCursorScrubMove}
            onPointerUp={finishCursorScrub}
          >
            <div className="timeline-strip" style={detailStripStyle}>
              {detailTicks.map((frame) => (
                <div
                  className={`timeline-tick timeline-tick--${frame.kind}`}
                  key={`${frame.kind}-${frame.frame}`}
                  style={{
                    left: `${frameToOffset(frame.frame, viewport.visible_frame_start, detailPixelsPerFrame)}px`,
                  }}
                >
                  {frame.label ? <span className="timeline-tick__label">{frame.label}</span> : null}
                </div>
              ))}
              <div
                className="timeline-cursor"
                style={{
                  left: `${frameToOffset(
                    viewport.cursor_frame,
                    viewport.visible_frame_start,
                    detailPixelsPerFrame,
                  )}px`,
                }}
              />
            </div>
          </div>
        </div>

        {draft.tracks.length === 0 ? (
          <p className="empty-copy timeline-empty">Add a track, then place keyframes on the cursor frame.</p>
        ) : null}

        {draft.tracks.map((track) => {
          const trackSelected = selection.track_id === track.id;
          const visibleEvents = track.events.filter(
            (event) => event.frame >= viewport.visible_frame_start && event.frame <= viewport.visible_frame_end,
          );

          return (
            <div
              className={`timeline-row ${trackSelected ? "timeline-row--selected" : ""} ${
                invalidTrackIds.has(track.id) ? "timeline-row--invalid" : ""
              }`}
              key={track.id}
            >
              <div className="timeline-row__meta" onClick={() => selectTrack(track.id)}>
                <div className="timeline-row__meta-summary">
                  <strong>{track.source_bone_name_j || "Unassigned"}</strong>
                  <span>{track.events.length} keyframes</span>
                </div>
              </div>

              <div
                className="timeline-row__lane"
                onWheel={handleDetailWheel}
                onPointerCancel={finishCursorScrub}
                onPointerDown={(event) => {
                  selectTrack(track.id);
                  startCursorScrub(event);
                }}
                onPointerMove={handleCursorScrubMove}
                onPointerUp={finishCursorScrub}
              >
                <div className="timeline-strip timeline-strip--lane" style={detailStripStyle}>
                  <div className="timeline-grid" aria-hidden="true">
                    {detailTicks.map((tick) => (
                      <div
                        className={`timeline-grid-line timeline-grid-line--${tick.kind}`}
                        key={`${track.id}-${tick.kind}-${tick.frame}`}
                        style={{
                          left: `${frameToOffset(
                            tick.frame,
                            viewport.visible_frame_start,
                            detailPixelsPerFrame,
                          )}px`,
                        }}
                      />
                    ))}
                  </div>
                  <div
                    className="timeline-cursor"
                    style={{
                      left: `${frameToOffset(
                        viewport.cursor_frame,
                        viewport.visible_frame_start,
                        detailPixelsPerFrame,
                      )}px`,
                    }}
                  />
                  {visibleEvents.map((event) => {
                    const selected = selection.event_id === event.id;
                    const invalidTarget =
                      invalidTargetRootEventIds.has(event.id) || invalidTargetBoneEventIds.has(event.id);

                    return (
                      <button
                        aria-label={`Keyframe ${event.frame}`}
                        className={`timeline-keyframe ${selected ? "timeline-keyframe--selected" : ""} ${
                          event.enabled ? "timeline-keyframe--enabled" : "timeline-keyframe--disabled"
                        } ${invalidTarget ? "timeline-keyframe--invalid" : ""}`}
                        key={event.id}
                        style={{
                          left: `${frameToOffset(
                            event.frame,
                            viewport.visible_frame_start,
                            detailPixelsPerFrame,
                          )}px`,
                        }}
                        onClick={(eventClick) => {
                          eventClick.stopPropagation();
                          onSelectionChange({
                            track_id: track.id,
                            event_id: event.id,
                          });
                        }}
                        onPointerDown={(pointerEvent) => {
                          pointerEvent.preventDefault();
                          pointerEvent.stopPropagation();
                          onSelectionChange({
                            track_id: track.id,
                            event_id: event.id,
                          });
                          setDragState({
                            track_id: track.id,
                            event_id: event.id,
                            start_frame: event.frame,
                            start_client_x: pointerEvent.clientX,
                          });
                        }}
                        type="button"
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getPrimaryWheelDelta(event: ReactWheelEvent<HTMLElement>) {
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    return event.deltaX;
  }

  return event.deltaY;
}
