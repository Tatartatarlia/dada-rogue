import { useEffect, useMemo, useState } from 'react'
import { CONFIG } from './config'
import type { Cell, Difficulty, Expansion, GameMode, Weapon } from './types'
import { createShop, highestBagLevel, hpExponentFor, initialCells, shopOfferUsed } from './game/logic'
import { resolveEvent, rollEvents, type GameEvent } from './game/events'
import { clearSave, readSave, writeSave } from './game/save'
import { difficultyName, readHistory, recordRun, trialMedalText, type History, type RunOutcome } from './game/history'
import { play } from './game/audio'
import { VolumeControls } from './components/VolumeControls'
import { ShopScreen } from './components/ShopScreen'
import { BattleView } from './components/BattleView'
import { EventScreen } from './components/EventScreen'
import { HistoryDialog } from './components/HistoryDialog'
import { Medal } from './components/Medal'
import { Whale } from './components/Whale'
import { GameRules, RulesDialog } from './components/RulesDialog'
import { linksFor } from './game/links'
import './App.css'

type Phase = 'title' | 'event' | 'shop' | 'battle' | 'result' | 'victory'

interface Result {
  wave: number
  reason: 'dead' | 'settle'
  record: boolean
}

const portrait = `${import.meta.env.BASE_URL}tartaglia.webp`
const heroImage = new Image()
heroImage.decoding = 'async'
heroImage.src = portrait

