import { CONFIG } from '../config'
import { difficultyName, lastRunText, trialMedalText, type History } from '../game/history'
import type { Difficulty } from '../types'
import { Medal } from './Medal'

const ORDER: Difficulty[] = ['easy', 'normal', 'hard']

export function HistoryDialog({ history, onClose }: { history: History; onClose: () => void }) {
  const sentence = trialMedalText(history.trialClears)
  return (
    <div
      className="event-result"
      role="dialog"
      aria-modal="true"
      aria-label="历史记录"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="event-result-card history-card">
        <h2>历史记录</h2>
        <section>
          <h3>执行官的试炼</h3>
          {history.trialClears > 0 ? (
            <div className="history-medal">
              <Medal text={null} size={72} />
              <p>{sentence}</p>
            </div>
          ) : (
            <p>还没有通关。</p>
          )}
        </section>
        <section>
          <h3>达达利亚的极限</h3>
          <ul className="history-list">
            {ORDER.map((difficulty) => {
              const best = history.endless[difficulty]
              const exponent = CONFIG.endlessHpExponent[difficulty]
              return (
                <li key={difficulty}>
                  <span>
                    {difficultyName(difficulty)} · 指数 {exponent.toFixed(2)}
                  </span>
                  <b>{best > 0 ? `第 ${best} 波` : '尚无记录'}</b>
                </li>
              )
            })}
          </ul>
        </section>
        <section>
          <h3>最近一局</h3>
          <p>{lastRunText(history.last)}</p>
        </section>
        <button type="button" className="text-btn" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}
