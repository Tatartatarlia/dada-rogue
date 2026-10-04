import { useEffect, useRef } from 'react'

function drawWhale(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h)
  const cx = w * 0.46
  const cy = h * 0.58

  ctx.beginPath()
  ctx.moveTo(cx + w * 0.22, cy - h * 0.02)
  ctx.quadraticCurveTo(cx + w * 0.4, cy - h * 0.05, cx + w * 0.5, cy - h * 0.22)
  ctx.quadraticCurveTo(cx + w * 0.34, cy - h * 0.04, cx + w * 0.24, cy + h * 0.02)
  ctx.quadraticCurveTo(cx + w * 0.36, cy + h * 0.06, cx + w * 0.5, cy + h * 0.22)
  ctx.quadraticCurveTo(cx + w * 0.38, cy + h * 0.04, cx + w * 0.22, cy + h * 0.04)
  ctx.closePath()
  ctx.fillStyle = '#1f6eab'
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(cx, cy, w * 0.3, h * 0.26, -0.08, 0, Math.PI * 2)
  const body = ctx.createLinearGradient(cx, cy - h * 0.3, cx, cy + h * 0.28)
  body.addColorStop(0, '#9ad7f6')
  body.addColorStop(0.42, '#3b93cf')
  body.addColorStop(1, '#1a568f')
  ctx.fillStyle = body
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(cx - w * 0.02, cy + h * 0.08, w * 0.18, h * 0.11, -0.08, 0, Math.PI)
  ctx.fillStyle = '#e7f7ff'
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(cx + w * 0.02, cy + h * 0.02)
  ctx.quadraticCurveTo(cx + w * 0.01, cy + h * 0.28, cx + w * 0.16, cy + h * 0.16)
  ctx.quadraticCurveTo(cx + w * 0.08, cy + h * 0.08, cx + w * 0.04, cy + h * 0.02)
  ctx.fillStyle = '#1d639c'
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(cx - w * 0.16, cy - h * 0.16, w * 0.05, h * 0.035, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = '#69b7e6'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx - w * 0.16, cy - h * 0.02, Math.max(3, w * 0.02), 0, Math.PI * 2)
  ctx.fillStyle = '#f4fbff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx - w * 0.155, cy - h * 0.02, Math.max(1.4, w * 0.009), 0, Math.PI * 2)
  ctx.fillStyle = '#16324d'
  ctx.fill()

  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath()
    ctx.arc(cx - w * 0.04 + i * w * 0.035, cy - h * 0.34 - i * h * 0.07, 2.5 + i * 1.4, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(198, 236, 255, ${0.9 - i * 0.16})`
    ctx.fill()
  }
}

export function Whale({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const scale = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawWhale(ctx, width, height)
  }, [width, height])
  return <canvas ref={ref} className="whale" style={{ width, height }} aria-label="蓝色鲸鱼" />
}
