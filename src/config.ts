import type { WeaponStat, WeaponType } from './types'

/**
 * 所有可调数值都在这里。
 * 改难度、攻速、商店和波次曲线时，只动这个文件。
 * 攻击间隔请保持不超过 maxAttackInterval（0.5 秒）。
 */
export const CONFIG = {
  playerMaxHp: 100,

  backpackCols: 3,
  backpackRows: 3,
  shopWeaponCount: 3,
  /**
   * 商店武器等级。weights 从左到右是 1 级、2 级、3 级、4 级的权重。
   * 每一档用到 maxWave 波（含）为止，更后面的波数用最后一档。
   * 1–3 全部 1 级；4–6 约八成 1 级、偶尔 2 级；7–9 各半；
   * 10–12 约八成 2 级、偶尔 3 级；13 波起 2 级和 3 级为主，偶尔 4 级。
   */
  shopLevelBands: [
    { maxWave: 3, weights: [1, 0, 0, 0] },
    { maxWave: 6, weights: [4, 1, 0, 0] },
    { maxWave: 9, weights: [1, 1, 0, 0] },
    { maxWave: 12, weights: [0, 4, 1, 0] },
    { maxWave: Number.POSITIVE_INFINITY, weights: [0, 9, 9, 2] },
  ],
  /** 商店给出「两格相连」空位的概率，否则只给 1 格 */
  expansionPairChance: 0.5,
  /**
   * 合成保留系数。
   * 两件同等级武器合成后，新攻击力约为两者之和乘以这个数，因此会略低一点。
   */
  mergeRetain: 0.86,

  enemyCount: 40,//敌人数量
  enemyBaseHp: 120,
  /** 生命 = 基础生命 × (1 + 这个数 × 波数) × enemyHpExponent ^ 波数 */
  enemyHpLinear: 0.2,
  enemyHpExponent: 1.08,
  enemySpeed: 118,
  /** 每波在基础移速上增加这么多，加到 enemySpeedBonusMax 后不再增加 */
  enemySpeedPerWave: 0.5,
  /** 移速加成上限。0.5 × 16 = 8，所以前 16 波慢慢加快，之后封顶 */
  enemySpeedBonusMax: 8,
  /**
   * 实际移速 = 上面的移速 × min(1, 战场宽度 / 这个宽度)。
   * 战场不窄于这里时倍数是 1，电脑上的速度和原来一样。
   * 手机更窄，敌人按宽度同比走慢，不会一下贴到脸上。
   */
  enemySpeedReferenceWidth: 820,
  enemySpeedJitter: 0.14,
  enemyContactDamage: 5,
  enemyRadius: 24,
  spawnInterval: 0.5,
  /** 每波开场横幅的停留时间，也是第一只敌人出现前的等待 */
  spawnDelay: 1.15,
  endDelay: 0.85,

  /** 任意武器的攻击间隔都不应超过这个值 */
  maxAttackInterval: 0.5,
  /** 燃烧每秒伤害 = 该发攻击力 × burnRatio，持续 burnDuration 秒 */
  burnRatio: 0.9,
  burnDuration: 2.2,
  /** 炸弹溅射伤害 = 攻击力 × 这个比例 */
  bombSplashRatio: 0.62,
  bombSplashRadius: 88,
  /** 虚弱药剂落点的药雾半径，雾里的敌人无法移动 */
  potionRadius: 88,
  /** 药雾持续这么多秒，结束后敌人恢复行动 */
  slowDuration: 2,

  projectileLife: 3,
  projectileRadius: 16,

  weapons: {
    axe: {
      name: '斧头',
      attack: 36,
      interval: 0.3,
      blurb: '砍得勤，单下不算重',
    },
    dart: {
      name: '飞镖',
      attack: 9,
      interval: 0.18,
      blurb: '出手最快，伤害最低',
    },
    sword: {
      name: '短剑',
      attack: 22,
      interval: 0.24,
      blurb: '轻快连斩，伤害偏低',
    },
    molotov: {
      name: '燃烧瓶',
      attack: 14,
      interval: 0.4,
      blurb: '砸中以后还会烧一会儿',
    },
    bomb: {
      name: '炸弹',
      attack: 78,
      interval: 0.5,
      blurb: '单下最痛，丢得最慢，能溅射',
    },
    potion: {
      name: '虚弱药剂',
      attack: 20,
      interval: 0.32,
      blurb: '砸中后留下药雾，雾里的敌人无法行动',
    },
  } satisfies Record<WeaponType, WeaponStat>,

  projectileSpeed: {
    dart: 980,
    sword: 840,
    axe: 760,
    molotov: 640,
    bomb: 540,
    potion: 700,
  } satisfies Record<WeaponType, number>,

  // —— 下面是画面尺寸，不影响伤害公式 ——
  cellSize: 58,
  cellSizeMin: 34,
  boardMaxWidth: 620,
  boardPad: 2,
  heroHeightRatio: 0.46,
  heroXRatio: 0.045,
  /**
   * 画面窄于这个宽度时，立绘改按宽度限制。
   * 更宽的电脑窗口仍只用 heroHeightRatio，大小和原来一样。
   */
  heroNarrowWidth: 820,
  /** 窄屏上立绘宽度不超过画面的这个比例，给右边留出走路 */
  heroMaxWidthRatio: 0.10,
  /** 敌人碰到角色身前这条线时造成伤害并消失，按立绘宽度从左往右算 */
  hurtLineRatio: 0.78,
  groundTopRatio: 0.52,
  groundBotRatio: 0.9,

  bestStorageKey: 'dada-rogue-best-wave',
  muteStorageKey: 'dada-rogue-muted',
  saveStorageKey: 'dada-rogue-save',
}
