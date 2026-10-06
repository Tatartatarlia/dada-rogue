import { CONFIG } from '../config'
import type { Cell, Difficulty, Expansion, GameMode, Weapon, WeaponType } from '../types'

export const WEAPON_TYPES: WeaponType[] = ['axe', 'dart', 'sword', 'molotov', 'bomb', 'potion']

/**
 * 旋转 0 的占格。y 向下。
 * 斧头：第一排 2 格，第二排 1 格
 * 飞镖：1 格
 * 短剑 / 燃烧瓶：2 格
 * 炸弹：2×2
 * 虚弱药剂：第一排 1 格，第二排 2 格
 */
const BASE_SHAPES: Record<WeaponType, Cell[]> = {
  axe: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ],
  dart: [{ x: 0, y: 0 }],
  sword: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
  ],
  molotov: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
  ],
  bomb: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  potion: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
}

export function keyOf(cell: Cell): string {
  return `${cell.x},${cell.y}`
}

export function rotateCells(cells: Cell[]): Cell[] {
  let minX = Infinity
  let minY = Infinity
  const rotated = cells.map((cell) => {
    const next = { x: cell.y, y: -cell.x }
    minX = Math.min(minX, next.x)
    minY = Math.min(minY, next.y)
    return next
  })
  return rotated.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }))
}

/** 把形状里的一个格子映射到下一档旋转，归一化和 rotateCells 一致 */
export function mapRotate(cells: Cell[], point: Cell): Cell {
  let minX = Infinity
  let minY = Infinity
  for (const cell of cells) {
    minX = Math.min(minX, cell.y)
    minY = Math.min(minY, -cell.x)
  }
  return { x: point.y - minX, y: -point.x - minY }
}

export function shapeOf(type: WeaponType, rotation: number): Cell[] {
  let cells = BASE_SHAPES[type].map((cell) => ({ ...cell }))
  const turns = ((rotation % 4) + 4) % 4
  for (let i = 0; i < turns; i += 1) cells = rotateCells(cells)
  return cells
}

export function expansionShape(count: 1 | 2, rotation: number): Cell[] {
  let cells: Cell[] = count === 2 ? [{ x: 0, y: 0 }, { x: 1, y: 0 }] : [{ x: 0, y: 0 }]
  const turns = ((rotation % 4) + 4) % 4
  for (let i = 0; i < turns; i += 1) cells = rotateCells(cells)
  return cells
}

export function worldCells(weapon: Pick<Weapon, 'type' | 'rotation' | 'x' | 'y'>): Cell[] {
  return shapeOf(weapon.type, weapon.rotation).map((cell) => ({
    x: cell.x + weapon.x,
    y: cell.y + weapon.y,
  }))
}

export function attackOf(type: WeaponType, level: number): number {
  const factor = CONFIG.mergeMultiplier
  let attack = CONFIG.weapons[type].attack
  for (let i = 1; i < level; i += 1) {
    attack = Math.max(1, Math.round(attack * 2 * factor))
  }
  return attack
}

/** 等级攻击力，再加上武器自己带着的额外攻击。 */
export function weaponAttack(weapon: Pick<Weapon, 'type' | 'level' | 'bonusAttack'>): number {
  return attackOf(weapon.type, weapon.level) + (weapon.bonusAttack ?? 0)
}

/** 暴击率和暴击伤害加成。highestLevel 是背包里最高的武器等级。 */
export function critStats(highestLevel: number): { rate: number; bonus: number } {
  const level = Math.max(0, highestLevel)
  let rate = CONFIG.critRateBase + level * CONFIG.critRatePerLevel
  let bonus = CONFIG.critDamageBase + level * CONFIG.critDamagePerLevel
  if (rate > 1) {
    bonus += (rate - 1) * CONFIG.critOverflowRatio
    rate = 1
  }
  return { rate, bonus }
}

