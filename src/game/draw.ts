import type { WeaponType } from '../types'
import { shapeOf } from './logic'

const FILL: Record<WeaponType, string> = {
  axe: 'rgba(214, 222, 232, 0.34)',
  dart: 'rgba(236, 242, 250, 0.3)',
  sword: 'rgba(166, 206, 255, 0.32)',
  molotov: 'rgba(255, 138, 64, 0.34)',
  bomb: 'rgba(255, 198, 92, 0.3)',
  potion: 'rgba(188, 132, 255, 0.34)',
}

const EDGE: Record<WeaponType, string> = {
  axe: 'rgba(236, 242, 248, 0.85)',
  dart: 'rgba(248, 250, 252, 0.9)',
  sword: 'rgba(186, 220, 255, 0.95)',
  molotov: 'rgba(255, 176, 96, 0.95)',
  bomb: 'rgba(255, 220, 140, 0.95)',
  potion: 'rgba(220, 186, 255, 0.95)',
}

/** 未旋转时，图案“朝向”相对 +x 轴的角度 */
const FORWARD: Record<WeaponType, number> = {
  dart: 0,
  sword: -Math.PI / 2,
  axe: -Math.PI / 5,
  molotov: -Math.PI / 2,
  bomb: -Math.PI / 2,
  potion: -Math.PI / 2,
}

export function gridAngle(rotation: number): number {
  return -rotation * (Math.PI / 2)
}

