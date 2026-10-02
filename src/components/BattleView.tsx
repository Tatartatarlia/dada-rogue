import { useEffect, useRef, useState } from 'react'
import { CONFIG } from '../config'
import type { LoadoutItem, WeaponType } from '../types'
import { attackOf, enemyHpForWave, enemySpeedForWave } from '../game/logic'
import { play } from '../game/audio'
import {
  drawBanner,
  drawBattlefield,
  drawBoom,
  drawEnemy,
  drawFloater,
  drawHero,
  drawPotionZone,
  drawProjectile,
} from '../game/draw'
import { WeaponView } from './WeaponView'

interface Enemy {
  id: number
  x: number
  y: number
  hp: number
  maxHp: number
  r: number
  speed: number
  burn: number
  burnDps: number
  burnText: number
  flash: number
  hue: number
  phase: number
}

interface Proj {
  id: number
  type: WeaponType
  x: number
  y: number
  vx: number
  vy: number
  heading: number
  spin: number
  tumble: number
  damage: number
  r: number
  life: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
}

interface Floater {
  x: number
  y: number
  vy: number
  text: string
  life: number
  max: number
  color: string
}

interface Zone {
  x: number
  y: number
  r: number
  life: number
  max: number
}

interface Boom {
  x: number
  y: number
  r: number
  life: number
  max: number
  color: string
}

function tumbleOf(type: WeaponType): number {
  if (type === 'axe') return 11
  if (type === 'bomb') return 8
  if (type === 'molotov') return 5
  return 0
}

function boomColor(type: WeaponType): string {
  if (type === 'bomb') return 'rgba(255, 198, 92, 0.95)'
  if (type === 'molotov') return 'rgba(255, 122, 48, 0.95)'
  if (type === 'potion') return 'rgba(188, 140, 255, 0.95)'
  return 'rgba(255,255,255,0.8)'
}

