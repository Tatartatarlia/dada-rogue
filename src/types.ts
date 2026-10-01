export type WeaponType = 'axe' | 'dart' | 'sword' | 'molotov' | 'bomb' | 'potion'

export interface WeaponStat {
  name: string
  attack: number
  interval: number
  blurb: string
}

export interface Cell {
  x: number
  y: number
}

export interface Weapon {
  id: string
  type: WeaponType
  level: number
  rotation: number
  x: number
  y: number
  where: 'bag' | 'shop'
}

export interface Expansion {
  id: string
  count: 1 | 2
  rotation: number
}

export interface LoadoutItem {
  type: WeaponType
  level: number
}
