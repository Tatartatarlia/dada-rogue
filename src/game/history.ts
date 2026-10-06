import { CONFIG } from '../config'
import type { Difficulty, GameMode } from '../types'

export type RunOutcome = 'clear' | 'dead' | 'settle'

export interface LastRun {
  mode: GameMode
  difficulty: Difficulty | null
  wave: number
  outcome: RunOutcome
}

export interface History {
  trialClears: number
  endless: Record<Difficulty, number>
  last: LastRun | null
}

const EMPTY_ENDLESS: Record<Difficulty, number> = { easy: 0, normal: 0, hard: 0 }

function emptyHistory(): History {
  return { trialClears: 0, endless: { ...EMPTY_ENDLESS }, last: null }
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

function parseLast(value: unknown): LastRun | null {
  if (!value || typeof value !== 'object') return null
  const last = value as Partial<LastRun>
  if (last.mode !== 'trial' && last.mode !== 'endless') return null
  if (last.outcome !== 'clear' && last.outcome !== 'dead' && last.outcome !== 'settle') return null
  const difficulty = last.difficulty === 'easy' || last.difficulty === 'normal' || last.difficulty === 'hard' ? last.difficulty : null
  return {
    mode: last.mode,
    difficulty: last.mode === 'trial' ? null : (difficulty ?? 'easy'),
    wave: waveNumber(last.wave),
    outcome: last.outcome,
  }
}

export function readHistory(): History {
  try {
    const raw = localStorage.getItem(CONFIG.historyStorageKey)
    if (!raw) {
      const history = emptyHistory()
      history.endless.easy = readLegacyBest()
      return history
    }
    const data = JSON.parse(raw) as Partial<History>
    const endless = data.endless
    return {
      trialClears: waveNumber(data.trialClears),
      endless: {
        easy: waveNumber(endless?.easy),
        normal: waveNumber(endless?.normal),
        hard: waveNumber(endless?.hard),
      },
      last: parseLast(data.last),
    }
  } catch {
    return emptyHistory()
  }
}

export function writeHistory(history: History): void {
  try {
    localStorage.setItem(CONFIG.historyStorageKey, JSON.stringify(history))
  } catch {
    /* 记不住时，这一局的结算界面仍然照常显示 */
  }
}

export function recordRun(history: History, run: LastRun): { history: History; record: boolean } {
  const last: LastRun = {
    mode: run.mode,
    difficulty: run.mode === 'trial' ? null : (run.difficulty ?? 'easy'),
    wave: Math.max(0, run.wave),
    outcome: run.outcome,
  }
  const next: History = {
    trialClears: history.trialClears + (run.mode === 'trial' && run.outcome === 'clear' ? 1 : 0),
    endless: { ...history.endless },
    last,
  }
  let record = false
  if (run.mode === 'endless' && last.difficulty && run.wave > history.endless[last.difficulty]) {
    next.endless[last.difficulty] = run.wave
    record = run.wave > 0
  }
  writeHistory(next)
  return { history: next, record }
}

export function difficultyName(difficulty: Difficulty): string {
  if (difficulty === 'hard') return '困难'
  if (difficulty === 'normal') return '普通'
  return '简单'
}

export function trialMedalText(clears: number): string {
  return `达达利亚一共通关了${clears}次执行官的试炼！`
}

export function lastRunText(last: LastRun | null): string {
  if (!last) return '还没有打过。'
  if (last.mode === 'trial') {
    if (last.outcome === 'clear') return `执行官的试炼，通关了。`
    if (last.outcome === 'settle') {
      return last.wave > 0 ? `执行官的试炼，第 ${last.wave} 波收起了武器。` : '执行官的试炼，还没迎战就收起了武器。'
    }
    return `执行官的试炼，在至冬的寒风里撑到了第 ${Math.max(1, last.wave)} 波。`
  }
  const name = difficultyName(last.difficulty ?? 'easy')
  if (last.outcome === 'settle') {
    return last.wave > 0 ? `极限·${name}，第 ${last.wave} 波收起了武器。` : `极限·${name}，还没迎战就收起了武器。`
  }
  return `极限·${name}，撑到了第 ${Math.max(1, last.wave)} 波。`
}
