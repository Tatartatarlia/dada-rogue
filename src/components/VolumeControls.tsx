import { useState } from 'react'
import { getSfxVolume, setSfxVolume } from '../game/audio'

export function VolumeControls() {
  const [sfx, setSfx] = useState(() => Math.round(getSfxVolume() * 100))

  return (
    <label className="volumes">
      音效
      <input
        type="range"
        min={0}
        max={100}
        value={sfx}
        aria-label="音效音量"
        onChange={(event) => {
          const next = Number(event.target.value)
          setSfx(next)
          setSfxVolume(next / 100)
        }}
      />
    </label>
  )
}