export default function App() {
  const [phase, setPhase] = useState<Phase>('title')
  const [wave, setWave] = useState(1)
  const [cells, setCells] = useState<Cell[]>(() => initialCells())
  const [weapons, setWeapons] = useState<Weapon[]>([])
  const [expansion, setExpansion] = useState<Expansion | null>(null)
  const [history, setHistory] = useState<History>(() => readHistory())
  const [historyOpen, setHistoryOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [pickDifficulty, setPickDifficulty] = useState(false)
  const [mode, setMode] = useState<GameMode>('endless')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [hero, setHero] = useState<HTMLImageElement | null>(() =>
    heroImage.complete && heroImage.naturalWidth > 0 ? heroImage : null,
  )
  const [result, setResult] = useState<Result | null>(null)
  const [shopRefreshed, setShopRefreshed] = useState(false)
  const [shopOffer, setShopOffer] = useState<{ id: string; level: number }[]>([])
  const [save, setSave] = useState(() => readSave())
  const [saveTied, setSaveTied] = useState(false)
  const [frozen, setFrozen] = useState<Cell[]>([])
  const [demonArmed, setDemonArmed] = useState(false)
  const [giftExpansion, setGiftExpansion] = useState<Expansion | null>(null)
  const [eventCards, setEventCards] = useState<GameEvent[]>([])

  useEffect(() => {
    if (heroImage.complete && heroImage.naturalWidth > 0) {
      setHero(heroImage)
      return
    }
    const ready = () => setHero(heroImage)
    heroImage.addEventListener('load', ready)
    return () => heroImage.removeEventListener('load', ready)
  }, [])

  const loadout = useMemo(
    () =>
      weapons
        .filter((weapon) => weapon.where === 'bag')
        .map((weapon) => ({
          type: weapon.type,
          level: weapon.level,
          bonusAttack: weapon.bonusAttack ?? 0,
          links: linksFor(
            weapon,
            weapons.filter((item) => item.where === 'bag'),
          ),
        })),
    [weapons],
  )

  function remember(outcome: RunOutcome, reached: number) {
    const next = recordRun(history, {
      mode,
      difficulty: mode === 'endless' ? difficulty : null,
      wave: Math.max(0, reached),
      outcome,
    })
    setHistory(next.history)
    return next
  }

  function finish(reached: number, reason: Result['reason']) {
    const waveReached = Math.max(0, reached)
    const next = remember(reason, waveReached)
    if (saveTied) {
      clearSave()
      setSave(null)
      setSaveTied(false)
    }
    setResult({ wave: waveReached, reason, record: next.record })
    setPhase('result')
  }

  function startRun(nextMode: GameMode, nextDifficulty: Difficulty | null = null) {
    const shop = createShop(1)
    play('click')
    setMode(nextMode)
    setDifficulty(nextMode === 'endless' ? (nextDifficulty ?? 'easy') : 'easy')
    setPickDifficulty(false)
    setWave(1)
    setCells(initialCells())
    setWeapons(shop.weapons)
    setExpansion(shop.expansion)
    setShopRefreshed(false)
    setShopOffer(shop.weapons.map((weapon) => ({ id: weapon.id, level: weapon.level })))
    setFrozen([])
    setDemonArmed(false)
    setGiftExpansion(null)
    setEventCards([])
    setResult(null)
    setSaveTied(false)
    setHistoryOpen(false)
    setPhase('shop')
  }

  function applySave(next: NonNullable<ReturnType<typeof readSave>>) {
    setWave(next.wave)
    setCells(next.cells)
    setWeapons(next.weapons)
    setExpansion(next.expansion)
    setShopRefreshed(next.shopRefreshed)
    setShopOffer(next.shopOffer)
    setFrozen(next.frozen)
    setDemonArmed(next.demonArmed)
    setGiftExpansion(next.giftExpansion)
    setMode(next.mode)
    setDifficulty(next.difficulty ?? 'easy')
    setEventCards([])
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
      frozen,
      demonArmed,
      giftExpansion,
      mode,
      difficulty: mode === 'endless' ? difficulty : null,
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

  function openShop(nextWave: number, event?: GameEvent) {
    if (event) {
      const next = resolveEvent(
        event,
        weapons.filter((weapon) => weapon.where === 'bag'),
        cells,
        frozen,
        demonArmed,
        nextWave,
      )
      setWeapons(next.weapons)
      setCells(next.cells)
      setFrozen(next.frozen)
      setDemonArmed(next.demonArmed)
      setExpansion(next.expansion)
      setGiftExpansion(next.giftExpansion)
      setShopOffer(next.shopOffer)
    } else {
      const shop = createShop(nextWave, highestBagLevel(weapons))
      setWeapons((current) => [...current.filter((weapon) => weapon.where === 'bag'), ...shop.weapons])
      setExpansion(shop.expansion)
      setGiftExpansion(null)
      setShopOffer(shop.weapons.map((weapon) => ({ id: weapon.id, level: weapon.level })))
    }
    setShopRefreshed(false)
    setEventCards([])
    setWave(nextWave)
    setPhase('shop')
  }

  function afterWin() {
    if (mode === 'trial' && wave >= CONFIG.trialWaves) {
      const next = remember('clear', wave)
      if (saveTied) {
        clearSave()
        setSave(null)
        setSaveTied(false)
      }
      setResult(null)
      setHistory(next.history)
      setPhase('victory')
      return
    }
    const nextWave = wave + 1
    if (wave > 0 && wave % CONFIG.eventEveryWaves === 0) {
      const cards = rollEvents(
        weapons.filter((weapon) => weapon.where === 'bag'),
        cells,
      )
      if (cards.length > 0) {
        setEventCards(cards)
        setPhase('event')
        return
      }
    }
    openShop(nextWave)
  }

  function pickEvent(event: GameEvent) {
    play('click')
    openShop(wave + 1, event)
  }

  const offerUsed = shopOfferUsed(weapons, shopOffer)
  const exponent = hpExponentFor(mode, mode === 'endless' ? difficulty : null)
  const chapter =
    mode === 'trial'
      ? `执行官的试炼 · 第 ${wave} / ${CONFIG.trialWaves} 波之前`
      : `极限 · ${difficultyName(difficulty)} · 第 ${wave} 波之前`
  const finale = mode === 'trial' && wave >= CONFIG.trialWaves
  const recordNote =
    mode === 'trial'
      ? `终点 ${CONFIG.trialWaves} 波`
      : history.endless[difficulty] > 0
        ? `${difficultyName(difficulty)}最高 ${history.endless[difficulty]} 波`
        : `${difficultyName(difficulty)}尚无记录`
  const saveCaption = save
    ? save.mode === 'trial'
      ? `存档停在执行官的试炼第 ${save.wave} 波之前`
      : `存档停在极限·${difficultyName(save.difficulty ?? 'easy')}第 ${save.wave} 波之前`
    : ''

  function refreshShop() {
    if (shopRefreshed || offerUsed) return
    const shop = createShop(wave, highestBagLevel(weapons))
    setWeapons((current) => [
      ...current.filter((weapon) => weapon.where === 'bag' || (weapon.where === 'shop' && weapon.mark === 'rift')),
      ...shop.weapons,
    ])
    setExpansion((current) => (current ? shop.expansion : null))
    setShopOffer(shop.weapons.map((weapon) => ({ id: weapon.id, level: weapon.level })))
    setShopRefreshed(true)
  }

  return (
    <div className="app">
      {phase !== 'battle' && (
        <div className="topbar">
          <span className="brand">达达利亚的行囊</span>
          {phase !== 'title' && (
            <button type="button" className="text-btn" onClick={() => setRulesOpen(true)}>
              规则
            </button>
          )}
          <button type="button" className="text-btn" onClick={() => setHistoryOpen(true)}>
            历史记录
          </button>
          <VolumeControls />
        </div>
      )}

      {phase === 'title' && (
        <main className="title">
          <img src={portrait} alt="达达利亚" className="portrait" draggable={false} fetchPriority="high" decoding="async" />
          <div className="title-copy">
            <p className="eyebrow">背包肉鸽</p>
            <h1>达达利亚的行囊</h1>
            <GameRules entry />
            <div className="title-actions">
              {save && (
                <>
                  <button type="button" className="primary" onClick={continueSave}>
                    从存档开始
                  </button>
                  <p className="quiet">{saveCaption}</p>
                </>
              )}
              <button type="button" className="primary" onClick={() => startRun('trial')}>
                执行官的试炼
              </button>
              <button type="button" className="text-btn" onClick={() => setPickDifficulty(true)}>
                达达利亚的极限
              </button>
            </div>
          </div>
        </main>
      )}

      {phase === 'event' && (
        <EventScreen
          wave={wave}
          events={eventCards}
          bag={weapons.filter((weapon) => weapon.where === 'bag')}
          cells={cells}
          onPick={pickEvent}
        />
      )}

      {phase === 'shop' && (
        <ShopScreen
          wave={wave}
          cells={cells}
          frozen={frozen}
          weapons={weapons}
          expansion={expansion}
          giftExpansion={giftExpansion}
          demonArmed={demonArmed}
          onCells={setCells}
          onWeapons={setWeapons}
          onExpansion={setExpansion}
          onGiftExpansion={setGiftExpansion}
          onDemonArmed={setDemonArmed}
          onStart={startBattle}
          onSettle={() => finish(wave - 1, 'settle')}
          refreshed={shopRefreshed}
          offerUsed={offerUsed}
          onRefresh={refreshShop}
          canSave={wave > 1}
          onSave={saveProgress}
          previousSaveWave={save && !saveTied ? save.wave : null}
          hpExponent={exponent}
          chapter={chapter}
          finale={finale}
        />
      )}

      {phase === 'battle' && (
        <BattleView
          wave={wave}
          loadout={loadout}
          hero={hero}
          hpExponent={exponent}
          recordNote={recordNote}
          hold={rulesOpen}
          onRules={() => setRulesOpen(true)}
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
            <h1 className="ending">
              {result.reason === 'settle'
                ? result.wave > 0
                  ? `第 ${result.wave} 波，达达利亚收起了武器，这场战斗到此为止。`
                  : '达达利亚收起了武器，这场战斗到此为止。'
                : `达达利亚在至冬的寒风里撑到了第 ${Math.max(1, result.wave)} 波，不愧是执行官。`}
            </h1>
            {result.record && <p className="record">新纪录</p>}
            <div className="result-actions">
              <button
                type="button"
                className="primary"
                onClick={() => startRun(mode, mode === 'endless' ? difficulty : null)}
              >
                再来一局
              </button>
              <button type="button" className="text-btn" onClick={() => setPhase('title')}>
                返回标题
              </button>
            </div>
          </div>
        </main>
      )}

      {phase === 'victory' && (
        <main className="victory">
          <div className="victory-stage">
            <img src={portrait} alt="达达利亚" className="portrait" draggable={false} />
            <Medal text={trialMedalText(history.trialClears)} size={300} />
            <Whale width={240} height={168} />
          </div>
          <div className="result-actions">
            <button type="button" className="primary" onClick={() => startRun('trial')}>
              再挑战一次
            </button>
            <button type="button" className="text-btn" onClick={() => setPhase('title')}>
              返回标题
            </button>
          </div>
        </main>
      )}

      {historyOpen && <HistoryDialog history={history} onClose={() => setHistoryOpen(false)} />}
      {rulesOpen && <RulesDialog onClose={() => setRulesOpen(false)} />}
      {pickDifficulty && (
        <div
          className="event-result"
          role="dialog"
          aria-modal="true"
          aria-label="选择难度"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPickDifficulty(false)
          }}
        >
          <div className="event-result-card">
            <h2>达达利亚的极限</h2>
            <p className="event-result-text">没有固定的终点。先选这一局的难度，血量指数越高，后面的敌人越难打。</p>
            <div className="difficulty-list">
              {(['easy', 'normal', 'hard'] as const).map((item) => (
                <button key={item} type="button" onClick={() => startRun('endless', item)}>
                  <strong>{difficultyName(item)}</strong>
                  <span>血量指数 {CONFIG.endlessHpExponent[item].toFixed(2)}</span>
                </button>
              ))}
            </div>
            <button type="button" className="text-btn" onClick={() => setPickDifficulty(false)}>
              再想想
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
