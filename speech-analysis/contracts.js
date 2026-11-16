/** Independent local adapters: results are evidence, never authorization to edit audio. */
export const STAGES = Object.freeze(['vad', 'asr', 'alignment', 'retakes', 'ranking', 'review']);

export function validateRange(range, totalFrames) {
  if (!Number.isSafeInteger(totalFrames) || totalFrames <= 0 || !range ||
      !Number.isSafeInteger(range.startFrame) || !Number.isSafeInteger(range.endFrame) ||
      range.startFrame < 0 || range.endFrame <= range.startFrame || range.endFrame > totalFrames) {
    throw new Error('Invalid half-open source frame range');
  }
  return true;
}

/** Each adapter exposes async analyze(input) and identifies its model/version. */
export function validateAdapter(stage, adapter) {
  if (!STAGES.includes(stage)) throw new Error('Unknown analysis stage');
  if (!adapter || typeof adapter.analyze !== 'function' ||
      typeof adapter.id !== 'string' || !adapter.id.trim() ||
      typeof adapter.version !== 'string' || !adapter.version.trim()) throw new Error('Invalid adapter');
  return adapter;
}

export function createReviewFinding({ range, totalFrames, category, evidence, confidence }) {
  validateRange(range, totalFrames);
  if (typeof category !== 'string' || !category.trim() || typeof evidence !== 'string' || !evidence.trim() ||
      !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Invalid review finding');
  return { range: { ...range }, category, evidence, confidence, status: 'needs-human-review' };
}
