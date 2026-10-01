export type Sound = 'throw' | 'hit' | 'hurt' | 'merge' | 'place' | 'win' | 'lose' | 'click'

let muted = false
let context: AudioContext | null = null
let lastThrow = 0
let lastHit = 0
let lastHurt = 0

export function setMuted(value: boolean): void {
  muted = value
}

function audio(): AudioContext | null {
  if (muted) return null
  const Ctx = window.AudioContext
  if (!Ctx) return null
  context ??= new Ctx()
  if (context.state === 'suspended') void context.resume()
  return context
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain: number,
): void {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, start)
  amp.gain.setValueAtTime(gain, start)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp)
  amp.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

export function play(sound: Sound): void {
  const nowMs = performance.now()
  if (sound === 'throw' && nowMs - lastThrow < 80) return
  if (sound === 'hit' && nowMs - lastHit < 45) return
  if (sound === 'hurt' && nowMs - lastHurt < 140) return
  if (sound === 'throw') lastThrow = nowMs
  if (sound === 'hit') lastHit = nowMs
  if (sound === 'hurt') lastHurt = nowMs
  const ctx = audio()
  if (!ctx) return
  const t = ctx.currentTime
  switch (sound) {
    case 'throw':
      tone(ctx, 640, t, 0.05, 'triangle', 0.03)
      break
    case 'hit':
      tone(ctx, 210, t, 0.06, 'square', 0.025)
      break
    case 'hurt':
      tone(ctx, 140, t, 0.16, 'sawtooth', 0.04)
      break
    case 'place':
      tone(ctx, 360, t, 0.06, 'sine', 0.04)
      break
    case 'click':
      tone(ctx, 520, t, 0.04, 'sine', 0.03)
      break
    case 'merge':
      tone(ctx, 523, t, 0.08, 'triangle', 0.04)
      tone(ctx, 784, t + 0.07, 0.12, 'triangle', 0.04)
      break
    case 'win':
      tone(ctx, 523, t, 0.1, 'triangle', 0.04)
      tone(ctx, 659, t + 0.09, 0.1, 'triangle', 0.04)
      tone(ctx, 784, t + 0.18, 0.16, 'triangle', 0.045)
      break
    case 'lose':
      tone(ctx, 311, t, 0.16, 'triangle', 0.04)
      tone(ctx, 196, t + 0.12, 0.28, 'triangle', 0.04)
      break
  }
}