export function flightAngle(type: WeaponType, velocityAngle: number, spin: number): number {
  return velocityAngle - FORWARD[type] + spin
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function badgeColor(level: number): string {
  if (level >= 5) return '#8fe7ff'
  if (level >= 3) return '#ff8d42'
  if (level >= 2) return '#f0c36a'
  return '#f6efe2'
}

export function paintPocket(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number): void {
  const gap = Math.max(4, cell * 0.1)
  const px = x + gap / 2
  const py = y + gap / 2
  const size = cell - gap
  roundRect(ctx, px, py, size, size, 8)
  ctx.fillStyle = 'rgba(240, 214, 170, 0.08)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(240, 195, 106, 0.7)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = 'rgba(240, 214, 170, 0.85)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(x + cell / 2, y + cell * 0.38)
  ctx.lineTo(x + cell / 2, y + cell * 0.62)
  ctx.moveTo(x + cell * 0.38, y + cell / 2)
  ctx.lineTo(x + cell * 0.62, y + cell / 2)
  ctx.stroke()
}

export function paintWeapon(
  ctx: CanvasRenderingContext2D,
  type: WeaponType,
  rotation: number,
  level: number,
  cell: number,
): void {
  const shape = shapeOf(type, rotation)
  const gap = Math.max(4, cell * 0.1)
  for (const part of shape) {
    const px = part.x * cell + gap / 2
    const py = part.y * cell + gap / 2
    const size = cell - gap
    roundRect(ctx, px, py, size, size, 8)
    ctx.fillStyle = FILL[type]
    ctx.fill()
    ctx.strokeStyle = EDGE[type]
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  const icon = cell * (0.5 + Math.min(shape.length, 4) * 0.1)
  ctx.save()
  ctx.beginPath()
  for (const part of shape) {
    const px = part.x * cell + gap / 2
    const py = part.y * cell + gap / 2
    const size = cell - gap
    roundRect(ctx, px, py, size, size, 8)
  }
  ctx.clip()
  const occupied = shape.reduce(
    (sum, part) => ({ x: sum.x + part.x + 0.5, y: sum.y + part.y + 0.5 }),
    { x: 0, y: 0 },
  )
  drawWeaponIcon(
    ctx,
    type,
    (occupied.x / shape.length) * cell,
    (occupied.y / shape.length) * cell,
    icon,
    gridAngle(rotation),
  )
  ctx.restore()
  const bottomLeft = shape.reduce((best, part) =>
    part.y > best.y || (part.y === best.y && part.x < best.x) ? part : best,
  )
  const radius = Math.max(8, cell * 0.16)
  drawLevelBadge(
    ctx,
    bottomLeft.x * cell + 3,
    (bottomLeft.y + 1) * cell - 3 - radius * 2,
    level,
    cell,
  )
}

function drawLevelBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  level: number,
  cell: number,
): void {
  const radius = Math.max(8, cell * 0.16)
  ctx.beginPath()
  ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2)
  ctx.fillStyle = badgeColor(level)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(42, 24, 12, 0.45)'
  ctx.stroke()
  ctx.fillStyle = '#2a180c'
  ctx.font = `700 ${Math.max(10, Math.round(radius * 1.15))}px "Segoe UI", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(level), x + radius, y + radius + 0.5)
}

export function drawWeaponIcon(
  ctx: CanvasRenderingContext2D,
  type: WeaponType,
  cx: number,
  cy: number,
  size: number,
  angle: number,
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  const s = size / 2
  switch (type) {
    case 'axe':
      drawAxe(ctx, s)
      break
    case 'dart':
      drawDart(ctx, s)
      break
    case 'sword':
      drawSword(ctx, s)
      break
    case 'molotov':
      drawMolotov(ctx, s)
      break
    case 'bomb':
      drawBomb(ctx, s)
      break
    case 'potion':
      drawPotion(ctx, s)
      break
  }
  ctx.restore()
}

function drawAxe(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.strokeStyle = '#8d5a32'
  ctx.lineWidth = Math.max(2, s * 0.16)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-s * 0.15, s * 0.72)
  ctx.lineTo(s * 0.28, -s * 0.42)
  ctx.stroke()
  const blade = ctx.createLinearGradient(-s, -s, s, s * 0.2)
  blade.addColorStop(0, '#f7fbff')
  blade.addColorStop(1, '#8ea0b5')
  ctx.fillStyle = blade
  ctx.beginPath()
  ctx.moveTo(s * 0.05, -s * 0.15)
  ctx.quadraticCurveTo(s * 0.95, -s * 0.95, s * 0.42, s * 0.28)
  ctx.quadraticCurveTo(s * 0.12, s * 0.02, s * 0.05, -s * 0.15)
  ctx.fill()
  ctx.strokeStyle = '#5d6d80'
  ctx.lineWidth = Math.max(1, s * 0.05)
  ctx.stroke()
}

function drawDart(ctx: CanvasRenderingContext2D, s: number): void {
  const metal = ctx.createLinearGradient(-s, 0, s, 0)
  metal.addColorStop(0, '#9eacbf')
  metal.addColorStop(0.45, '#f7fbff')
  metal.addColorStop(1, '#d5dee8')
  ctx.fillStyle = metal
  ctx.beginPath()
  ctx.moveTo(s * 0.92, 0)
  ctx.lineTo(-s * 0.05, s * 0.16)
  ctx.lineTo(-s * 0.42, 0)
  ctx.lineTo(-s * 0.05, -s * 0.16)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#e07a3d'
  ctx.beginPath()
  ctx.moveTo(-s * 0.28, 0)
  ctx.lineTo(-s * 0.78, s * 0.28)
  ctx.lineTo(-s * 0.48, 0)
  ctx.lineTo(-s * 0.78, -s * 0.28)
  ctx.closePath()
  ctx.fill()
}

function drawSword(ctx: CanvasRenderingContext2D, s: number): void {
  const blade = ctx.createLinearGradient(-s * 0.2, 0, s * 0.2, 0)
  blade.addColorStop(0, '#b9c7d6')
  blade.addColorStop(0.5, '#f8fbff')
  blade.addColorStop(1, '#8ea0b3')
  ctx.fillStyle = blade
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.92)
  ctx.lineTo(s * 0.13, s * 0.28)
  ctx.lineTo(-s * 0.13, s * 0.28)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#d7b15a'
  ctx.fillRect(-s * 0.34, s * 0.28, s * 0.68, s * 0.1)
  ctx.fillStyle = '#6e3b2c'
  ctx.fillRect(-s * 0.07, s * 0.38, s * 0.14, s * 0.36)
  ctx.fillStyle = '#f0c36a'
  ctx.beginPath()
  ctx.arc(0, s * 0.78, s * 0.08, 0, Math.PI * 2)
  ctx.fill()
}

function drawMolotov(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#ffb15a'
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.95)
  ctx.quadraticCurveTo(s * 0.16, -s * 0.55, s * 0.05, -s * 0.42)
  ctx.quadraticCurveTo(-s * 0.05, -s * 0.55, 0, -s * 0.95)
  ctx.fill()
  ctx.fillStyle = '#f28a3a'
  ctx.fillRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.16)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  roundRect(ctx, -s * 0.28, -s * 0.26, s * 0.56, s * 0.78, s * 0.16)
  ctx.fill()
  ctx.fillStyle = '#ff6a2a'
  roundRect(ctx, -s * 0.28, s * 0.02, s * 0.56, s * 0.5, s * 0.12)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = Math.max(1, s * 0.05)
  ctx.beginPath()
  ctx.moveTo(-s * 0.16, -s * 0.05)
  ctx.lineTo(-s * 0.16, s * 0.42)
  ctx.stroke()
}

function drawBomb(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.strokeStyle = '#6b5434'
  ctx.lineWidth = Math.max(1.5, s * 0.07)
  ctx.beginPath()
  ctx.moveTo(s * 0.18, -s * 0.32)
  ctx.quadraticCurveTo(s * 0.42, -s * 0.72, s * 0.16, -s * 0.86)
  ctx.stroke()
  ctx.fillStyle = '#ffd56a'
  ctx.beginPath()
  ctx.arc(s * 0.16, -s * 0.9, s * 0.1, 0, Math.PI * 2)
  ctx.fill()
  const body = ctx.createRadialGradient(-s * 0.2, -s * 0.2, s * 0.1, 0, s * 0.05, s * 0.62)
  body.addColorStop(0, '#5c6270')
  body.addColorStop(1, '#1c1e24')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(0, s * 0.08, s * 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.beginPath()
  ctx.ellipse(-s * 0.16, -s * 0.08, s * 0.14, s * 0.08, -0.6, 0, Math.PI * 2)
  ctx.fill()
}

function drawPotion(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#efe6ff'
  ctx.fillRect(-s * 0.1, -s * 0.78, s * 0.2, s * 0.2)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.beginPath()
  ctx.moveTo(-s * 0.12, -s * 0.56)
  ctx.lineTo(-s * 0.42, s * 0.1)
  ctx.quadraticCurveTo(-s * 0.48, s * 0.72, 0, s * 0.78)
  ctx.quadraticCurveTo(s * 0.48, s * 0.72, s * 0.42, s * 0.1)
  ctx.lineTo(s * 0.12, -s * 0.56)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#9b5de5'
  ctx.beginPath()
  ctx.moveTo(-s * 0.34, s * 0.18)
  ctx.quadraticCurveTo(-s * 0.4, s * 0.66, 0, s * 0.68)
  ctx.quadraticCurveTo(s * 0.4, s * 0.66, s * 0.34, s * 0.18)
  ctx.quadraticCurveTo(0, s * 0.34, -s * 0.34, s * 0.18)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.arc(-s * 0.12, s * 0.28, s * 0.05, 0, Math.PI * 2)
  ctx.arc(s * 0.08, s * 0.46, s * 0.035, 0, Math.PI * 2)
  ctx.fill()
}

export function drawBattlefield(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#1a2b4e')
  sky.addColorStop(0.45, '#12192c')
  sky.addColorStop(1, '#070b12')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(255, 236, 196, 0.9)'
  ctx.beginPath()
  ctx.arc(w * 0.78, h * 0.16, Math.max(18, w * 0.02), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 236, 196, 0.08)'
  ctx.beginPath()
  ctx.arc(w * 0.78, h * 0.16, Math.max(48, w * 0.06), 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#10192a'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.48)
  ctx.lineTo(w * 0.18, h * 0.36)
  ctx.lineTo(w * 0.33, h * 0.5)
  ctx.lineTo(w * 0.48, h * 0.32)
  ctx.lineTo(w * 0.66, h * 0.48)
  ctx.lineTo(w * 0.82, h * 0.34)
  ctx.lineTo(w, h * 0.46)
  ctx.lineTo(w, h * 0.58)
  ctx.lineTo(0, h * 0.58)
  ctx.fill()

  const groundTop = h * 0.56
  const road = ctx.createLinearGradient(0, groundTop, 0, h)
  road.addColorStop(0, '#3a342c')
  road.addColorStop(1, '#16130f')
  ctx.fillStyle = road
  ctx.fillRect(0, groundTop, w, h - groundTop)

  ctx.strokeStyle = 'rgba(240, 195, 106, 0.16)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, h * 0.72)
  ctx.lineTo(w, h * 0.72)
  ctx.stroke()

  const fog = ctx.createLinearGradient(w * 0.55, 0, w, 0)
  fog.addColorStop(0, 'rgba(180, 200, 230, 0)')
  fog.addColorStop(1, 'rgba(180, 200, 230, 0.16)')
  ctx.fillStyle = fog
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  for (let i = 0; i < 18; i += 1) {
    const x = ((i * 97 + time * (12 + (i % 5) * 4)) % (w + 40)) - 20
    const y = h * 0.08 + ((i * 53) % Math.max(1, h * 0.36))
    ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1.2, i % 3 === 0 ? 2 : 1.2)
  }
}

export function drawHero(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource | null,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
  hurt: number,
): void {
  const bob = Math.sin(time * 2.4) * 5
  const cx = x + w * 0.48
  const cy = y + h * 0.42 + bob
  const aura = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.72)
  aura.addColorStop(0, 'rgba(80, 206, 255, 0.38)')
  aura.addColorStop(1, 'rgba(80, 206, 255, 0)')
  ctx.fillStyle = aura
  ctx.beginPath()
  ctx.arc(cx, cy, w * 0.72, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.ellipse(x + w * 0.48, y + h * 0.9, w * 0.28, h * 0.045, 0, 0, Math.PI * 2)
  ctx.fill()

  if (image) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 10
    ctx.drawImage(image, x, y + bob, w, h)
    ctx.restore()
  }
  if (hurt > 0) {
    ctx.fillStyle = `rgba(255, 48, 80, ${Math.min(0.35, hurt)})`
    ctx.beginPath()
    ctx.arc(cx, cy, w * 0.55, 0, Math.PI * 2)
    ctx.fill()
  }
}

export interface EnemyDraw {
  x: number
  y: number
  r: number
  hp: number
  maxHp: number
  hue: number
  burn: number
  held: boolean
  flash: number
  phase: number
  wave: number
}

export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyDraw, time: number): void {
  const { x, y, r, hue } = enemy
  const step = Math.sin(time * 8 + enemy.phase) * r * 0.12
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.95, r * 0.72, r * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = `hsl(${hue} 30% 18%)`
  ctx.lineWidth = Math.max(3, r * 0.16)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - r * 0.2, y + r * 0.35)
  ctx.lineTo(x - r * 0.34, y + r * 0.85 + step)
  ctx.moveTo(x + r * 0.16, y + r * 0.35)
  ctx.lineTo(x + r * 0.28, y + r * 0.85 - step)
  ctx.stroke()

  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.2, x, y, r)
  body.addColorStop(0, `hsl(${hue} 75% 64%)`)
  body.addColorStop(1, `hsl(${hue} 42% 28%)`)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(x, y, r * 0.78, 0, Math.PI * 2)
  ctx.fill()

  if (enemy.wave >= 3) {
    ctx.fillStyle = `hsl(${hue} 35% 22%)`
    ctx.beginPath()
    ctx.moveTo(x - r * 0.1, y - r * 0.55)
    ctx.lineTo(x - r * 0.34, y - r * 1.15)
    ctx.lineTo(x + r * 0.05, y - r * 0.62)
    ctx.fill()
  }

  ctx.fillStyle = '#f4f7fb'
  ctx.beginPath()
  ctx.arc(x - r * 0.28, y - r * 0.08, r * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1b2433'
  ctx.beginPath()
  ctx.arc(x - r * 0.34, y - r * 0.08, r * 0.07, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#3a2a22'
  ctx.lineWidth = Math.max(3, r * 0.14)
  ctx.beginPath()
  ctx.moveTo(x - r * 0.15, y + r * 0.05)
  ctx.lineTo(x - r * 1.15, y - r * 0.05)
  ctx.stroke()
  ctx.fillStyle = '#6d5434'
  ctx.beginPath()
  ctx.arc(x - r * 1.2, y - r * 0.05, r * 0.2, 0, Math.PI * 2)
  ctx.fill()

  if (enemy.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, enemy.flash * 4)})`
    ctx.beginPath()
    ctx.arc(x, y, r * 0.78, 0, Math.PI * 2)
    ctx.fill()
  }
  if (enemy.burn > 0) {
    ctx.fillStyle = 'rgba(255, 120, 40, 0.85)'
    ctx.beginPath()
    ctx.moveTo(x, y - r * 1.15)
    ctx.quadraticCurveTo(x + r * 0.28, y - r * 0.7, x, y - r * 0.45)
    ctx.quadraticCurveTo(x - r * 0.28, y - r * 0.7, x, y - r * 1.15)
    ctx.fill()
  }
  if (enemy.held) {
    ctx.strokeStyle = 'rgba(188, 140, 255, 0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, r * 0.95, time * 2, time * 2 + 1.4)
    ctx.stroke()
  }

  const barW = r * 1.7
  const ratio = Math.max(0, enemy.hp / enemy.maxHp)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  roundRect(ctx, x - barW / 2, y - r - 14, barW, 6, 3)
  ctx.fill()
  ctx.fillStyle = ratio > 0.45 ? '#7dffa1' : '#ff5d73'
  roundRect(ctx, x - barW / 2, y - r - 14, barW * ratio, 6, 3)
  ctx.fill()
}