/** 按背包最高等级掷一次暴击。倍率是 1，或 1 + 暴击伤害。 */
export function rollCrit(highestLevel: number): { multiplier: number; crit: boolean } {
  const stats = critStats(highestLevel)
  if (stats.rate <= 0 || Math.random() >= stats.rate) return { multiplier: 1, crit: false }
  return { multiplier: 1 + stats.bonus, crit: true }
}

export function weaponDps(type: WeaponType, level: number, highestLevel: number, bonusAttack = 0, intervalScale = 1): number {
  const attack = attackOf(type, level) + bonusAttack
  const interval = CONFIG.weapons[type].interval * intervalScale
  const burnTime = molotovDuration(level)
  const extra = type === 'molotov' ? attack * CONFIG.burnRatio * burnTime : 0
  const crit = critStats(highestLevel)
  return ((attack + extra) / interval) * (1 + crit.rate * crit.bonus)
}

export function dartTargets(level: number): number {
  if (level >= 4) return CONFIG.dartTargets4
  if (level >= 2) return CONFIG.dartTargets2
  return 1
}

export function swordCombo(level: number): { hits: number; chance: number } | null {
  if (level < 2) return null
  if (level >= 4) return { hits: CONFIG.swordComboHits4, chance: CONFIG.swordComboChance4 }
  return { hits: CONFIG.swordComboHits2, chance: CONFIG.swordComboChance }
}

export function axeSplash(level: number): { count: number; min: number; max: number } | null {
  if (level < 2) return null
  if (level >= 4) {
    return { count: CONFIG.axeSplashCount4, min: CONFIG.axeSplashMin4, max: CONFIG.axeSplashMax4 }
  }
  return { count: CONFIG.axeSplashCount2, min: CONFIG.axeSplashMin, max: CONFIG.axeSplashMax }
}

export function bombRadius(level: number): number {
  if (level >= 2) return CONFIG.bombSplashRadius * CONFIG.bombRadiusScale
  return CONFIG.bombSplashRadius
}

export function molotovDuration(level: number): number {
  if (level >= 2) return CONFIG.burnDuration * CONFIG.molotovDurationScale
  return CONFIG.burnDuration
}

export function potionRadius(level: number): number {
  if (level >= 2) return CONFIG.potionRadius * CONFIG.potionRadiusScale
  return CONFIG.potionRadius
}

export function potionSlow(level: number): number {
  return level >= 4 ? CONFIG.slowFactor4 : CONFIG.slowFactor
}

export function potionVulnerability(level: number): number {
  return level >= 4 ? CONFIG.potionDamageTaken4 : CONFIG.potionDamageTaken
}

export function effectText(type: WeaponType, level: number): string {
  return effectDetail(type, level)
}

