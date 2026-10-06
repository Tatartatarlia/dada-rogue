import { difficultyLabel } from '../game/logic'
import { lastRunText, type History } from '../game/history'
import { Medal } from './Medal'

export function HistoryDialog({ history, onClose }: { history: History; onClose: () => void }) {
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
          {history.trialBest > 0 ? (
            <div className="history-medal">
              <Medal text={null} size={72} />
              <p>通关的最高难度是{difficultyLabel(history.trialBest)}。</p>
            </div>
          ) : (
            <p>还没有通关。</p>
          )}
        </section>
        <section>
          <h3>达达利亚的极限</h3>
          {history.endless.length > 0 ? (
            <ul className="history-list">
              {history.endless.map((item) => (
                <li key={item.level}>
                  <span>{difficultyLabel(item.level)}</span>
                  <b>第 {item.wave} 波</b>
                </li>
              ))}
            </ul>
          ) : (
            <p>还没有打过。</p>
          )}
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
