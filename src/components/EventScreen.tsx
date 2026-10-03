import { useState } from 'react'
import { CONFIG } from '../config'
import type { Cell, Weapon } from '../types'
import { play } from '../game/audio'
import {
  rollBargainDown,
  rollFrostOutcome,
  rollRiftOutcome,
  type GameEvent,
} from '../game/events'
import { WeaponView } from './WeaponView'

type Notice = {
  text: string
  event: GameEvent
  bargain?: { downId: string; choices: Weapon[]; picking: boolean }
}

export function EventScreen({
  wave,
  events,
  bag,
  cells,
  onPick,
}: {
  wave: number
  events: GameEvent[]
  bag: Weapon[]
  cells: Cell[]
  onPick: (event: GameEvent) => void
}) {
  const [notice, setNotice] = useState<Notice | null>(null)

  function choose(event: GameEvent) {
    if (notice) return
    if (event.kind === 'rift') {
      const rolled = rollRiftOutcome(bag)
      if (!rolled) return
      play('click')
      setNotice({ text: rolled.text, event: { ...event, rift: rolled.rift } })
      return
    }
    if (event.kind === 'frost') {
      const rolled = rollFrostOutcome(bag, cells)
      if (!rolled) return
      play('click')
      setNotice({ text: rolled.text, event: { ...event, frost: rolled.frost } })
      return
    }
    if (event.kind === 'bargain') {
      const rolled = rollBargainDown(bag)
      if (!rolled) return
      play('click')
      setNotice({
        text: rolled.text,
        event,
        bargain: { downId: rolled.downId, choices: rolled.choices, picking: false },
      })
      return
    }
    onPick(event)
  }

  function confirm(event: GameEvent) {
    onPick(event)
  }

  return (
    <main className="events">
      <p className="eyebrow">第 {wave} 波结束</p>
      <h1>选一个事件</h1>
      <p className="event-lead">三张里只能选一张。</p>
      <div className="event-grid">
        {events.map((event) => (
          <button key={event.id} type="button" className="event-card" disabled={notice !== null} onClick={() => choose(event)}>
            <span className="event-name">{event.name}</span>
            <p className="event-body">{event.content}</p>
            <p className="event-flavor">{event.description}</p>
          </button>
        ))}
      </div>

      {notice && (
        <div className="event-result" role="dialog" aria-modal="true" aria-labelledby="event-result-title">
          <div className="event-result-card">
            <h2 id="event-result-title">{notice.event.name}</h2>
            <p className="event-result-text">{notice.text}</p>
            {notice.bargain?.picking ? (
              <div className="event-choices">
                <p className="event-result-text">指定另一件武器升1级。</p>
                {notice.bargain.choices.map((weapon) => {
                  const downId = notice.bargain?.downId ?? ''
                  return (
                    <button
                      key={weapon.id}
                      type="button"
                      className="event-choice"
                      onClick={() => confirm({ ...notice.event, bargain: { downId, upId: weapon.id } })}
                    >
                      <WeaponView type={weapon.type} level={weapon.level} rotation={weapon.rotation} cell={28} />
                      <span>
                        {CONFIG.weapons[weapon.type].name} {weapon.level}级升为{weapon.level + 1}级
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : notice.bargain ? (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  if (!notice.bargain) return
                  play('click')
                  setNotice({ ...notice, bargain: { ...notice.bargain, picking: true } })
                }}
              >
                指定升级的武器
              </button>
            ) : (
              <button type="button" className="primary" onClick={() => confirm(notice.event)}>
                进入商店
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