function effectDetail(type: WeaponType, level: number): string {
  switch (type) {
    case 'dart':
      if (level >= 4) return `同时扔向 ${dartTargets(level)} 个目标`
      if (level >= 2) return `同时扔向 ${dartTargets(level)} 个目标，4 级扔向 ${CONFIG.dartTargets4} 个`
      return `2 级同时扔向 ${CONFIG.dartTargets2} 个目标，4 级扔向 ${CONFIG.dartTargets4} 个`
    case 'sword': {
      const combo = swordCombo(level)
      if (level >= 4 && combo) return `${Math.round(combo.chance * 100)}% 概率连打 ${combo.hits} 下`
      if (combo) return `${Math.round(combo.chance * 100)}% 概率连打 ${combo.hits} 下，4 级连打 ${CONFIG.swordComboHits4} 下`
      return `2 级 ${Math.round(CONFIG.swordComboChance * 100)}% 概率连打 ${CONFIG.swordComboHits2} 下，4 级连打 ${CONFIG.swordComboHits4} 下`
    }
    case 'axe': {
      const splash = axeSplash(level)
      if (level >= 4 && splash) {
        return `溅射 ${splash.count} 人，伤害 ${Math.round(splash.min * 100)}%–${Math.round(splash.max * 100)}%`
      }
      if (splash) {
        return `溅射 ${splash.count} 人，4 级溅射 ${CONFIG.axeSplashCount4} 人且伤害更高`
      }
      return `2 级溅射 ${CONFIG.axeSplashCount2} 人，4 级溅射 ${CONFIG.axeSplashCount4} 人`
    }
    case 'bomb':
      if (level >= 4) return `爆炸范围更大，并留下 ${CONFIG.bombBurnDuration.toFixed(1)} 秒燃烧`
      if (level >= 2) return `爆炸范围扩大，4 级留下燃烧区域`
      return `溅射 ${Math.round(CONFIG.bombSplashRatio * 100)}%，2 级范围扩大，4 级留下燃烧`
    case 'molotov':
      if (level >= 4) return `燃烧 ${molotovDuration(level).toFixed(1)} 秒，伤害可叠加`
      if (level >= 2) return `燃烧 ${molotovDuration(level).toFixed(1)} 秒，4 级伤害可叠加`
      return `燃烧 ${CONFIG.burnDuration.toFixed(1)} 秒，2 级更久，4 级可叠加`
    case 'potion':
      if (level >= 4) {
        return `移速 ${Math.round(potionSlow(level) * 100)}%，受伤 +${Math.round((potionVulnerability(level) - 1) * 100)}%`
      }
      if (level >= 2) return `药雾更大，移速 ${Math.round(CONFIG.slowFactor * 100)}%，受伤 +${Math.round((CONFIG.potionDamageTaken - 1) * 100)}%。4 级更强`
      return `移速 ${Math.round(CONFIG.slowFactor * 100)}%，受伤 +${Math.round((CONFIG.potionDamageTaken - 1) * 100)}%。2 级雾更大，4 级更强`
  }
}

export function enemyHpForWave(wave: number, exponent: number): number {
  const linear = 1 + CONFIG.enemyHpLinear * wave
  return Math.max(1, Math.round(CONFIG.enemyBaseHp * linear * exponent ** wave))
}

export function hpExponentFor(mode: GameMode, difficulty: Difficulty | null): number {
  if (mode === 'trial') return CONFIG.trialHpExponent
  if (difficulty === 'hard') return CONFIG.endlessHpExponent.hard
  if (difficulty === 'normal') return CONFIG.endlessHpExponent.normal
  return CONFIG.endlessHpExponent.easy
}

export function enemySpeedForWave(wave: number): number {
  return CONFIG.enemySpeed + Math.min(wave * CONFIG.enemySpeedPerWave, CONFIG.enemySpeedBonusMax)
}

let seq = 1
export function uid(prefix: string): string {
  seq += 1
  return `${prefix}_${seq}_${Math.random().toString(36).slice(2, 6)}`
}

/** 20 波之后商店能出现的最高等级。更早的波数返回 null，表示仍按档位原样抽。 */
export function shopLevelCap(wave: number, bagHighest: number): number | null {
  if (wave <= CONFIG.shopBagCapAfterWave) return null
  return Math.max(CONFIG.shopMinLevelCap, bagHighest - CONFIG.shopBagLevelGap)
}

function rollBandLevel(weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return 1
  let roll = Math.random() * total
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index] ?? 0
    if (roll < 0) return index + 1
  }
  return Math.max(1, weights.length)
}

export function shopLevelForWave(wave: number, bagHighest = 0): number {
  const bands = CONFIG.shopLevelBands
  const band = bands.find((item) => wave <= item.maxWave) ?? bands[bands.length - 1]
  const weights = band?.weights ?? [1]
  const rolled = rollBandLevel(weights)
  const cap = shopLevelCap(wave, bagHighest)
  if (cap == null) return rolled
  const shift = Math.max(0, cap - weights.length)
  return Math.min(cap, rolled + shift)
}

export function highestBagLevel(weapons: Weapon[]): number {
  return weapons.reduce((max, weapon) => (weapon.where === 'bag' ? Math.max(max, weapon.level) : max), 0)
}

export function createShopWeapon(wave: number, bagHighest = 0): Weapon {
  const type = WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)] ?? 'dart'
  return {
    id: uid('w'),
    type,
    level: shopLevelForWave(wave, bagHighest),
    rotation: 0,
    x: 0,
    y: 0,
    where: 'shop',
  }
}

