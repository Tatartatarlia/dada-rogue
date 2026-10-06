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
   * 第 1 波商店若抽到过不了第一波的组合，最多重抽这么多次。
   * 仍然抽不到，就保证其中一件是炸弹。刷新第一波商店时同样生效。
   */
  openingShopRerolls: 12,
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
  /**
   * 商店赠送 1 格空位的节奏。
   * 1 到 expansionEarlyThrough 波：每波送 1 格。
   * 之后到 expansionMidThrough 波：每 expansionMidInterval 波送 1 格。
   * 再往后：每 expansionLateInterval 波送 1 格。
   */
  expansionEarlyThrough: 20,
  expansionMidThrough: 40,
  expansionMidInterval: 2,
  expansionLateInterval: 3,
  /**
   * 合成倍率。
   * 两件武器合成后，攻击力 = 两者攻击之和 × 这个数。
   */
  mergeMultiplier: 1.1,
  /** 打完这么多波（开局那次商店不算），进下一家商店之前弹出事件 */
  eventEveryWaves: 5,
  /** 断流换来的每把武器，等级与被换武器相差不超过这个数 */
  riftLevelDelta: 2,
  /** 断流换来的两把里，至少一把不低于「原等级减去这个数」 */
  riftFloorDrop: 1,
  /** 愚人众军械库里最高那把的等级，落在 [背包最高等级 - 这个数, 背包最高等级] */
  armoryLevelSpan: 2,
  /** 冰封之痕额外给出的相连空格。2 就是一块两格，1 就是单独一格 */
  frostExtraCells: 2,
  /**
   * 波数大于这个数之后，商店最高等级 = max(shopMinLevelCap, 背包最高等级 - shopBagLevelGap)。
   * 在这之前仍只用 shopLevelBands。
   */
  shopBagCapAfterWave: 20,
  shopBagLevelGap: 3,
  shopMinLevelCap: 4,
  /** 魔王武装·改：下一次合成的攻击力 = 两件攻击之和 × 这个数，并丢弃背包里等级最低的一件。 */
  demonMergeMultiplier: 1.25,

  enemyCount: 40,//敌人数量
  enemyBaseHp: 120,
  /** 生命 = 基础生命 × (1 + 这个数 × 波数) × 指数 ^ 波数。指数按模式另算。 */
  enemyHpLinear: 0.25,
  /** 执行官的试炼一共这么多波，打完即通关。 */
  trialWaves: 50,
  /** 试炼的生命指数。 */
  trialHpExponent: 1.1,
  /** 达达利亚的极限：简单、普通、困难的生命指数。 */
  endlessHpExponent: {
    easy: 1.09,
    normal: 1.1,
    hard: 1.11,
  },
  /**
   * 所有武器共用暴击，看背包里等级最高的那件。
   * 暴击率 = critRateBase + 最高等级 × critRatePerLevel
   * 暴击伤害（额外）= critDamageBase + 最高等级 × critDamagePerLevel
   * 暴击时伤害 × (1 + 暴击伤害)。
   * 暴击率超过 100% 后，溢出的每 1% 按 critOverflowRatio 变成暴击伤害。
   */
  critRateBase: 0.2,
  critRatePerLevel: 0.1,
  critDamageBase: 0.4,
  critDamagePerLevel: 0.2,
  critOverflowRatio: 2,
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
  /** 虚弱药剂落点的药雾半径 */
  potionRadius: 88,
  /** 药雾持续这么多秒，结束后移速和受伤都恢复 */
  slowDuration: 2,
  /** 药雾中的移速乘以这个数 */
  slowFactor: 0.48,
  /** 药雾中受到的伤害乘以这个数 */
  potionDamageTaken: 1.2,
  /**
   * 2 级和 4 级的额外效果。3 级沿用 2 级，更高的等级沿用 4 级。
   * 飞镖同时扔向的目标数。
   */
  dartTargets2: 2,
  dartTargets4: 3,
  /** 短剑连击总下数，以及触发概率。4 级下数更多，概率略高一点 */
  swordComboHits2: 2,
  swordComboHits4: 3,
  swordComboChance: 0.3,
  swordComboChance4: 0.4,
  /** 连击每一跳的间隔，秒 */
  swordComboGap: 0.11,
  /** 斧头溅射到附近这么多个敌人，半径按命中点来算 */
  axeSplashCount2: 2,
  axeSplashCount4: 3,
  axeSplashRadius: 140,
  /** 溅射伤害 = 这一下本体伤害 × 这个区间里的随机数。4 级两端都略高一点 */
  axeSplashMin: 0.3,
  axeSplashMax: 0.6,
  axeSplashMin4: 0.36,
  axeSplashMax4: 0.66,
  /** 炸弹 2 级起，爆炸半径乘以这个数 */
  bombRadiusScale: 1.35,
  /** 炸弹 4 级爆炸后留下的燃烧区域，每秒伤害 = 这一发攻击力 × bombBurnRatio */
  bombBurnDuration: 2.2,
  bombBurnRatio: 0.4,
  /** 燃烧瓶 2 级起，燃烧时间乘以这个数。4 级的燃烧伤害会叠加 */
  molotovDurationScale: 1.45,
  /** 虚弱药剂 2 级起，药雾半径乘以这个数 */
  potionRadiusScale: 1.4,
  /** 虚弱药剂 4 级：移速乘数更低，受伤乘数更高 */
  slowFactor4: 0.34,
  potionDamageTaken4: 1.4,

  /**
   * 不同武器上下左右贴住时的邻接效果。斜角不算。
   * 一条边用前一个数，两条边及以上用后一个数。
   * 斧头和短剑只在贴住两条边时生效。
   */
  /** 燃烧瓶贴炸弹：炸弹打中着火目标时，立刻打出剩余燃烧的这个比例 */
  linkDetonate: 0.6,
  linkDetonateFull: 1,
  /** 药剂贴燃烧瓶：人在药雾里时，燃烧计时按这个速度减少 */
  linkBurnMistRate: 0.72,
  linkBurnMistRateFull: 0.55,
  /** 飞镖贴短剑：标记最前排的秒数。两条边时连斩再多 1 下 */
  linkMarkTime: 1.2,
  linkMarkTimeFull: 2,
  /** 斧头贴飞镖：溅射目标再吃飞镖攻击的这个比例 */
  linkScatter: 0.45,
  linkScatterFull: 0.75,
  /** 炸弹贴斧头：炸弹攻击间隔乘以这个数 */
  linkBombSlow: 1.12,
  linkBombSlowFull: 1.22,
  /** 炸弹贴斧头：斧头溅射半径额外加上炸弹爆炸半径的这个比例 */
  linkAxeRadiusShare: 0.4,
  linkAxeRadiusShareFull: 0.7,
  /** 斧头贴短剑：短剑能攒下的额外连斩下数 */
  linkSwordGiftCap: 3,

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
      blurb: '砸中后留下药雾，雾里更慢，受到的伤害也更高',
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
  historyStorageKey: 'dada-rogue-history',
  /** 旧的总开关。新存档用音效音量；读到「关」且还没有音效音量时，音效从 0 开始 */
  muteStorageKey: 'dada-rogue-muted',
  sfxVolumeKey: 'dada-rogue-sfx-volume',
  /** 音效默认音量，0 到 1。原先那套音效的响度不变，这里是总乘数 */
  sfxVolume: 1,
  saveStorageKey: 'dada-rogue-save',
}