export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  type: WeaponType,
  x: number,
  y: number,
  velocityAngle: number,
  spin: number,
  radius: number,
): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - Math.cos(velocityAngle) * radius * 1.8, y - Math.sin(velocityAngle) * radius * 1.8)
  ctx.lineTo(x, y)
  ctx.stroke()
  ctx.restore()
  drawWeaponIcon(ctx, type, x, y, radius * 2.3, flightAngle(type, velocityAngle, spin))
}

export function drawPotionZone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  life: number,
  max: number,
  time: number,
): void {
  const fade = life > max * 0.25 ? 1 : Math.max(0, life / (max * 0.25))
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(150, 96, 255, 0.28)'
  ctx.globalAlpha = fade
  ctx.fill()
  ctx.strokeStyle = 'rgba(214, 186, 255, 0.95)'
  ctx.lineWidth = 3
  ctx.setLineDash([10, 7])
  ctx.lineDashOffset = -time * 28
  ctx.stroke()
  ctx.restore()
}

export function drawBoom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  life: number,
  max: number,
  color: string,
): void {
  const t = Math.max(0, life / max)
  ctx.beginPath()
  ctx.arc(x, y, radius * (1.05 - t), 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.globalAlpha = t
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.globalAlpha = 1
}

export function drawFloater(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  alpha: number,
  color: string,
): void {
  ctx.save()
  ctx.globalAlpha = Math.max(0, alpha)
  ctx.font = '700 16px "Segoe UI", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 3
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function drawBanner(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, alpha: number): void {
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
  ctx.fillStyle = 'rgba(6, 10, 18, 0.45)'
  ctx.fillRect(0, h * 0.38, w, 72)
  ctx.fillStyle = '#f6efe2'
  ctx.font = '700 34px "KaiTi", "STKaiti", "Microsoft YaHei", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h * 0.38 + 36)
  ctx.restore()
}
