import { CONFIG } from '../config'
import type { Cell, Expansion, Weapon, WeaponType } from '../types'
import { createShop, keyOf, uid, WEAPON_TYPES, worldCells } from './logic'

export type EventKind = 'rift' | 'bargain' | 'frost' | 'armory' | 'demon'

export interface GameEvent {
  id: string
  kind: EventKind
  name: string
  content: string
  description: string
  rift?: { removeId: string; weapons: Weapon[] }
  bargain?: { downId: string; upId: string }
  frost?: { cell: Cell }
  armory?: { type: WeaponType; levels: number[] }
  demon?: { removeId: string | null }
}

const COPY: Record<EventKind, { name: string; description: string }> = {
  rift: {
    name: '断流·水形变',
    description: '「断流」是达达利亚的招牌机制，「水形」是他水元素切换武器的设定。换两把，形随意动。',
  },
  bargain: {
    name: '至冬的权衡',
    description: '至冬是严酷的，力量不会凭空而来，必须有代价，冷酷又公平。',
  },
  frost: {
    name: '冰封之痕',
    description: '至冬的霜冰来临之后留下不可磨灭的痕迹。冰封格子就是至冬寒风在你背包里刻下的烙印。',
  },
  armory: {
    name: '愚人众军械库',
    description: '愚人众的补给不会给你挑三拣四的余地，这一批全是同一种军械，但至少有一件配得上你的实力。',
  },
  demon: {
    name: '魔王武装·改',
    description: '魔王武装是达达利亚压箱底的形态，强大但有代价。这次合成获得额外攻击力，代价是包里最弱的那件武器被吞噬。',
  },
}

function weaponName(type: WeaponType): string {
  return CONFIG.weapons[type].name
}

function labeled(weapon: Pick<Weapon, 'type' | 'level'>): string {
  return `${weapon.level}级${weaponName(weapon.type)}`
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pickOne<T>(list: T[]): T | null {
  if (list.length === 0) return null
  return list[Math.floor(Math.random() * list.length)] ?? null
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swap] as T
    copy[swap] = current as T
  }
  return copy
}

function randomType(): WeaponType {
  return WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)] ?? 'dart'
}

function shopWeapon(type: WeaponType, level: number, mark?: 'rift'): Weapon {
  return {
    id: uid('w'),
    type,
    level,
    rotation: 0,
    x: 0,
    y: 0,
    where: 'shop',
    ...(mark ? { mark } : {}),
  }
}

/** 每把与原等级相差不超过 riftLevelDelta，且至少一把不低于原等级 - riftFloorDrop。 */
function riftLevels(origin: number): [number, number] {
  const span = Math.max(0, CONFIG.riftLevelDelta)
  const roll = () => Math.max(1, origin + randomInt(-span, span))
  let first = roll()
  let second = roll()
  const floor = Math.max(1, origin - Math.max(0, CONFIG.riftFloorDrop))
  if (first < floor && second < floor) {
    if (Math.random() < 0.5) first = floor
    else second = floor
  }
  return [first, second]
}

function buildRift(bag: Weapon[]): GameEvent | null {
  if (bag.length === 0) return null
  return {
    id: uid('ev'),
    kind: 'rift',
    ...COPY.rift,
    content:
      '随机把背包里的一件武器换成两把新武器。每把等级可能更高或更低，和被换的武器相差不超过2级，而且至少有一把不低于原等级减1。两把放进商店，标着「断流」，原来的三件货还在。',
  }
}

function buildBargain(bag: Weapon[]): GameEvent | null {
  if (bag.length < 2 || !bag.some((weapon) => weapon.level >= 2)) return null
  return {
    id: uid('ev'),
    kind: 'bargain',
    ...COPY.bargain,
    content: '随机一件至少2级的武器降1级。然后由你指定另一件武器升1级。',
  }
}

function buildFrost(cells: Cell[]): GameEvent | null {
  if (cells.length <= 1) return null
  const extra = CONFIG.frostExtraCells >= 2 ? '两格相连空位' : '一格空位'
  return {
    id: uid('ev'),
    kind: 'frost',
    ...COPY.frost,
    content: `商店额外多出${extra}，原来的空格子还在。背包里随机一格会被永久冰封，武器和空格子都不能再放上去。格子上如果有武器，会变成没放进格子。`,
  }
}

/** 点选之后才掷断流。换哪一件、换成什么，都在这一步才决定。 */
export function rollRiftOutcome(bag: Weapon[]): { text: string; rift: NonNullable<GameEvent['rift']> } | null {
  const victim = pickOne(bag)
  if (!victim) return null
  const [firstLevel, secondLevel] = riftLevels(victim.level)
  const first = shopWeapon(randomType(), firstLevel, 'rift')
  const second = shopWeapon(randomType(), secondLevel, 'rift')
  return {
    text: `你的${labeled(victim)}被替换成了${labeled(first)}和${labeled(second)}。这两件在商店里标着「断流」。`,
    rift: { removeId: victim.id, weapons: [first, second] },
  }
}

/** 点选之后才决定哪一件降级。升级目标留给玩家指定。 */
export function rollBargainDown(bag: Weapon[]): { text: string; downId: string; choices: Weapon[] } | null {
  const down = pickOne(bag.filter((weapon) => weapon.level >= 2))
  if (!down) return null
  const choices = bag.filter((weapon) => weapon.id !== down.id)
  if (choices.length === 0) return null
  return {
    text: `${labeled(down)}降为${down.level - 1}级。`,
    downId: down.id,
    choices,
  }
}