export function BattleView({
  wave,
  loadout,
  hero,
  best,
  muted,
  onToggleMute,
  onWin,
  onLose,
  onSettle,
}: {
  wave: number
  loadout: LoadoutItem[]
  hero: HTMLImageElement | null
  best: number
  muted: boolean
  onToggleMute: () => void
  onWin: () => void
  onLose: () => void
  onSettle: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const hpLabelRef = useRef<HTMLSpanElement>(null)
  const hpFillRef = useRef<HTMLDivElement>(null)
  const hpBarRef = useRef<HTMLDivElement>(null)
  const remainRef = useRef<HTMLSpanElement>(null)
  const killRef = useRef<HTMLSpanElement>(null)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const heroRef = useRef(hero)
  const onWinRef = useRef(onWin)
  const onLoseRef = useRef(onLose)
  const settledRef = useRef(false)

  useEffect(() => {
    pausedRef.current = paused
    heroRef.current = hero
    onWinRef.current = onWin
    onLoseRef.current = onLose
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let alive = true
    let raf = 0
    let last = performance.now()
    let time = 0
    let hp = CONFIG.playerMaxHp
    let spawned = 0
    let spawnTimer = CONFIG.spawnDelay
    let killed = 0
    let shake = 0
    let hurt = 0
    let ended = false
    let reported = false
    let endTimer = 0
    let endKind: 'win' | 'lose' | null = null
    let serial = 1
    let viewW = 1
    let viewH = 1
    let dpr = 1
    const enemies: Enemy[] = []
    const projs: Proj[] = []
    const parts: Particle[] = []
    const floats: Floater[] = []
    const booms: Boom[] = []
    const zones: Zone[] = []

    const guns = loadout.map((item, index) => ({
      type: item.type,
      damage: attackOf(item.type, item.level),
      interval: CONFIG.weapons[item.type].interval,
      cooldown: CONFIG.weapons[item.type].interval * (index / Math.max(1, loadout.length)) * 0.8,
      slot: index,
    }))

    const resize = () => {
      const rect = stage.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      viewW = Math.max(1, rect.width)
      viewH = Math.max(1, rect.height)
      canvas.width = Math.round(viewW * dpr)
      canvas.height = Math.round(viewH * dpr)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)

    const layout = () => {
      const image = heroRef.current
      const aspect = image && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 1593 / 1751
      let heroH = Math.min(viewH * CONFIG.heroHeightRatio, 460)
      let heroW = heroH * aspect
      if (viewW < CONFIG.heroNarrowWidth && heroW > viewW * CONFIG.heroMaxWidthRatio) {
        heroW = viewW * CONFIG.heroMaxWidthRatio
        heroH = heroW / aspect
      }
      const heroX = viewW * CONFIG.heroXRatio
      const groundBot = viewH * CONFIG.groundBotRatio
      const heroY = groundBot - heroH * 0.92
      return {
        heroH,
        heroW,
        heroX,
        heroY,
        hurtX: heroX + heroW * CONFIG.hurtLineRatio,
        handX: heroX + heroW * 0.68,
        handY: heroY + heroH * 0.5,
      }
    }

    const floatText = (x: number, y: number, text: string, color: string) => {
      floats.push({ x, y, vy: -36, text, life: 0.7, max: 0.7, color })
      if (floats.length > 36) floats.splice(0, floats.length - 36)
    }

    const burst = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2
        const speed = 40 + Math.random() * 110
        parts.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.28 + Math.random() * 0.25,
          max: 0.5,
          color,
          size: 2 + Math.random() * 2.4,
        })
      }
      if (parts.length > 200) parts.splice(0, parts.length - 200)
    }

    const held = (enemy: Enemy) => {
      for (const zone of zones) {
        const dx = enemy.x - zone.x
        const dy = enemy.y - zone.y
        if (dx * dx + dy * dy <= zone.r * zone.r) return true
      }
      return false
    }

    const amplify = (enemy: Enemy, amount: number) =>
      held(enemy) ? Math.max(1, Math.round(amount * CONFIG.potionDamageTaken)) : amount

    const closest = () => {
      let best: Enemy | null = null
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue
        if (!best || enemy.x < best.x) best = enemy
      }
      return best
    }

    const update = (dt: number) => {
      if (settledRef.current) return
      if (ended) {
        endTimer -= dt
        if (endTimer <= 0 && !reported) {
          reported = true
          if (endKind === 'win') onWinRef.current()
          else onLoseRef.current()
        }
        return
      }

      time += dt
      shake = Math.max(0, shake - dt * 1.8)
      hurt = Math.max(0, hurt - dt)
      const place = layout()

      if (spawned < CONFIG.enemyCount) {
        spawnTimer -= dt
        if (spawnTimer <= 0) {
          const top = viewH * CONFIG.groundTopRatio + CONFIG.enemyRadius
          const bot = viewH * CONFIG.groundBotRatio - CONFIG.enemyRadius
          const maxHp = enemyHpForWave(wave)
          const jitter = 1 + (Math.random() * 2 - 1) * CONFIG.enemySpeedJitter
          enemies.push({
            id: serial,
            x: viewW + 30,
            y: top + Math.random() * Math.max(12, bot - top),
            hp: maxHp,
            maxHp,
            r: CONFIG.enemyRadius + Math.min(8, wave * 0.4),
            speed: enemySpeedForWave(wave) * jitter,
            burn: 0,
            burnDps: 0,
            burnText: 0.3,
            flash: 0,
            hue: (210 - (wave - 1) * 14 + 3600) % 360,
            phase: Math.random() * Math.PI * 2,
          })
          serial += 1
          spawned += 1
          spawnTimer = CONFIG.spawnInterval
        }
      }

      for (const gun of guns) {
        gun.cooldown -= dt
        if (gun.cooldown > 0) continue
        const target = closest()
        if (!target) {
          gun.cooldown = 0
          continue
        }
        const spread = (gun.slot - (guns.length - 1) / 2) * 14
        const sx = place.handX
        const sy = place.handY + spread
        const dx = target.x - sx
        const dy = target.y - sy
        const dist = Math.hypot(dx, dy) || 1
        const speed = CONFIG.projectileSpeed[gun.type]
        projs.push({
          id: serial,
          type: gun.type,
          x: sx,
          y: sy,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          heading: Math.atan2(dy, dx),
          spin: 0,
          tumble: tumbleOf(gun.type),
          damage: gun.damage,
          r: CONFIG.projectileRadius,
          life: CONFIG.projectileLife,
        })
        serial += 1
        gun.cooldown = gun.interval
        play('throw')
      }

      for (let i = projs.length - 1; i >= 0; i -= 1) {
        const proj = projs[i]
        if (!proj) continue
        proj.x += proj.vx * dt
        proj.y += proj.vy * dt
        proj.spin += proj.tumble * dt
        proj.life -= dt
        if (proj.life <= 0 || proj.x > viewW + 80 || proj.y < -80 || proj.y > viewH + 80) {
          projs.splice(i, 1)
          continue
        }
        let hit = false
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue
          const dx = enemy.x - proj.x
          const dy = enemy.y - proj.y
          const reach = enemy.r + proj.r * 0.65
          if (dx * dx + dy * dy > reach * reach) continue
          if (proj.type === 'potion') {
            zones.push({
              x: proj.x,
              y: proj.y,
              r: CONFIG.potionRadius,
              life: CONFIG.slowDuration,
              max: CONFIG.slowDuration,
            })
          }
          const damage = amplify(enemy, proj.damage)
          enemy.hp -= damage
          enemy.flash = 0.12
          floatText(enemy.x, enemy.y - enemy.r - 8, String(damage), '#fff6d8')
          burst(proj.x, proj.y, boomColor(proj.type), 6)
          play('hit')
          if (proj.type === 'molotov') {
            enemy.burn = Math.max(enemy.burn, CONFIG.burnDuration)
            enemy.burnDps = Math.max(enemy.burnDps, proj.damage * CONFIG.burnRatio)
          }
          if (proj.type === 'bomb') {
            for (const other of enemies) {
              if (other.id === enemy.id || other.hp <= 0) continue
              const ox = other.x - proj.x
              const oy = other.y - proj.y
              if (ox * ox + oy * oy > CONFIG.bombSplashRadius ** 2) continue
              const splash = amplify(other, Math.max(1, Math.round(proj.damage * CONFIG.bombSplashRatio)))
              other.hp -= splash
              other.flash = 0.1
              floatText(other.x, other.y - other.r, String(splash), '#ffd48a')
            }
          }
          booms.push({
            x: proj.x,
            y: proj.y,
            r: proj.type === 'bomb' ? CONFIG.bombSplashRadius : 34,
            life: 0.22,
            max: 0.22,
            color: boomColor(proj.type),
          })
          hit = true
          break
        }
        if (hit) projs.splice(i, 1)
      }

      for (const enemy of enemies) {
        if (enemy.burn > 0 && enemy.hp > 0) {
          const amp = held(enemy) ? CONFIG.potionDamageTaken : 1
          enemy.hp -= enemy.burnDps * amp * dt
          enemy.burn -= dt
          enemy.burnText -= dt
          if (enemy.burnText <= 0) {
            enemy.burnText = 0.5
            floatText(enemy.x, enemy.y - enemy.r, `-${Math.max(1, Math.round(enemy.burnDps * amp * 0.5))}`, '#ff9a4a')
          }
        } else if (enemy.burn < 0) {
          enemy.burn = 0
        }
        if (enemy.flash > 0) enemy.flash -= dt
      }

      for (let i = zones.length - 1; i >= 0; i -= 1) {
        const zone = zones[i]
        if (!zone) continue
        zone.life -= dt
        if (zone.life <= 0) zones.splice(i, 1)
      }

      for (let i = enemies.length - 1; i >= 0; i -= 1) {
        const enemy = enemies[i]
        if (!enemy) continue
        if (enemy.hp <= 0) {
          killed += 1
          burst(enemy.x, enemy.y, `hsl(${enemy.hue} 70% 60%)`, 10)
          enemies.splice(i, 1)
          continue
        }
        const pace = held(enemy) ? CONFIG.slowFactor : 1
        const widthScale = Math.min(1, viewW / CONFIG.enemySpeedReferenceWidth)
        enemy.x -= enemy.speed * pace * widthScale * dt
        if (enemy.x - enemy.r <= place.hurtX) {
          hp -= CONFIG.enemyContactDamage
          hurt = 0.45
          shake = Math.min(1, shake + 0.75)
          floatText(place.hurtX + 20, enemy.y, `-${CONFIG.enemyContactDamage}`, '#ff5d73')
          play('hurt')
          enemies.splice(i, 1)
        }
      }

      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const particle = parts[i]
        if (!particle) continue
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
        particle.life -= dt
        if (particle.life <= 0) parts.splice(i, 1)
      }
      for (let i = floats.length - 1; i >= 0; i -= 1) {
        const item = floats[i]
        if (!item) continue
        item.y += item.vy * dt
        item.life -= dt
        if (item.life <= 0) floats.splice(i, 1)
      }
      for (let i = booms.length - 1; i >= 0; i -= 1) {
        const boom = booms[i]
        if (!boom) continue
        boom.life -= dt
        if (boom.life <= 0) booms.splice(i, 1)
      }

      const shown = Math.max(0, Math.ceil(hp))
      if (hpLabelRef.current) hpLabelRef.current.textContent = `${shown}`
      if (hpFillRef.current) hpFillRef.current.style.width = `${(shown / CONFIG.playerMaxHp) * 100}%`
      hpBarRef.current?.classList.toggle('danger', shown > 0 && shown / CONFIG.playerMaxHp <= 0.3)
      const aliveCount = enemies.reduce((sum, enemy) => sum + (enemy.hp > 0 ? 1 : 0), 0)
      const waiting = CONFIG.enemyCount - spawned
      if (remainRef.current) remainRef.current.textContent = `${aliveCount + waiting}`
      if (killRef.current) killRef.current.textContent = `${killed}`

      if (hp <= 0) {
        hp = 0
        ended = true
        endKind = 'lose'
        endTimer = CONFIG.endDelay
        play('lose')
        return
      }
      if (spawned >= CONFIG.enemyCount && enemies.length === 0) {
        ended = true
        endKind = 'win'
        endTimer = CONFIG.endDelay
        play('win')
      }
    }

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, viewW, viewH)
      const mag = shake * 10
      ctx.save()
      if (mag > 0.2) ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag)
      drawBattlefield(ctx, viewW, viewH, time)
      for (const zone of zones) drawPotionZone(ctx, zone.x, zone.y, zone.r, zone.life, zone.max, time)
      const place = layout()
      if (time < CONFIG.spawnDelay + 0.2) {
        ctx.save()
        ctx.strokeStyle = 'rgba(255, 93, 115, 0.45)'
        ctx.setLineDash([6, 6])
        ctx.beginPath()
        ctx.moveTo(place.hurtX, viewH * CONFIG.groundTopRatio)
        ctx.lineTo(place.hurtX, viewH * CONFIG.groundBotRatio)
        ctx.stroke()
        ctx.restore()
      }
      for (const enemy of enemies) {
        drawEnemy(ctx, { ...enemy, wave, held: held(enemy) }, time)
      }
      drawHero(ctx, heroRef.current, place.heroX, place.heroY, place.heroW, place.heroH, time, hurt)
      for (const proj of projs) {
        drawProjectile(ctx, proj.type, proj.x, proj.y, proj.heading, proj.spin, proj.r)
      }
      for (const boom of booms) drawBoom(ctx, boom.x, boom.y, boom.r, boom.life, boom.max, boom.color)
      for (const particle of parts) {
        ctx.globalAlpha = Math.max(0, particle.life / particle.max)
        ctx.fillStyle = particle.color
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
      for (const item of floats) {
        drawFloater(ctx, item.x, item.y, item.text, item.life / item.max, item.color)
      }
      if (!ended && time < CONFIG.spawnDelay + 0.45) {
        drawBanner(ctx, viewW, viewH, `第 ${wave} 波`, Math.min(1, (CONFIG.spawnDelay + 0.45 - time) / 0.35))
      } else if (ended && endKind === 'win') {
        drawBanner(ctx, viewW, viewH, '这一波清完了', 1)
      } else if (ended && endKind === 'lose') {
        drawBanner(ctx, viewW, viewH, '达达利亚倒下了', 1)
      }
      if (hp / CONFIG.playerMaxHp <= 0.3 && hp > 0) {
        const alpha = 0.16 + Math.sin(time * 6) * 0.05
        const vignette = ctx.createRadialGradient(viewW * 0.3, viewH * 0.6, viewW * 0.2, viewW * 0.4, viewH * 0.6, viewW * 0.72)
        vignette.addColorStop(0, 'rgba(255,0,40,0)')
        vignette.addColorStop(1, `rgba(90, 0, 20, ${alpha})`)
        ctx.fillStyle = vignette
        ctx.fillRect(0, 0, viewW, viewH)
      }
      ctx.restore()
    }

    const frame = (now: number) => {
      if (!alive) return
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      if (!pausedRef.current) update(dt)
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [loadout, wave])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPaused((value) => !value)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section className="battle">
      <header className="hud">
        <div className="who">
          <b>达达利亚</b>
          <div className="hp-track" ref={hpBarRef}>
            <div className="hp-fill" ref={hpFillRef} style={{ width: '100%' }} />
          </div>
          <span ref={hpLabelRef}>{CONFIG.playerMaxHp}</span>
          <span className="quiet">/ {CONFIG.playerMaxHp}</span>
        </div>
        <div className="wave-readout">
          <span>第 {wave} 波</span>
          <span>
            剩余 <b ref={remainRef}>{CONFIG.enemyCount}</b>
          </span>
          <span>
            击破 <b ref={killRef}>0</b>
          </span>
          <span className="quiet">最高 {best} 波</span>
        </div>
        <div className="chips">
          {loadout.length === 0 && <span className="quiet">背包是空的</span>}
          {loadout.map((item, index) => (
            <WeaponView key={`${item.type}-${item.level}-${index}`} type={item.type} level={item.level} rotation={0} cell={26} />
          ))}
        </div>
        <button type="button" className="text-btn" onClick={onToggleMute}>
          {muted ? '声音关' : '声音开'}
        </button>
        <button type="button" className="text-btn" onClick={() => setPaused(true)}>
          暂停
        </button>
      </header>
      <div className="stage" ref={stageRef}>
        <canvas ref={canvasRef} />
      </div>
      {paused && (
        <div className="pause">
          <div className="pause-card">
            <h2>暂停</h2>
            <p>第 {wave} 波。结算会记下这次到达的波数。</p>
            <button type="button" className="primary" onClick={() => setPaused(false)}>
              继续
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                settledRef.current = true
                onSettle()
              }}
            >
              结算
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