/** 这一波商店是否赠送 1 格空位。1–20 每波，21–40 每 2 波，41 起每 3 波。 */
export function grantsCell(wave: number): boolean {
  if (wave <= CONFIG.expansionEarlyThrough) return true
  if (wave <= CONFIG.expansionMidThrough) {
    return (wave - CONFIG.expansionEarlyThrough) % CONFIG.expansionMidInterval === 0
  }
  return (wave - CONFIG.expansionMidThrough) % CONFIG.expansionLateInterval === 0
}

export function createExpansion(wave: number): Expansion | null {
  if (!grantsCell(wave)) return null
  return { id: uid('ex'), count: 1, rotation: 0 }
}

/**
 * 第一波三件货按类型名排序后，这些组合在 3×3 背包里没有稳过的拿法。
 * 对应目前 1 级武器：没有炸弹，又拿燃烧瓶当主力（燃烧不能叠加），或者只有飞镖、短剑这种打最前排太慢的搭配。
 */
const OPENING_UNWINNABLE = new Set([
  'axe+molotov+molotov',
  'dart+dart+dart',
  'dart+dart+molotov',
  'dart+molotov+molotov',
  'dart+sword+molotov',
  'molotov+molotov+molotov',
  'molotov+molotov+potion',
  'sword+molotov+molotov',
])

function openingOfferKey(types: WeaponType[]): string {
  return [...types]
    .sort((a, b) => WEAPON_TYPES.indexOf(a) - WEAPON_TYPES.indexOf(b))
    .join('+')
}

function createShopWeapons(wave: number, bagHighest: number): Weapon[] {
  const count = CONFIG.shopWeaponCount
  const roll = () => Array.from({ length: count }, () => createShopWeapon(wave, bagHighest))
  if (wave !== 1 || count !== 3) return roll()
  const limit = CONFIG.openingShopRerolls
  for (let attempt = 0; attempt < limit; attempt += 1) {
    const weapons = roll()
    if (!OPENING_UNWINNABLE.has(openingOfferKey(weapons.map((weapon) => weapon.type)))) return weapons
  }
  const weapons = roll()
  const bomb = createShopWeapon(wave, bagHighest)
  bomb.type = 'bomb'
  weapons[0] = bomb
  return weapons
}

export function createShop(wave: number, bagHighest = 0): { weapons: Weapon[]; expansion: Expansion | null } {
  return {
    weapons: createShopWeapons(wave, bagHighest),
    expansion: createExpansion(wave),
  }
}

/** 这批商店武器只要有一件被装进背包、被合成掉，或因此升了级，就不能刷新。 */
export function shopOfferUsed(weapons: Weapon[], offer: { id: string; level: number }[]): boolean {
  return offer.some((item) => {
    const weapon = weapons.find((candidate) => candidate.id === item.id)
    return !weapon || weapon.where !== 'shop' || weapon.level !== item.level
  })
}

export function initialCells(): Cell[] {
  const cells: Cell[] = []
  for (let y = 0; y < CONFIG.backpackRows; y += 1) {
    for (let x = 0; x < CONFIG.backpackCols; x += 1) {
      cells.push({ x, y })
    }
  }
  return cells
}

export function weaponAt(weapons: Weapon[], cell: Cell): Weapon | undefined {
  return weapons.find(
    (weapon) =>
      weapon.where === 'bag' &&
      worldCells(weapon).some((part) => part.x === cell.x && part.y === cell.y),
  )
}

export function canPlaceWeapon(
  cells: Cell[],
  weapons: Weapon[],
  type: WeaponType,
  rotation: number,
  anchor: Cell,
  ignoreId?: string,
): boolean {
  const owned = new Set(cells.map(keyOf))
  const occupied = new Set<string>()
  for (const weapon of weapons) {
    if (weapon.where !== 'bag' || weapon.id === ignoreId) continue
    for (const part of worldCells(weapon)) occupied.add(keyOf(part))
  }
  const piece = shapeOf(type, rotation).map((part) => ({ x: part.x + anchor.x, y: part.y + anchor.y }))
  return piece.every((part) => owned.has(keyOf(part)) && !occupied.has(keyOf(part)))
}

