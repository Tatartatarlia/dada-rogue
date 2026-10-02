import { useEffect, useMemo, useState } from 'react'
import { CONFIG } from './config'
import type { Cell, Expansion, Weapon } from './types'
import { createShop, initialCells, shopOfferUsed } from './game/logic'
import { clearSave, readSave, writeSave } from './game/save'
import { play, setMuted as applyMute } from './game/audio'
import { ShopScreen } from './components/ShopScreen'
import { BattleView } from './components/BattleView'
import './App.css'

type Phase = 'title' | 'shop' | 'battle' | 'result'

interface Result {
  wave: number
  reason: 'dead' | 'settle'
  record: boolean
}

function readNumber(key: string): number {
  try {
    const value = Number(localStorage.getItem(key) || '0')
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  } catch {
    return 0
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(CONFIG.muteStorageKey) === '1'
  } catch {
    return false
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('title')
  const [wave, setWave] = useState(1)
  const [cells, setCells] = useState<Cell[]>(() => initialCells())
  const [weapons, setWeapons] = useState<Weapon[]>([])
  const [expansion, setExpansion] = useState<Expansion | null>(null)
  const [best, setBest] = useState(() => readNumber(CONFIG.bestStorageKey))
  const [muted, setMuted] = useState(readMuted)
  const [hero, setHero] = useState<HTMLImageElement | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [shopRefreshed, setShopRefreshed] = useState(false)
  const [shopOffer, setShopOffer] = useState<{ id: string; level: number }[]>([])
  const [save, setSave] = useState(() => readSave())
  const [saveTied, setSaveTied] = useState(false)

  useEffect(() => {
    applyMute(muted)
  }, [muted])

  useEffect(() => {
    const image = new Image()
    image.src = `${import.meta.env.BASE_URL}tartaglia.png`
    image.onload = () => setHero(image)
  }, [])

  const loadout = useMemo(
    () =>
      weapons
        .filter((weapon) => weapon.where === 'bag')
        .map((weapon) => ({ type: weapon.type, level: weapon.level })),
    [weapons],
  )

  function toggleMute() {
    setMuted((value) => {
      const next = !value
      try {
        localStorage.setItem(CONFIG.muteStorageKey, next ? '1' : '0')
      } catch {
        /* 隐私模式里记不住开关，声音仍然当场生效 */
      }
      applyMute(next)
      return next
    })
  }

  function finish(reached: number, reason: Result['reason']) {
    const waveReached = Math.max(0, reached)
    const record = waveReached > best && waveReached > 0
    const nextBest = Math.max(best, waveReached)
    if (nextBest !== best) {
      try {
        localStorage.setItem(CONFIG.bestStorageKey, String(nextBest))
      } catch {
        /* 记不住最高波数时，这一局的结算界面仍然照常显示 */
      }
      setBest(nextBest)
    }
    if (saveTied) {
      clearSave()
      setSave(null)
      setSaveTied(false)
    }
    setResult({ wave: waveReached, reason, record })
    setPhase('result')
  }

  function startRun() {
    const shop = createShop(1)
    play('click')
    setWave(1)
    setCells(initialCells())
    setWeapons(shop.weapons)
    setExpansion(shop.expansion)
    setShopRefreshed(false)
    setShopOffer(shop.weapons.map((weapon) => ({ id: weapon.id, level: weapon.level })))
    setResult(null)
    setSaveTied(false)
    setPhase('shop')
  }

  function applySave(next: NonNullable<ReturnType<typeof readSave>>) {
    setWave(next.wave)
    setCells(next.cells)
    setWeapons(next.weapons)
    setExpansion(next.expansion)
    setShopRefreshed(next.shopRefreshed)
    setShopOffer(next.shopOffer)
    setResult(null)
    setPhase('shop')
  }

  function continueSave() {
    const next = readSave()
    if (!next) {
      setSave(null)
      return
    }
    play('click')
    setSave(next)
    setSaveTied(true)
    applySave(next)
  }

  function saveProgress() {
    const next = {
      version: 1 as const,
      wave,
      cells,
      weapons,
      expansion,
      shopRefreshed,
      shopOffer,
    }
    const ok = writeSave(next)
    if (ok) {
      setSave(next)
      setSaveTied(true)
    }
    return ok
  }

  function startBattle() {
    play('click')
    setPhase('battle')
  }

  function afterWin() {
    const nextWave = wave + 1
    const shop = createShop(nextWave)
    setWeapons((current) => [...current.filter((weapon) => weapon.where === 'bag'), ...shop.weapons])
    setExpansion(shop.expansion)
    setShopRefreshed(false)
    setShopOffer(shop.weapons.map((weapon) => ({ id: weapon.id, level: weapon.level })))
    setWave(nextWave)
    setPhase('shop')
  }

  const offerUsed = shopOfferUsed(weapons, shopOffer)

  function refreshShop() {
    if (shopRefreshed || offerUsed) return
    const shop = createShop(wave)
    setWeapons((current) => [...current.filter((weapon) => weapon.where === 'bag'), ...shop.weapons])
    setExpansion((current) => (current ? shop.expansion : null))
    setShopOffer(shop.weapons.map((weapon) => ({ id: weapon.id, level: weapon.level })))
    setShopRefreshed(true)
  }

  const portrait = `${import.meta.env.BASE_URL}tartaglia.png`

  return (
    <div className="app">
      {phase !== 'battle' && (
        <div className="topbar">
          <span className="brand">达达利亚的行囊</span>
          <span>历史最高 {best > 0 ? `${best} 波` : '尚无记录'}</span>
          <button type="button" className="text-btn" onClick={toggleMute}>
            {muted ? '声音关' : '声音开'}
          </button>
        </div>
      )}

      {phase === 'title' && (
        <main className="title">
          <img src={portrait} alt="达达利亚" className="portrait" draggable={false} />
          <div className="title-copy">
            <p className="eyebrow">背包肉鸽</p>
            <h1>达达利亚的行囊</h1>
            <ul>
              <li>开局先进入商店，把武器拖进 3×3 的背包。</li>
              <li>武器可以先放在背包任意位置，点一下武器再点旋转调整方向。没放进格子就不能进入下一波。拖回商店可以放回去。</li>
              <li>两件相同等级的武器可以合成一件高一级的武器，但高一级武器的攻击力会略低于原先两件加在一起，所以请合理规划背包。武器合成至2级和4级时可解锁额外效果，5级起可以暴击。</li>
              <li>只要商店内任何武器被装进背包，或拿去合成升了一级，刷新功能均无法使用。只贴空格子不算使用武器，还可以刷新。所以请合理使用刷新功能。</li>
              <li>空格子贴着背包任意一边放下就能扩容。如果一次给两格，它们是连着的。</li>
              <li>
                达达利亚站在左边自动扔出武器。敌人从右边走近，碰到他会造成 {CONFIG.enemyContactDamage}{' '}
                点伤害并消失。
              </li>
              <li>每打完一波敌人即可存档，下次再进入页面可从存档继续游玩或新开一局。</li>
              <li>优化了手机端体验，防止手机端上下滚动屏幕时误触武器拖放。若手机端想要拖放商店内武器，请先按住武器后再水平滑动，此时即可拖放武器。</li>
            </ul>
            <div className="title-actions">
              {save ? (
                <>
                  <button type="button" className="primary" onClick={continueSave}>
                    从存档开始
                  </button>
                  <button type="button" className="text-btn" onClick={startRun}>
                    新开一局
                  </button>
                  <p className="quiet">存档停在第 {save.wave} 波之前</p>
                </>
              ) : (
                <button type="button" className="primary" onClick={startRun}>
                  进入商店
                </button>
              )}
            </div>
          </div>
        </main>
      )}

      {phase === 'shop' && (
        <ShopScreen
          wave={wave}
          cells={cells}
          weapons={weapons}
          expansion={expansion}
          onCells={setCells}
          onWeapons={setWeapons}
          onExpansion={setExpansion}
          onStart={startBattle}
          onSettle={() => finish(wave - 1, 'settle')}
          refreshed={shopRefreshed}
          offerUsed={offerUsed}
          onRefresh={refreshShop}
          canSave={wave > 1}
          onSave={saveProgress}
          previousSaveWave={save && !saveTied ? save.wave : null}
        />
      )}

      {phase === 'battle' && (
        <BattleView
          wave={wave}
          loadout={loadout}
          hero={hero}
          best={best}
          muted={muted}
          onToggleMute={toggleMute}
          onWin={afterWin}
          onLose={() => finish(wave, 'dead')}
          onSettle={() => finish(wave, 'settle')}
        />
      )}

      {phase === 'result' && result && (
        <main className="result">
          <img
            src={portrait}
            alt=""
            className={result.reason === 'dead' ? 'portrait fallen' : 'portrait'}
            draggable={false}
          />
          <div>
            <h1>{result.reason === 'dead' ? '达达利亚倒下了' : '本次到此为止'}</h1>
            <p className="score">{result.wave > 0 ? `到达第 ${result.wave} 波` : '还没有迎战敌人'}</p>
            {result.record && <p className="record">新纪录</p>}
            <p>历史最高 {best > 0 ? `${best} 波` : '尚无记录'}</p>
            <div className="result-actions">
              <button type="button" className="primary" onClick={startRun}>
                再来一局
              </button>
              <button type="button" className="text-btn" onClick={() => setPhase('title')}>
                返回标题
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  )
}