/** 点选之后才决定冰封哪一格。 */
export function rollFrostOutcome(
  bag: Weapon[],
  cells: Cell[],
): { text: string; frost: NonNullable<GameEvent['frost']> } | null {
  if (cells.length <= 1) return null
  const cell = pickOne(cells)
  if (!cell) return null
  const sitting = bag.find(
    (weapon) => weapon.where === 'bag' && worldCells(weapon).some((part) => part.x === cell.x && part.y === cell.y),
  )
  const extra = CONFIG.frostExtraCells >= 2 ? '两格相连空位' : '一格空位'
  const occupied = sitting ? `上面的${labeled(sitting)}没放进格子，挪开才能出发。` : '这一格现在是空的。'
  return {
    text: `冰封了背包里的一格。${occupied}商店另外多出${extra}。`,
    frost: { cell: { x: cell.x, y: cell.y } },
  }
}

function buildArmory(bag: Weapon[]): GameEvent {
  const highest = bag.reduce((max, weapon) => Math.max(max, weapon.level), 1)
  const low = Math.max(1, highest - Math.max(0, CONFIG.armoryLevelSpan))
  const minTop = highest >= 2 ? Math.max(low, 2) : 2
  const top = randomInt(minTop, Math.max(minTop, highest))
  const type = randomType()
  const levels = [top, randomInt(1, top - 1), randomInt(1, top - 1)]
  const name = weaponName(type)
  return {
    id: uid('ev'),
    kind: 'armory',
    ...COPY.armory,
    content: `这一波商店的三件货都换成${name}：${levels[0]}级、${levels[1]}级和${levels[2]}级。${levels[0]}级是其中最高的。`,
    armory: { type, levels },
  }
}

function buildDemon(bag: Weapon[]): GameEvent {
  const minLevel = bag.reduce((min, weapon) => Math.min(min, weapon.level), Infinity)
  const weakest = pickOne(bag.filter((weapon) => weapon.level === minLevel))
  const bonus = Math.round(CONFIG.demonMergeBonus * 100)
  const cost = !weakest
    ? '背包里没有武器可丢。'
    : bag.length === 1
      ? `丢弃背包里唯一的${labeled(weakest)}。`
      : `丢弃背包里等级最低的${labeled(weakest)}。`
  return {
    id: uid('ev'),
    kind: 'demon',
    ...COPY.demon,
    content: `${cost}之后第一次合成不减少攻击力，还会再提高${bonus}%。`,
    demon: { removeId: weakest?.id ?? null },
  }
}

/** 抽 3 张不重复的事件。断流、权衡、冰封只放规则，点选之后才掷结果。 */
export function rollEvents(bag: Weapon[], cells: Cell[]): GameEvent[] {
  const built = [
    buildRift(bag),
    buildBargain(bag),
    buildFrost(cells),
    buildArmory(bag),
    buildDemon(bag),
  ].filter((event): event is GameEvent => event !== null)
  return shuffle(built).slice(0, 3)
}

export function resolveEvent(
  event: GameEvent,
  bag: Weapon[],
  cells: Cell[],
  frozen: Cell[],
  demonArmed: boolean,
  nextWave: number,
): {
  weapons: Weapon[]
  cells: Cell[]
  frozen: Cell[]
  demonArmed: boolean
  expansion: Expansion
  giftExpansion: Expansion | null
  shopOffer: { id: string; level: number }[]
} {
  const shop = createShop(nextWave)
  let nextBag = bag.map((weapon) => ({ ...weapon }))
  let nextCells = cells.map((cell) => ({ ...cell }))
  let nextFrozen = frozen.map((cell) => ({ ...cell }))
  let nextDemon = demonArmed
  let offer = shop.weapons
  let extras: Weapon[] = []
  let giftExpansion: Expansion | null = null

  if (event.kind === 'rift' && event.rift) {
    nextBag = nextBag.filter((weapon) => weapon.id !== event.rift?.removeId)
    extras = event.rift.weapons.map((weapon) => ({ ...weapon, where: 'shop' as const, mark: 'rift' as const }))
  }

  if (event.kind === 'bargain' && event.bargain) {
    const { downId, upId } = event.bargain
    nextBag = nextBag.map((weapon) => {
      if (weapon.id === downId) return { ...weapon, level: Math.max(1, weapon.level - 1) }
      if (weapon.id === upId) return { ...weapon, level: weapon.level + 1 }
      return weapon
    })
  }

  if (event.kind === 'frost' && event.frost) {
    const key = keyOf(event.frost.cell)
    const stillOwned = nextCells.some((cell) => keyOf(cell) === key)
    if (stillOwned && nextCells.length > 1) {
      nextCells = nextCells.filter((cell) => keyOf(cell) !== key)
      nextFrozen = [...nextFrozen, { ...event.frost.cell }]
    }
    const count: 1 | 2 = CONFIG.frostExtraCells >= 2 ? 2 : 1
    giftExpansion = { id: uid('ex'), count, rotation: 0 }
  }

  if (event.kind === 'armory' && event.armory) {
    offer = event.armory.levels.map((level) => shopWeapon(event.armory?.type ?? 'dart', Math.max(1, level)))
  }

  if (event.kind === 'demon' && event.demon) {
    if (event.demon.removeId) nextBag = nextBag.filter((weapon) => weapon.id !== event.demon?.removeId)
    nextDemon = true
  }

  return {
    weapons: [...nextBag, ...extras, ...offer],
    cells: nextCells,
    frozen: nextFrozen,
    demonArmed: nextDemon,
    expansion: shop.expansion,
    giftExpansion,
    shopOffer: offer.map((weapon) => ({ id: weapon.id, level: weapon.level })),
  }
}