export function canAttach(
  cells: Cell[],
  count: 1 | 2,
  rotation: number,
  anchor: Cell,
  blocked: Cell[] = [],
): boolean {
  const owned = new Set(cells.map(keyOf))
  const frozen = new Set(blocked.map(keyOf))
  const piece = expansionShape(count, rotation).map((part) => ({
    x: part.x + anchor.x,
    y: part.y + anchor.y,
  }))
  if (piece.some((part) => owned.has(keyOf(part)) || frozen.has(keyOf(part)))) return false
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const
  return piece.some((part) =>
    dirs.some(([dx, dy]) => owned.has(keyOf({ x: part.x + dx, y: part.y + dy }))),
  )
}

export function boundsOf(cells: Cell[], pad: number): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const cell of cells) {
    minX = Math.min(minX, cell.x)
    minY = Math.min(minY, cell.y)
    maxX = Math.max(maxX, cell.x)
    maxY = Math.max(maxY, cell.y)
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
}

function pieceCenter(parts: Cell[]): Cell {
  const x = parts.reduce((sum, part) => sum + part.x, 0) / parts.length
  const y = parts.reduce((sum, part) => sum + part.y, 0) / parts.length
  return { x, y }
}

export function tryAutoPlace(cells: Cell[], weapons: Weapon[], weapon: Weapon): Weapon | null {
  const bounds = boundsOf(cells, 0)
  let best: Weapon | null = null
  let bestDist = Infinity
  const center = pieceCenter(cells)
  for (let rotation = 0; rotation < 4; rotation += 1) {
    const shape = shapeOf(weapon.type, rotation)
    const maxX = Math.max(...shape.map((part) => part.x))
    const maxY = Math.max(...shape.map((part) => part.y))
    for (let y = bounds.minY; y <= bounds.maxY - maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX - maxX; x += 1) {
        if (!canPlaceWeapon(cells, weapons, weapon.type, rotation, { x, y }, weapon.id)) continue
        const placed = shape.map((part) => ({ x: part.x + x, y: part.y + y }))
        const at = pieceCenter(placed)
        const dist = (at.x - center.x) ** 2 + (at.y - center.y) ** 2
        if (dist < bestDist) {
          bestDist = dist
          best = { ...weapon, where: 'bag', rotation, x, y }
        }
      }
    }
  }
  return best
}

export function tryAutoAttach(cells: Cell[], expansion: Expansion, blocked: Cell[] = []): Cell[] | null {
  const bounds = boundsOf(cells, 2)
  const center = pieceCenter(cells)
  let best: Cell[] | null = null
  let bestDist = Infinity
  for (let rotation = 0; rotation < 4; rotation += 1) {
    const shape = expansionShape(expansion.count, rotation)
    const maxX = Math.max(...shape.map((part) => part.x))
    const maxY = Math.max(...shape.map((part) => part.y))
    for (let y = bounds.minY; y <= bounds.maxY - maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX - maxX; x += 1) {
        if (!canAttach(cells, expansion.count, rotation, { x, y }, blocked)) continue
        const added = shape.map((part) => ({ x: part.x + x, y: part.y + y }))
        const at = pieceCenter(added)
        const dist = (at.x - center.x) ** 2 + (at.y - center.y) ** 2
        if (dist < bestDist) {
          bestDist = dist
          best = added
        }
      }
    }
  }
  return best ? [...cells, ...best] : null
}

export function isBagWeaponLegal(cells: Cell[], weapons: Weapon[], weapon: Weapon): boolean {
  return canPlaceWeapon(cells, weapons, weapon.type, weapon.rotation, weapon, weapon.id)
}

