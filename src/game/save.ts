import { CONFIG } from '../config'
import { legacyDifficultyLevel } from './logic'
import type { Cell, Expansion, GameMode, Weapon, WeaponType } from '../types'

const WEAPON_TYPES = new Set<WeaponType>(['axe', 'dart', 'sword', 'molotov', 'bomb', 'potion'])

export interface ShopOfferStamp {
  id: string
  level: number
}

/** 打完一波后停在商店里的进度。生命会在下一波开战时回满，所以不单独记录。 */
export interface RunSave {
  version: 1
  wave: number
  cells: Cell[]
  weapons: Weapon[]
  expansion: Expansion | null
  shopRefreshed: boolean
  shopOffer: ShopOfferStamp[]
  frozen: Cell[]
  demonArmed: boolean
  giftExpansion: Expansion | null
  mode: GameMode
  difficulty: number
}

function isCell(value: unknown): value is Cell {
  if (!value || typeof value !== 'object') return false
  const cell = value as Cell
  return Number.isFinite(cell.x) && Number.isFinite(cell.y)
}

function isWeapon(value: unknown): value is Weapon {
  if (!value || typeof value !== 'object') return false
  const weapon = value as Weapon
  return (
    typeof weapon.id === 'string' &&
    WEAPON_TYPES.has(weapon.type) &&
    Number.isInteger(weapon.level) &&
    weapon.level >= 1 &&
    Number.isInteger(weapon.rotation) &&
    weapon.rotation >= 0 &&
    weapon.rotation < 4 &&
    Number.isFinite(weapon.x) &&
    Number.isFinite(weapon.y) &&
    (weapon.where === 'bag' || weapon.where === 'shop') &&
    (weapon.bonusAttack === undefined || Number.isInteger(weapon.bonusAttack)) &&
    (weapon.mark === undefined || weapon.mark === 'rift')
  )
}

function isExpansion(value: unknown): value is Expansion {
  if (!value || typeof value !== 'object') return false
  const expansion = value as Expansion
  return (
    typeof expansion.id === 'string' &&
    (expansion.count === 1 || expansion.count === 2) &&
    Number.isInteger(expansion.rotation) &&
    expansion.rotation >= 0 &&
    expansion.rotation < 4
  )
}

function isOffer(value: unknown): value is ShopOfferStamp {
  if (!value || typeof value !== 'object') return false
  const offer = value as ShopOfferStamp
  return typeof offer.id === 'string' && Number.isInteger(offer.level) && offer.level >= 1
}

export function readSave(): RunSave | null {
  try {
    const raw = localStorage.getItem(CONFIG.saveStorageKey)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<RunSave>
    if (data.version !== 1 || !Number.isInteger(data.wave) || data.wave === undefined || data.wave < 1) return null
    if (!Array.isArray(data.cells) || data.cells.length === 0 || !data.cells.every(isCell)) return null
    if (!Array.isArray(data.weapons) || !data.weapons.every(isWeapon)) return null
    if (data.expansion !== null && !isExpansion(data.expansion)) return null
    if (typeof data.shopRefreshed !== 'boolean') return null
    if (!Array.isArray(data.shopOffer) || !data.shopOffer.every(isOffer)) return null
    if (data.frozen !== undefined && (!Array.isArray(data.frozen) || !data.frozen.every(isCell))) return null
    if (data.demonArmed !== undefined && typeof data.demonArmed !== 'boolean') return null
    if (data.giftExpansion !== undefined && data.giftExpansion !== null && !isExpansion(data.giftExpansion)) return null
    const mode: GameMode = data.mode === 'trial' ? 'trial' : 'endless'
    const difficulty = legacyDifficultyLevel(data.difficulty, mode)
    const wave = data.wave
    return {
      version: 1,
      wave,
      cells: data.cells.map((cell) => ({ x: cell.x, y: cell.y })),
      weapons: data.weapons.map((weapon) => ({
        ...weapon,
        ...(weapon.bonusAttack !== undefined ? { bonusAttack: weapon.bonusAttack } : {}),
        ...(weapon.mark ? { mark: weapon.mark } : {}),
      })),
      expansion: data.expansion ? { ...data.expansion } : null,
      shopRefreshed: data.shopRefreshed,
      shopOffer: data.shopOffer.map((offer) => ({ id: offer.id, level: offer.level })),
      frozen: Array.isArray(data.frozen) ? data.frozen.map((cell) => ({ x: cell.x, y: cell.y })) : [],
      demonArmed: data.demonArmed === true,
      giftExpansion: data.giftExpansion ? { ...data.giftExpansion } : null,
      mode,
      difficulty,
    }
  } catch {
    return null
  }
}

export function writeSave(save: RunSave): boolean {
  try {
    localStorage.setItem(CONFIG.saveStorageKey, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(CONFIG.saveStorageKey)
  } catch {
    /* 清不掉时，标题页仍按内存里的结果不再提供继续 */
  }
}
