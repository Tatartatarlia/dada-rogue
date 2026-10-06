import { useEffect, useRef } from 'react'

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of text) {
    const next = line + char
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = char
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawMedalFace(ctx: CanvasRenderingContext2D, size: number, text: string | null) {
  const cx = size / 2
  const cy = size * 0.56
  const radius = size * 0.34

  ctx.beginPath()
  ctx.moveTo(cx - size * 0.12, cy - radius * 0.2)
  ctx.lineTo(cx - size * 0.22, size * 0.08)
  ctx.lineTo(cx - size * 0.05, cy - radius * 0.55)
  ctx.closePath()
  ctx.fillStyle = '#c4363a'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + size * 0.12, cy - radius * 0.2)
  ctx.lineTo(cx + size * 0.22, size * 0.08)
  ctx.lineTo(cx + size * 0.05, cy - radius * 0.55)
  ctx.closePath()
  ctx.fillStyle = '#8d2a32'
  ctx.fill()

  const ring = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius)
  ring.addColorStop(0, '#fff1c2')
  ring.addColorStop(0.45, '#e2b34a')
  ring.addColorStop(1, '#8a5a16')
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = ring
  ctx.fill()

  const face = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.3, radius * 0.1, cx, cy, radius)
  face.addColorStop(0, '#8fd0f2')
  face.addColorStop(0.55, '#2f78b4')
  face.addColorStop(1, '#173e68')
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.82, 0, Math.PI * 2)
  ctx.fillStyle = face
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.74, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 226, 150, 0.85)'
  ctx.lineWidth = Math.max(1, size * 0.012)
  ctx.stroke()

  ctx.save()
  ctx.translate(cx, cy - radius * 0.42)
  ctx.beginPath()
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI / 4) * i - Math.PI / 2
    const reach = i % 2 === 0 ? radius * 0.16 : radius * 0.07
    const x = Math.cos(angle) * reach
    const y = Math.sin(angle) * reach
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = '#f0c36a'
  ctx.fill()
  ctx.restore()

  if (!text) return
  ctx.fillStyle = '#f7fbff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.max(12, Math.round(size * 0.062))}px "KaiTi", "STKaiti", "Songti SC", serif`
  const matched = text.match(/^达达利亚通关了难度等级(\d+)的执行官的试炼！$/)
  const lines = matched
    ? ['达达利亚通关了', `难度等级${matched[1]}的`, '执行官的试炼！']
    : wrapText(ctx, text, radius * 1.25)
  const lineHeight = Math.max(16, size * 0.078)
  const top = cy - ((lines.length - 1) * lineHeight) / 2 + radius * 0.08
  lines.forEach((line, index) => {
    ctx.fillText(line, cx, top + index * lineHeight)
  })
}

export function Medal({ text, size }: { text: string | null; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const scale = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(size * scale)
    canvas.height = Math.round(size * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.clearRect(0, 0, size, size)
    drawMedalFace(ctx, size, text)
  }, [text, size])
  return <canvas ref={ref} className="medal" style={{ width: size, height: size }} aria-label={text ?? '试炼奖章'} />
}