/** 绕当前占格转 90 度。转完即使超出背包或互相重叠，也先留在原地。 */
export function rotateInPlace(weapon: Weapon): Weapon {
  const current = shapeOf(weapon.type, weapon.rotation)
  const pivotLocal = current[0]
  if (!pivotLocal) return weapon
  const pivot = { x: weapon.x + pivotLocal.x, y: weapon.y + pivotLocal.y }
  const mapped = mapRotate(current, pivotLocal)
  const nextRotation = (weapon.rotation + 1) % 4
  return {
    ...weapon,
    rotation: nextRotation,
    x: pivot.x - mapped.x,
    y: pivot.y - mapped.y,
  }
}

export function resolveWeaponDrop(args: {
  cells: Cell[]
  weapons: Weapon[]
  weapon: Weapon
  rotation: number
  anchor: Cell
  cursor: Cell | null
  shopTargetId: string | null
  empowered?: boolean
}): { weapons: Weapon[]; mergedLevel?: number; consumedDemon?: boolean } | null {
  const { weapons, weapon, rotation, anchor, cursor, shopTargetId, empowered = false } = args

  const mergeInto = (target: Weapon) => {
    const nextLevel = target.level + 1
    const carried = empowered || (weapon.bonusAttack ?? 0) !== 0 || (target.bonusAttack ?? 0) !== 0
    let bonusAttack: number | undefined
    if (carried) {
      const sum = weaponAttack(weapon) + weaponAttack(target)
      const factor = empowered ? CONFIG.demonMergeMultiplier : CONFIG.mergeMultiplier
      const total = Math.max(1, Math.round(sum * factor))
      const bonus = total - attackOf(target.type, nextLevel)
      if (bonus !== 0) bonusAttack = bonus
    }
    return {
      weapons: weapons
        .filter((item) => item.id !== weapon.id)
        .map((item) => {
          if (item.id !== target.id) return item
          const next: Weapon = { ...item, level: nextLevel }
          delete next.bonusAttack
          if (bonusAttack !== undefined) next.bonusAttack = bonusAttack
          return next
        }),
      mergedLevel: nextLevel,
      consumedDemon: empowered,
    }
  }

  if (shopTargetId && shopTargetId !== weapon.id) {
    const target = weapons.find((item) => item.id === shopTargetId)
    if (target && target.type === weapon.type && target.level === weapon.level) return mergeInto(target)
  }

  if (cursor) {
    const hovered = weapons.find(
      (item) =>
        item.where === 'bag' &&
        item.id !== weapon.id &&
        worldCells(item).some((part) => part.x === cursor.x && part.y === cursor.y),
    )
    if (hovered && hovered.type === weapon.type && hovered.level === weapon.level) return mergeInto(hovered)
  }

  if (cursor) {
    return {
      weapons: weapons.map((item) =>
        item.id === weapon.id ? { ...item, where: 'bag' as const, rotation, x: anchor.x, y: anchor.y } : item,
      ),
    }
  }
  return null
}

function assertShapes(): void {
  const axe = shapeOf('axe', 0)
  const potion = shapeOf('potion', 0)
  const row = (cells: Cell[], y: number) => cells.filter((cell) => cell.y === y).length
  if (axe.length !== 3 || row(axe, 0) !== 2 || row(axe, 1) !== 1) {
    throw new Error('斧头占格应为第一排 2 格、第二排 1 格')
  }
  if (potion.length !== 3 || row(potion, 0) !== 1 || row(potion, 1) !== 2) {
    throw new Error('虚弱药剂占格应为第一排 1 格、第二排 2 格')
  }
  if (shapeOf('bomb', 0).length !== 4 || shapeOf('sword', 0).length !== 2 || shapeOf('dart', 0).length !== 1) {
    throw new Error('武器占格数量不正确')
  }
  if (import.meta.env.DEV) {
    for (const type of WEAPON_TYPES) {
      if (CONFIG.weapons[type].interval > CONFIG.maxAttackInterval) {
        console.warn(`${CONFIG.weapons[type].name} 的攻击间隔超过了 ${CONFIG.maxAttackInterval} 秒`)
      }
    }
  }
}

assertShapes()
