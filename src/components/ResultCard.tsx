import type { BakeResponse } from "../api/types";

interface ResultCardProps {
  result: BakeResponse | null;
}

export function ResultCard({ result }: ResultCardProps) {
  if (!result) {
    return <p className="result-card__placeholder">Bake results will appear here after a successful request.</p>;
  }

  return (
    <div className="result-card">
      <dl className="result-card__grid">
        <div>
          <dt>Output Action</dt>
          <dd>{result.output_action_name}</dd>
        </div>
        <div>
          <dt>Output Armature</dt>
          <dd>{result.output_armature_object_name}</dd>
        </div>
        <div>
          <dt>Output Mode</dt>
          <dd>{result.output_mode}</dd>
        </div>
        <div>
          <dt>Source Action</dt>
          <dd>{result.source_action_name}</dd>
        </div>
        <div>
          <dt>Source Armature</dt>
          <dd>{result.armature_object_name}</dd>
        </div>
        <div>
          <dt>Frame Count</dt>
          <dd>{result.frame_count}</dd>
        </div>
        <div>
          <dt>Bones</dt>
          <dd>{result.baked_bone_count}</dd>
        </div>
        <div>
          <dt>Tracks</dt>
          <dd>{result.track_count}</dd>
        </div>
        <div>
          <dt>Frame Range</dt>
          <dd>
            {result.frame_start} - {result.frame_end}
          </dd>
        </div>
      </dl>
    </div>
  );
}
