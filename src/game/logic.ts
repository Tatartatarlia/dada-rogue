import { CONFIG } from '../config'
import type { Cell, Expansion, Weapon, WeaponType } from '../types'

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
  const retain = CONFIG.mergeRetain
  let attack = CONFIG.weapons[type].attack
  for (let i = 1; i < level; i += 1) {
    const sum = attack * 2
    const next = Math.round(sum * retain)
    attack = Math.max(1, Math.min(next, sum - 1))
  }
  return attack
}

export function weaponDps(type: WeaponType, level: number): number {
  const attack = attackOf(type, level)
  const interval = CONFIG.weapons[type].interval
  const extra = type === 'molotov' ? attack * CONFIG.burnRatio * CONFIG.burnDuration : 0
  return (attack + extra) / interval
}

export function effectText(type: WeaponType): string {
  switch (type) {
    case 'axe':
    case 'dart':
    case 'sword':
      return '间隔短，单下伤害偏低'
    case 'bomb':
      return `溅射 ${Math.round(CONFIG.bombSplashRatio * 100)}%`
    case 'molotov':
      return `燃烧 ${CONFIG.burnDuration.toFixed(1)} 秒`
    case 'potion':
      return `移速 ${Math.round(CONFIG.slowFactor * 100)}%，受伤 +${Math.round((CONFIG.potionDamageTaken - 1) * 100)}%`
  }
}

export function enemyHpForWave(wave: number): number {
  const linear = 1 + CONFIG.enemyHpLinear * wave
  return Math.max(1, Math.round(CONFIG.enemyBaseHp * linear * CONFIG.enemyHpExponent ** wave))
}

export function enemySpeedForWave(wave: number): number {
  return CONFIG.enemySpeed + Math.min(wave * CONFIG.enemySpeedPerWave, CONFIG.enemySpeedBonusMax)
}

let seq = 1
export function uid(prefix: string): string {
  seq += 1
  return `${prefix}_${seq}_${Math.random().toString(36).slice(2, 6)}`
}

export function shopLevelForWave(wave: number): number {
  const bands = CONFIG.shopLevelBands
  const band = bands.find((item) => wave <= item.maxWave) ?? bands[bands.length - 1]
  const weights = band?.weights ?? [1]
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return 1
  let roll = Math.random() * total
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index] ?? 0
    if (roll < 0) return index + 1
  }
  return Math.max(1, weights.length)
}

export function createShopWeapon(wave: number): Weapon {
  const type = WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)] ?? 'dart'
  return {
    id: uid('w'),
    type,
    level: shopLevelForWave(wave),
    rotation: 0,
    x: 0,
    y: 0,
    where: 'shop',
  }
}

export function createExpansion(): Expansion {
  const count: 1 | 2 = Math.random() < CONFIG.expansionPairChance ? 2 : 1
  return { id: uid('ex'), count, rotation: 0 }
}

export function createShop(wave: number): { weapons: Weapon[]; expansion: Expansion } {
  return {
    weapons: Array.from({ length: CONFIG.shopWeaponCount }, () => createShopWeapon(wave)),
    expansion: createExpansion(),
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

export function canAttach(cells: Cell[], count: 1 | 2, rotation: number, anchor: Cell): boolean {
  const owned = new Set(cells.map(keyOf))
  const piece = expansionShape(count, rotation).map((part) => ({
    x: part.x + anchor.x,
    y: part.y + anchor.y,
  }))
  if (piece.some((part) => owned.has(keyOf(part)))) return false
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

export function tryAutoAttach(cells: Cell[], expansion: Expansion): Cell[] | null {
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
        if (!canAttach(cells, expansion.count, rotation, { x, y })) continue
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
}): { weapons: Weapon[]; mergedLevel?: number } | null {
  const { weapons, weapon, rotation, anchor, cursor, shopTargetId } = args

  const mergeInto = (target: Weapon) => ({
    weapons: weapons
      .filter((item) => item.id !== weapon.id)
      .map((item) => (item.id === target.id ? { ...item, level: item.level + 1 } : item)),
    mergedLevel: target.level + 1,
  })

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
