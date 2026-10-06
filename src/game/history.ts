import { CONFIG } from '../config'
import { difficultyLabel, legacyDifficultyLevel } from './logic'
import type { GameMode } from '../types'

export type RunOutcome = 'clear' | 'dead' | 'settle'

export interface LastRun {
  mode: GameMode
  difficulty: number
  wave: number
  outcome: RunOutcome
}

export interface EndlessBest {
  level: number
  wave: number
}

export interface History {
  /** 试炼通关过的最高难度等级。0 表示还没通关。 */
  trialBest: number
  /** 旧存档里的试炼通关次数。用来把当时的通关换算成最高难度。 */
  trialClears: number
  /** 极限里已经打过的难度，各自保留到达过的最高波数。 */
  endless: EndlessBest[]
  last: LastRun | null
}

function emptyHistory(): History {
  return { trialBest: 0, trialClears: 0, endless: [], last: null }
}

function waveNumber(value: unknown): number {
  const wave = typeof value === 'number' ? value : 0
  return Number.isFinite(wave) ? Math.max(0, Math.floor(wave)) : 0
}

function readLegacyBest(): number {
  try {
    const value = Number(localStorage.getItem(CONFIG.bestStorageKey) || '0')
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  } catch {
    return 0
  }
}

function levelNumber(value: unknown): number {
  const level = typeof value === 'number' ? value : 0
  return Number.isInteger(level) && level >= 1 ? level : 0
}

function parseEndless(value: unknown, trialClears: number): { trialBest: number; endless: EndlessBest[] } {
  if (Array.isArray(value)) {
    const endless = value
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const row = item as Partial<EndlessBest>
        const level = levelNumber(row.level)
        const wave = waveNumber(row.wave)
        if (level < 1 || wave < 1) return null
        return { level, wave }
      })
      .filter((item): item is EndlessBest => item != null)
      .sort((a, b) => a.level - b.level)
    return { trialBest: 0, endless }
  }
  const old = value && typeof value === 'object' ? (value as { easy?: unknown; normal?: unknown; hard?: unknown }) : null
  const endless: EndlessBest[] = []
  const easy = waveNumber(old?.easy)
  const normal = waveNumber(old?.normal)
  const hard = waveNumber(old?.hard)
  if (easy > 0) endless.push({ level: 1, wave: easy })
  if (normal > 0) endless.push({ level: 3, wave: normal })
  if (hard > 0) endless.push({ level: 5, wave: hard })
  return { trialBest: trialClears > 0 ? 3 : 0, endless }
}

function parseLast(value: unknown): LastRun | null {
  if (!value || typeof value !== 'object') return null
  const last = value as Partial<LastRun> & { difficulty?: unknown }
  if (last.mode !== 'trial' && last.mode !== 'endless') return null
  if (last.outcome !== 'clear' && last.outcome !== 'dead' && last.outcome !== 'settle') return null
  return {
    mode: last.mode,
    difficulty: legacyDifficultyLevel(last.difficulty, last.mode),
    wave: waveNumber(last.wave),
    outcome: last.outcome,
  }
}

export function readHistory(): History {
  try {
    const raw = localStorage.getItem(CONFIG.historyStorageKey)
    if (!raw) {
      const history = emptyHistory()
      const legacy = readLegacyBest()
      if (legacy > 0) history.endless = [{ level: 1, wave: legacy }]
      return history
    }
    const data = JSON.parse(raw) as Partial<History> & { trialBest?: unknown }
    const trialClears = waveNumber(data.trialClears)
    const parsed = parseEndless(data.endless, trialClears)
    const trialBest = levelNumber(data.trialBest) || parsed.trialBest
    return {
      trialBest,
      trialClears,
      endless: parsed.endless,
      last: parseLast(data.last),
    }
  } catch {
    return emptyHistory()
  }
}

export function endlessWave(history: History, level: number): number {
  return history.endless.find((item) => item.level === level)?.wave ?? 0
}

export function writeHistory(history: History): void {
  try {
    localStorage.setItem(CONFIG.historyStorageKey, JSON.stringify(history))
  } catch {
    /* 记不住时，这一局的结算界面仍然照常显示 */
  }
}

export function recordRun(history: History, run: LastRun): { history: History; record: boolean } {
  const level = Math.max(1, Math.floor(run.difficulty) || 1)
  const last: LastRun = {
    mode: run.mode,
    difficulty: level,
    wave: Math.max(0, run.wave),
    outcome: run.outcome,
  }
  const cleared = run.mode === 'trial' && run.outcome === 'clear'
  const next: History = {
    trialBest: cleared ? Math.max(history.trialBest, level) : history.trialBest,
    trialClears: history.trialClears + (cleared ? 1 : 0),
    endless: history.endless.map((item) => ({ ...item })),
    last,
  }
  let record = false
  if (run.mode === 'endless' && last.wave > endlessWave(history, level)) {
    next.endless = next.endless.filter((item) => item.level !== level)
    if (last.wave > 0) next.endless.push({ level, wave: last.wave })
    next.endless.sort((a, b) => a.level - b.level)
    record = last.wave > 0
  }
  writeHistory(next)
  return { history: next, record }
}

export function trialMedalText(level: number): string {
  const safe = Math.max(1, Math.floor(level) || 1)
  return `达达利亚通关了难度等级${safe}的执行官的试炼！`
}

export function lastRunText(last: LastRun | null): string {
  if (!last) return '还没有打过。'
  const name = difficultyLabel(last.difficulty)
  if (last.mode === 'trial') {
    if (last.outcome === 'clear') return `执行官的试炼·${name}，通关了。`
    if (last.outcome === 'settle') {
      return last.wave > 0 ? `执行官的试炼·${name}，第 ${last.wave} 波收起了武器。` : `执行官的试炼·${name}，还没迎战就收起了武器。`
    }
    return `执行官的试炼·${name}，在至冬的寒风里撑到了第 ${Math.max(1, last.wave)} 波。`
  }
  if (last.outcome === 'settle') {
    return last.wave > 0 ? `极限·${name}，第 ${last.wave} 波收起了武器。` : `极限·${name}，还没迎战就收起了武器。`
  }
  return `极限·${name}，撑到了第 ${Math.max(1, last.wave)} 波。`
}
