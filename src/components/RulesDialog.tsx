import { useState } from 'react'
import { CONFIG } from '../config'
import { linkCatalog } from '../game/links'

export function GameRules({ entry = false }: { entry?: boolean }) {
  return (
    <ul className="rules-list">
      <li>开局先进入商店，把武器拖进 3×3 的背包。</li>
      <li>
        「执行官的试炼」固定 {CONFIG.trialWaves} 波，敌人血量指数 {CONFIG.trialHpExponent.toFixed(2)}
        ，通关后颁发奖章。「达达利亚的极限」没有尽头，先选简单、普通或困难，血量指数分别是{' '}
        {CONFIG.endlessHpExponent.easy.toFixed(2)}、{CONFIG.endlessHpExponent.normal.toFixed(2)}、
        {CONFIG.endlessHpExponent.hard.toFixed(2)}。
      </li>
      <li>武器可以先放在背包任意位置，点一下武器再点旋转调整方向。没放进格子就不能进入下一波。拖回商店可以放回去。</li>
      <li>两件相同等级的武器可以合成一件高一级的武器，攻击力是原先两件加起来的 {CONFIG.mergeMultiplier} 倍。武器合成至2级和4级时可解锁额外效果。</li>
      <li>
        {entry
          ? '不同的武器邻接，会触发不同效果，详情请在游戏开始后点击规则按钮查看。'
          : '不同的武器邻接，会触发不同效果。'}
      </li>
      <li>
        所有武器都会暴击。暴击率是 {Math.round(CONFIG.critRateBase * 100)}% 加上背包内最高武器等级的{' '}
        {Math.round(CONFIG.critRatePerLevel * 100)}%，暴击伤害额外是 {Math.round(CONFIG.critDamageBase * 100)}%
        加上最高等级的 {Math.round(CONFIG.critDamagePerLevel * 100)}%。暴击率超过 100% 时，溢出的每 1% 变成{' '}
        {CONFIG.critOverflowRatio}% 暴击伤害。
      </li>
      <li>只要商店内任何武器被装进背包，或拿去合成升了一级，刷新功能均无法使用。只贴空格子不算使用武器，还可以刷新。所以请合理使用刷新功能。</li>
      <li>
        1 到 {CONFIG.expansionEarlyThrough} 波每波送 1 格空位，之后到 {CONFIG.expansionMidThrough}{' '}
        波每 {CONFIG.expansionMidInterval} 波送 1 格，再往后每 {CONFIG.expansionLateInterval}{' '}
        波送 1 格。空格子贴着背包任意一边放下就能扩容。如果一次给两格，它们是连着的。
      </li>
      <li>
        达达利亚站在左边自动扔出武器。敌人从右边走近，碰到他会造成 {CONFIG.enemyContactDamage}{' '}
        点伤害并消失。
      </li>
      <li>每打完 {CONFIG.eventEveryWaves} 波，进商店前会遇到三张事件卡，只能选一张。</li>
      <li>每打完一波敌人即可存档，下次再进入页面可从存档继续游玩或新开一局。</li>
      <li>优化了手机端体验，防止手机端上下滚动屏幕时误触武器拖放。若手机端想要拖放商店内武器，请先按住武器后再水平滑动，此时即可拖放武器。</li>
    </ul>
  )
}

export function RulesDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'rules' | 'links'>('rules')
  return (
    <div
      className="event-result"
      role="dialog"
      aria-modal="true"
      aria-label="规则"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="event-result-card rules-card">
        <div className="rules-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'rules'} onClick={() => setTab('rules')}>
            游戏规则
          </button>
          <button type="button" role="tab" aria-selected={tab === 'links'} onClick={() => setTab('links')}>
            武器邻接效果
          </button>
        </div>
        <div className="rules-body">
          {tab === 'rules' ? (
            <GameRules />
          ) : (
            <>
              <p className="rules-note">上下左右贴住才算邻接，斜角不算。同一种武器仍然只合成。贴住一条边是基础效果，贴住两条或更多是完整效果。</p>
              <ul className="link-rules">
                {linkCatalog().map((link) => (
                  <li key={link.id}>
                    <p>
                      <strong>{link.name}</strong>
                      <span>
                        {CONFIG.weapons[link.types[0]].name} · {CONFIG.weapons[link.types[1]].name}
                      </span>
                    </p>
                    <p>{link.detail}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <button type="button" className="text-btn" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}
