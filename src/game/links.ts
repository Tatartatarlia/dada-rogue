import { CONFIG } from '../config'
import type { Weapon, WeaponLinks, WeaponType } from '../types'
import { bombRadius, keyOf, potionVulnerability, weaponAttack, worldCells } from './logic'

export type LinkId = 'blast' | 'fragile' | 'slowburn' | 'mark' | 'scatter' | 'opening' | 'shock' | 'named'

export interface ActiveLink {
  id: LinkId
  name: string
  pair: string
  text: string
  edges: number
  full: boolean
  axeLocked: boolean
}

interface CatalogEntry {
  id: LinkId
  types: [WeaponType, WeaponType]
  name: string
  minEdges: number
  /** 效果要用到斧头溅射。斧头 2 级起才有溅射 */
  usesAxeSplash?: boolean
  text: (full: boolean) => string
  detail: string
}

function pairKey(a: WeaponType, b: WeaponType): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`
}

const CATALOG: CatalogEntry[] = [
  {
    id: 'blast',
    types: ['molotov', 'bomb'],
    name: '爆燃',
    minEdges: 1,
    text: (full) => (full ? '炸弹打中着火目标时，结算全部剩余燃烧' : '炸弹打中着火目标时，结算一部分剩余燃烧'),
    detail: `燃烧瓶贴着炸弹。炸弹打中还在燃烧的敌人时，把剩余燃烧立刻打出来。贴住一条边打出 ${Math.round(CONFIG.linkDetonate * 100)}%，贴住两条及以上全部打出，然后这段燃烧结束。`,
  },
  {
    id: 'fragile',
    types: ['potion', 'bomb'],
    name: '易爆',
    minEdges: 1,
    text: (full) => (full ? '炸弹的溅射和燃烧区带上药剂的易伤' : '炸弹的溅射和燃烧区带上一半药剂易伤'),
    detail: '虚弱药剂贴着炸弹。炸弹的溅射，以及 4 级留下的燃烧区，再乘药剂的易伤。贴住一条边只用一半加成，贴住两条及以上用完整易伤。',
  },
  {
    id: 'slowburn',
    types: ['potion', 'molotov'],
    name: '慢燃',
    minEdges: 1,
    text: (full) => (full ? '药雾里的燃烧消退得更慢，并吃易伤' : '药雾里的燃烧消退变慢，并吃易伤'),
    detail: `虚弱药剂贴着燃烧瓶。人站在药雾里时，燃烧计时按 ${CONFIG.linkBurnMistRate} 的速度减少；贴住两条及以上时按 ${CONFIG.linkBurnMistRateFull}。雾里原有的易伤仍然生效。`,
  },
  {
    id: 'mark',
    types: ['dart', 'sword'],
    name: '标记',
    minEdges: 1,
    text: (full) => (full ? '飞镖标记前排更久，短剑连斩必中并多 1 下' : '飞镖标记前排，短剑连斩必定打出'),
    detail: `飞镖贴着短剑。飞镖命中最前排时留下标记，短剑打中带标记的人时连斩必定打出；短剑还没到 2 级，也先连打 2 下。贴住一条边标记 ${CONFIG.linkMarkTime} 秒，贴住两条及以上标记 ${CONFIG.linkMarkTimeFull} 秒，并且连斩再多 1 下。`,
  },
  {
    id: 'scatter',
    types: ['axe', 'dart'],
    name: '散镖',
    minEdges: 1,
    usesAxeSplash: true,
    text: (full) => (full ? '斧头溅到的人再吃一发更狠的飞镖' : '斧头溅到的人再吃一发减弱的飞镖'),
    detail: `斧头贴着飞镖。需要斧头达到 2 级才会溅射，这时溅到的每个敌人再吃一发飞镖伤害。贴住一条边是那把飞镖攻击的 ${Math.round(CONFIG.linkScatter * 100)}%，贴住两条及以上是 ${Math.round(CONFIG.linkScatterFull * 100)}%。`,
  },
  {
    id: 'opening',
    types: ['axe', 'sword'],
    name: '破绽',
    minEdges: 2,
    text: () => '斧头每命中一次，短剑下次连斩多 1 下',
    detail: `斧头贴着短剑。只贴一条边没有效果。贴住两条边时，斧头每命中一次，短剑下一次连斩多砍 1 下，最多攒 ${CONFIG.linkSwordGiftCap} 下。`,
  },
  {
    id: 'shock',
    types: ['axe', 'bomb'],
    name: '震波',
    minEdges: 1,
    usesAxeSplash: true,
    text: (full) => (full ? '斧头溅得更远，炸弹出手更慢' : '斧头溅得更远，炸弹出手变慢'),
    detail: `炸弹贴着斧头。需要斧头达到 2 级才会溅射，这时溅射范围额外加上炸弹爆炸半径的 ${Math.round(CONFIG.linkAxeRadiusShare * 100)}%，贴住两条及以上加 ${Math.round(CONFIG.linkAxeRadiusShareFull * 100)}%。作为代价，炸弹的攻击间隔分别变成 ${CONFIG.linkBombSlow} 倍和 ${CONFIG.linkBombSlowFull} 倍，这一项从 1 级起就生效。`,
  },
  {
    id: 'named',
    types: ['potion', 'dart'],
    name: '点名',
    minEdges: 1,
    text: (full) => (full ? '飞镖全部目标优先打药雾里的人' : '飞镖的额外目标优先打药雾里的人'),
    detail: '虚弱药剂贴着飞镖。贴住一条边时，飞镖除了最前排，其余目标优先选药雾里的人。贴住两条及以上时，飞镖的全部目标都优先选药雾里的人。',
  },
]

const BY_PAIR = new Map(CATALOG.map((entry) => [pairKey(entry.types[0], entry.types[1]), entry]))

export function linkCatalog(): CatalogEntry[] {
  return CATALOG
}

export function emptyLinks(): WeaponLinks {
  return {
    detonate: 0,
    splashVuln: 1,
    intervalScale: 1,
    burnMistRate: 1,
    markTime: 0,
    comboSure: false,
    comboExtra: 0,
    takeAxeBonus: false,
    giveAxeBonus: false,
    scatterDamage: 0,
    splashRadiusBonus: 0,
    preferMist: 0,
  }
}

function sharedEdges(a: Weapon, b: Weapon): number {
  const owned = new Set(worldCells(b).map(keyOf))
  let count = 0
  for (const cell of worldCells(a)) {
    const neighbors = [
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 },
    ]
    for (const next of neighbors) {
      if (owned.has(keyOf(next))) count += 1
    }
  }
  return count
}

interface Touch {
  entry: CatalogEntry
  edges: number
  other: Weapon
}

function touchesOf(weapon: Weapon, bag: Weapon[]): Touch[] {
  const found: Touch[] = []
  for (const other of bag) {
    if (other.id === weapon.id || other.type === weapon.type) continue
    const entry = BY_PAIR.get(pairKey(weapon.type, other.type))
    if (!entry) continue
    const edges = sharedEdges(weapon, other)
    if (edges < entry.minEdges) continue
    found.push({ entry, edges, other })
  }
  return found
}

function bestTouch(touches: Touch[], id: LinkId): Touch | null {
  let best: Touch | null = null
  for (const touch of touches) {
    if (touch.entry.id !== id) continue
    if (!best || touch.edges > best.edges) best = touch
  }
  return best
}

export function linksFor(weapon: Weapon, bag: Weapon[]): WeaponLinks {
  const links = emptyLinks()
  const touches = touchesOf(weapon, bag)
  const blast = bestTouch(touches, 'blast')
  if (blast && weapon.type === 'bomb') {
    links.detonate = blast.edges >= 2 ? CONFIG.linkDetonateFull : CONFIG.linkDetonate
  }
  const fragile = bestTouch(touches, 'fragile')
  if (fragile && weapon.type === 'bomb') {
    const vuln = potionVulnerability(fragile.other.level)
    const bonus = vuln - 1
    links.splashVuln = fragile.edges >= 2 ? vuln : 1 + bonus * 0.5
  }
  const slow = bestTouch(touches, 'slowburn')
  if (slow && weapon.type === 'molotov') {
    links.burnMistRate = slow.edges >= 2 ? CONFIG.linkBurnMistRateFull : CONFIG.linkBurnMistRate
  }
  const mark = bestTouch(touches, 'mark')
  if (mark && weapon.type === 'dart') {
    links.markTime = mark.edges >= 2 ? CONFIG.linkMarkTimeFull : CONFIG.linkMarkTime
  }
  if (mark && weapon.type === 'sword') {
    links.comboSure = true
    links.comboExtra = mark.edges >= 2 ? 1 : 0
  }
  const scatter = bestTouch(touches, 'scatter')
  if (scatter && weapon.type === 'axe') {
    const ratio = scatter.edges >= 2 ? CONFIG.linkScatterFull : CONFIG.linkScatter
    links.scatterDamage = weaponAttack(scatter.other) * ratio
  }
  const opening = bestTouch(touches, 'opening')
  if (opening && weapon.type === 'axe') links.giveAxeBonus = true
  if (opening && weapon.type === 'sword') links.takeAxeBonus = true
  const shock = bestTouch(touches, 'shock')
  if (shock && weapon.type === 'axe') {
    const share = shock.edges >= 2 ? CONFIG.linkAxeRadiusShareFull : CONFIG.linkAxeRadiusShare
    links.splashRadiusBonus = bombRadius(shock.other.level) * share
  }
  if (shock && weapon.type === 'bomb') {
    links.intervalScale = shock.edges >= 2 ? CONFIG.linkBombSlowFull : CONFIG.linkBombSlow
  }
  const named = bestTouch(touches, 'named')
  if (named && weapon.type === 'dart') links.preferMist = named.edges >= 2 ? 2 : 1
  return links
}

function pairLabel(entry: CatalogEntry): string {
  return `${CONFIG.weapons[entry.types[0]].name} · ${CONFIG.weapons[entry.types[1]].name}`
}

export function activeLinks(bag: Weapon[]): ActiveLink[] {
  const best = new Map<LinkId, ActiveLink>()
  const axeLevel = new Map<LinkId, number>()
  for (const weapon of bag) {
    for (const touch of touchesOf(weapon, bag)) {
      const full = touch.edges >= 2
      const axe = weapon.type === 'axe' ? weapon : touch.other.type === 'axe' ? touch.other : null
      if (axe && touch.entry.usesAxeSplash) {
        axeLevel.set(touch.entry.id, Math.max(axeLevel.get(touch.entry.id) ?? 0, axe.level))
      }
      const current = best.get(touch.entry.id)
      if (current && current.edges >= touch.edges) continue
      best.set(touch.entry.id, {
        id: touch.entry.id,
        name: touch.entry.name,
        pair: pairLabel(touch.entry),
        text: touch.entry.text(full),
        edges: touch.edges,
        full,
        axeLocked: false,
      })
    }
  }
  return CATALOG.flatMap((entry) => {
    const link = best.get(entry.id)
    if (!link) return []
    link.axeLocked = entry.usesAxeSplash === true && (axeLevel.get(entry.id) ?? 0) < 2
    return [link]
  })
}
