import { SectionCard } from "../../../components/SectionCard";
import type { BakerTrackDraft } from "../state";

interface BoneOption {
  bone_name: string;
  bone_name_j: string;
  bone_id: number;
}

interface TrackInspectorProps {
  track: BakerTrackDraft | null;
  boneOptions: BoneOption[];
  onTrackSourceBoneChange: (trackId: string, sourceBoneNameJ: string) => void;
  onAddKeyframe: (trackId: string) => void;
  onRemoveTrack: (trackId: string) => void;
}

export function TrackInspector({
  track,
  boneOptions,
  onTrackSourceBoneChange,
  onAddKeyframe,
  onRemoveTrack,
}: TrackInspectorProps) {
  if (!track) {
    return (
      <SectionCard className="section-card--compact" label="Track Inspector" subtitle="No selection" title="Inspector">
        <p className="empty-copy">Select a track lane to edit its source bone or add a keyframe at the current cursor.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      className="section-card--compact"
      label="Track Inspector"
      subtitle={track.source_bone_name_j || "Unassigned track"}
      title="Inspector"
    >
      <label className="field">
        <span>Source Bone</span>
        <select
          aria-label="Source Bone"
          value={track.source_bone_name_j}
          onChange={(event) => onTrackSourceBoneChange(track.id, event.target.value)}
        >
          <option value="">Select a source bone</option>
          {boneOptions.map((bone) => (
            <option key={bone.bone_name_j} value={bone.bone_name_j}>
              {bone.bone_name_j} ({bone.bone_name})
            </option>
          ))}
        </select>
      </label>

      <div className="inspector-actions inspector-actions--stack">
        <button className="button" onClick={() => onAddKeyframe(track.id)} type="button">
          Add Keyframe
        </button>
        <button className="button button--ghost" onClick={() => onRemoveTrack(track.id)} type="button">
          Remove Track
        </button>
      </div>

      <p className="empty-copy">{track.events.length} keyframes on this track.</p>
    </SectionCard>
  );
}
