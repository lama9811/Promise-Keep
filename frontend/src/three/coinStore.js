// Shared state the 3D coin reads every frame. Writing here does not re-render
// React, so typing and progress can drive the coin at 60fps for free.
//
// mode: 'idle'     slow drift, tilts toward the cursor
//       'deal'     flips to show the engraved stake
//       'locked'   a ring clamps around the coin (stake paid)
//       'progress' ring split into segments, kept ones glow
export const coin = {
  mode: 'idle',
  stakeCents: 0,
  done: 0,
  target: 0,
  outcome: null, // 'won' | 'lost' | null
  kick: 0, // added to on every keystroke, decays in the scene
  version: 0, // bumped when the engraving must be redrawn
}

export function setCoin(patch) {
  const engravingChanged = 'stakeCents' in patch && patch.stakeCents !== coin.stakeCents
  Object.assign(coin, patch)
  if (engravingChanged) coin.version += 1
}

export function kickCoin(amount = 1) {
  coin.kick = Math.min(coin.kick + amount, 6)
}
