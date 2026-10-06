export type WeaponType = 'axe' | 'dart' | 'sword' | 'molotov' | 'bomb' | 'potion'

export type GameMode = 'trial' | 'endless'

export type Difficulty = 'easy' | 'normal' | 'hard'

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
  /** 加在等级攻击力上的额外攻击。魔王武装合成后会写在这里。 */
  bonusAttack?: number
  /** 断流换来的武器，商店里单独标出来，不算进原来的三件货。 */
  mark?: 'rift'
}

export interface Expansion {
  id: string
  count: 1 | 2
  rotation: number
}

export interface LoadoutItem {
  type: WeaponType
  level: number
  bonusAttack?: number
  links?: WeaponLinks
}

/** 这件武器当前吃到的邻接。1 表示没有加成。 */
export interface WeaponLinks {
  detonate: number
  splashVuln: number
  intervalScale: number
  burnMistRate: number
  markTime: number
  comboSure: boolean
  comboExtra: number
  takeAxeBonus: boolean
  giveAxeBonus: boolean
  scatterDamage: number
  splashRadiusBonus: number
  /** 0 不改目标，1 额外目标优先药雾，2 全部目标优先药雾 */
  preferMist: 0 | 1 | 2
}
