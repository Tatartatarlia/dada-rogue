import { useEffect, useRef, useState } from 'react'
import { CONFIG } from '../config'
import type { Cell, Expansion, Weapon } from '../types'
import {
  attackOf,
  boundsOf,
  canAttach,
  canPlaceWeapon,
  effectText,
  enemyHpForWave,
  expansionShape,
  isBagWeaponLegal,
  keyOf,
  mapRotate,
  resolveWeaponDrop,
  rotateInPlace,
  shapeOf,
  tryAutoAttach,
  tryAutoPlace,
  weaponAt,
  weaponDps,
  worldCells,
} from '../game/logic'
import { play } from '../game/audio'
import { ExpansionView, WeaponView } from './WeaponView'

type Drag =
  | {
      kind: 'weapon'
      weapon: Weapon
      rotation: number
      grab: Cell
      x: number
      y: number
      ox: number
      oy: number
      cursor: Cell | null
      overShop: boolean
    }
  | {
      kind: 'expand'
      count: 1 | 2
      rotation: number
      grab: Cell
      x: number
      y: number
      ox: number
      oy: number
      cursor: Cell | null
      overShop: boolean
    }

function dragFollowsBag(drag: Drag | null): drag is Drag {
  if (!drag) return false
  if (drag.kind === 'expand') return true
  return drag.weapon.where === 'shop'
}

function pointDrag(drag: Drag, cursor: Cell | null, overShop: boolean): Drag {
  if (drag.kind === 'weapon') return { ...drag, cursor, overShop }
  return { ...drag, cursor, overShop }
}

function rotateDrag(drag: Drag): Drag {
  if (drag.kind === 'weapon') {
    const shape = shapeOf(drag.weapon.type, drag.rotation)
    return { ...drag, rotation: (drag.rotation + 1) % 4, grab: mapRotate(shape, drag.grab) }
  }
  const shape = expansionShape(drag.count, drag.rotation)
  return { ...drag, rotation: (drag.rotation + 1) % 4, grab: mapRotate(shape, drag.grab) }
}

function cellFromPoint(clientX: number, clientY: number, board: HTMLElement, origin: Cell, cell: number): Cell | null {
  const rect = board.getBoundingClientRect()
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) return null
  return {
    x: origin.x + Math.floor(localX / cell),
    y: origin.y + Math.floor(localY / cell),
  }
}

export function ShopScreen({
  wave,
  cells,
  weapons,
  expansion,
  onCells,
  onWeapons,
  onExpansion,
  onStart,
  onSettle,
  refreshed,
  offerUsed,
  onRefresh,
  canSave,
  onSave,
  previousSaveWave,
}: {
  wave: number
  cells: Cell[]
  weapons: Weapon[]
  expansion: Expansion | null
  onCells: (cells: Cell[]) => void
  onWeapons: (weapons: Weapon[]) => void
  onExpansion: (expansion: Expansion | null) => void
  onStart: () => void
  onSettle: () => void
  refreshed: boolean
  offerUsed: boolean
  onRefresh: () => void
  canSave: boolean
  onSave: () => boolean
  previousSaveWave: number | null
}) {
  const boardRef = useRef<HTMLDivElement>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const shopRef = useRef<HTMLElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const swallowClick = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [tip, setTip] = useState<string | null>(wave === 1 ? '先把武器拖进背包，再去迎敌' : '生命已回满')
  const [askEnd, setAskEnd] = useState(false)
  const [askOverwrite, setAskOverwrite] = useState(false)
  const tipTimer = useRef(0)
  const cellsRef = useRef(cells)
  const weaponsRef = useRef(weapons)
  const expansionRef = useRef(expansion)
  const originRef = useRef<Cell>({ x: 0, y: 0 })
  const cellRef = useRef(CONFIG.cellSize)
  const pendingRef = useRef<{ pointerId: number; x: number; y: number; start: () => void } | null>(null)
  const pullRef = useRef<(clientY: number, previousY: number | null) => void>(() => {})
  const armBagFollowRef = useRef<(source: Element | null, pointerId: number) => void>(() => {})
  const endBagScrollRef = useRef<() => void>(() => {})
  const [boardWidth, setBoardWidth] = useState(() =>
    typeof window === 'undefined' || window.innerWidth > 900 ? CONFIG.boardMaxWidth : Math.max(160, window.innerWidth - 64),
  )
  const onCellsRef = useRef(onCells)
  const onWeaponsRef = useRef(onWeapons)
  const onExpansionRef = useRef(onExpansion)

  const bounds = boundsOf(cells, CONFIG.boardPad)
  const cols = bounds.maxX - bounds.minX + 1
  const rows = bounds.maxY - bounds.minY + 1
  const cell = Math.max(
    CONFIG.cellSizeMin,
    Math.min(CONFIG.cellSize, Math.floor(CONFIG.boardMaxWidth / cols), Math.floor(boardWidth / cols)),
  )
  const origin = { x: bounds.minX, y: bounds.minY }
  const owned = new Set(cells.map(keyOf))

  function flash(text: string) {
    setTip(text)
    window.clearTimeout(tipTimer.current)
    tipTimer.current = window.setTimeout(() => setTip(null), 2400)
  }

  function commitDrag(next: Drag | null) {
    dragRef.current = next
    setDrag(next)
  }

  function pointingAtShop(clientX: number, clientY: number): boolean {
    const shop = shopRef.current
    if (!shop) return false
    const rect = shop.getBoundingClientRect()
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  }

  function returnBagWeaponToShop(current: Extract<Drag, { kind: 'weapon' }>, target: EventTarget | null): boolean {
    if (current.weapon.where !== 'bag') return false
    if (!pointingAtShop(current.x, current.y) && !(target instanceof Element && target.closest('.offers'))) return false
    const shopTargetId =
      target instanceof Element ? target.closest('[data-weapon-id]')?.getAttribute('data-weapon-id') : null
    if (shopTargetId && shopTargetId !== current.weapon.id) {
      const result = resolveWeaponDrop({
        cells: cellsRef.current,
        weapons: weaponsRef.current,
        weapon: current.weapon,
        rotation: current.rotation,
        anchor: { x: 0, y: 0 },
        cursor: null,
        shopTargetId,
      })
      if (result?.mergedLevel) {
        onWeaponsRef.current(result.weapons)
        play('merge')
        flash(`合成成功，等级 ${result.mergedLevel}`)
        return true
      }
    }
    onWeaponsRef.current(
      weaponsRef.current.map((item) =>
        item.id === current.weapon.id ? { ...item, where: 'shop', x: 0, y: 0 } : item,
      ),
    )
    play('click')
    flash(`已把${CONFIG.weapons[current.weapon.type].name}放回商店`)
    return true
  }

  const finishRef = useRef<(clientX: number, clientY: number, target: EventTarget | null) => void>(() => {})
  const finishDrop = (clientX: number, clientY: number, target: EventTarget | null) => {
    endBagScrollRef.current()
    const current = dragRef.current
    if (!current) return
    const moved = Math.hypot(clientX - current.ox, clientY - current.oy) >= 6
    if (target instanceof Element && target.closest('button')) {
      if (moved && current.kind === 'weapon' && returnBagWeaponToShop({ ...current, x: clientX, y: clientY }, target)) {
        swallowClick.current = true
      }
      commitDrag(null)
      return
    }
    commitDrag(null)
    if (!moved) return
    if (current.kind === 'weapon' && returnBagWeaponToShop({ ...current, x: clientX, y: clientY }, target)) return
    const board = boardRef.current
    const cursor = board
      ? cellFromPoint(clientX, clientY, board, originRef.current, cellRef.current)
      : null
    if (current.kind === 'expand') {
      if (!cursor || !expansionRef.current) return
      const anchor = { x: cursor.x - current.grab.x, y: cursor.y - current.grab.y }
      if (!canAttach(cellsRef.current, current.count, current.rotation, anchor)) {
        flash('这两格得连在背包边上')
        return
      }
      const added = expansionShape(current.count, current.rotation).map((part) => ({
        x: part.x + anchor.x,
        y: part.y + anchor.y,
      }))
      onCellsRef.current([...cellsRef.current, ...added])
      onExpansionRef.current(null)
      play('place')
      flash(current.count === 2 ? '背包扩了两格' : '背包扩了一格')
      return
    }
    const anchor = cursor
      ? { x: cursor.x - current.grab.x, y: cursor.y - current.grab.y }
      : { x: 0, y: 0 }
    let shopTargetId: string | null = null
    if (!cursor && target instanceof Element) {
      shopTargetId = target.closest('[data-weapon-id]')?.getAttribute('data-weapon-id') ?? null
    }
    if (!cursor && (!shopTargetId || shopTargetId === current.weapon.id)) return
    const result = resolveWeaponDrop({
      cells: cellsRef.current,
      weapons: weaponsRef.current,
      weapon: current.weapon,
      rotation: current.rotation,
      anchor,
      cursor,
      shopTargetId,
    })
    if (!result) return
    onWeaponsRef.current(result.weapons)
    if (result.mergedLevel) {
      play('merge')
      flash(`合成成功，等级 ${result.mergedLevel}`)
      return
    }
    const placed = result.weapons.find((item) => item.id === current.weapon.id)
    const legal = placed ? isBagWeaponLegal(cellsRef.current, result.weapons, placed) : false
    play('place')
    flash(legal ? '已装进背包' : '这件还没放进格子，转一下或挪开才能出发')
  }

  useEffect(() => {
    cellsRef.current = cells
    weaponsRef.current = weapons
    expansionRef.current = expansion
    onCellsRef.current = onCells
    onWeaponsRef.current = onWeapons
    onExpansionRef.current = onExpansion
    originRef.current = origin
    cellRef.current = cell
    finishRef.current = finishDrop
    pullRef.current = (clientY, previousY) => {
      if (window.innerWidth > 900) return
      const current = dragRef.current
      if (!dragFollowsBag(current)) return
      const board = boardRef.current
      if (!board) return
      const rect = board.getBoundingClientRect()
      const overBoard = clientY >= rect.top && clientY <= rect.bottom
      if (rect.top >= 0 && (overBoard || rect.bottom <= clientY)) return
      let distance = 0
      if (previousY != null && clientY < previousY) {
        const lift = previousY - clientY
        if (rect.bottom < clientY) distance = Math.min(lift, clientY - rect.bottom)
        else if (rect.top < 0) distance = Math.min(lift, -rect.top)
      }
      const edge = Math.min(160, window.innerHeight * 0.34)
      if (clientY < edge) {
        const depth = (edge - Math.max(0, clientY)) / edge
        const room = rect.bottom < clientY ? clientY - rect.bottom : Math.max(0, -rect.top)
        distance = Math.max(distance, Math.min(room, 8 + depth * 22))
      }
      if (distance < 1) return
      const before = window.scrollY
      window.scrollBy(0, -distance)
      if (window.scrollY === before) boardScrollRef.current?.scrollBy(0, -distance)
      const cursor = cellFromPoint(current.x, current.y, board, originRef.current, cellRef.current)
      const cursorSame =
        cursor == null
          ? current.cursor == null
          : current.cursor != null && cursor.x === current.cursor.x && cursor.y === current.cursor.y
      const overShop = pointingAtShop(current.x, current.y)
      if (cursorSame && overShop === current.overShop) return
      const next = pointDrag(current, cursor, overShop)
      dragRef.current = next
      setDrag(next)
    }
  })

  useEffect(() => {
    const node = boardScrollRef.current
    if (!node) return
    const measure = () => {
      const style = getComputedStyle(node)
      const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      setBoardWidth(Math.max(1, node.clientWidth - pad))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let scrollLoop = 0
    const guard = (event: TouchEvent) => {
      const current = dragRef.current
      if (window.innerWidth > 900) return
      if (!dragFollowsBag(current)) return
      if (event.cancelable) event.preventDefault()
    }
    const endBagScroll = () => {
      cancelAnimationFrame(scrollLoop)
      document.documentElement.classList.remove('shop-drag-scroll')
      window.removeEventListener('touchmove', guard)
    }
    endBagScrollRef.current = endBagScroll
    armBagFollowRef.current = (source, pointerId) => {
      const current = dragRef.current
      if (window.innerWidth > 900) return
      if (!dragFollowsBag(current)) return
      if (source) {
        try {
          source.setPointerCapture(pointerId)
        } catch {
          /* 触摸已经结束时，浏览器会拒绝捕获 */
        }
      }
      document.documentElement.classList.add('shop-drag-scroll')
      window.addEventListener('touchmove', guard, { passive: false })
      cancelAnimationFrame(scrollLoop)
      const tick = () => {
        const dragging = dragRef.current
        if (!dragging) return
        pullRef.current(dragging.y, null)
        scrollLoop = requestAnimationFrame(tick)
      }
      scrollLoop = requestAnimationFrame(tick)
    }
    const move = (event: PointerEvent) => {
      const pending = pendingRef.current
      if (pending && event.pointerId === pending.pointerId && !dragRef.current) {
        const dx = event.clientX - pending.x
        const dy = event.clientY - pending.y
        if (Math.abs(dy) >= 12 && Math.abs(dy) > Math.abs(dx)) {
          pendingRef.current = null
          return
        }
        if (Math.hypot(dx, dy) >= 12 && Math.abs(dx) >= Math.abs(dy)) {
          pending.start()
          pendingRef.current = null
        } else {
          return
        }
      }
      const current = dragRef.current
      if (!current) return
      pullRef.current(event.clientY, current.y)
      const board = boardRef.current
      const cursor = board
        ? cellFromPoint(event.clientX, event.clientY, board, originRef.current, cellRef.current)
        : null
      const next = {
        ...current,
        x: event.clientX,
        y: event.clientY,
        cursor,
        overShop: pointingAtShop(event.clientX, event.clientY),
      }
      dragRef.current = next
      setDrag(next)
    }
    const up = (event: PointerEvent) => {
      pendingRef.current = null
      endBagScroll()
      finishRef.current(event.clientX, event.clientY, event.target)
    }
    const key = (event: KeyboardEvent) => {
      if ((event.key === 'r' || event.key === 'R') && dragRef.current) {
        event.preventDefault()
        commitDrag(rotateDrag(dragRef.current))
      }
    }
    const menu = (event: MouseEvent) => {
      if (!dragRef.current) return
      event.preventDefault()
      commitDrag(rotateDrag(dragRef.current))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', key)
    window.addEventListener('contextmenu', menu)
    const clearSwallow = () => {
      swallowClick.current = false
    }
    window.addEventListener('pointerdown', clearSwallow, true)
    return () => {
      endBagScroll()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', key)
      window.removeEventListener('contextmenu', menu)
      window.removeEventListener('pointerdown', clearSwallow, true)
      window.clearTimeout(tipTimer.current)
    }
  }, [])

  function beginWeaponDrag(
    clientX: number,
    clientY: number,
    originX: number,
    originY: number,
    weapon: Weapon,
    source: Element | null,
    pointerId: number,
  ) {
    const shape = shapeOf(weapon.type, weapon.rotation)
    const local = shape.find((part) => part.x === 0 && part.y === 0) ?? shape[0]
    if (!local) return
    let grab = local
    if (weapon.where === 'bag') {
      const board = boardRef.current
      const cursor = board ? cellFromPoint(originX, originY, board, origin, cell) : null
      if (cursor) grab = { x: cursor.x - weapon.x, y: cursor.y - weapon.y }
    }
    const board = boardRef.current
    const pointerCell = board ? cellFromPoint(clientX, clientY, board, origin, cell) : null
    commitDrag({
      kind: 'weapon',
      weapon,
      rotation: weapon.rotation,
      grab,
      x: clientX,
      y: clientY,
      ox: originX,
      oy: originY,
      cursor: pointerCell,
      overShop: pointingAtShop(clientX, clientY),
    })
    if (weapon.where === 'shop') armBagFollowRef.current(source, pointerId)
  }

  function startWeaponDrag(event: React.PointerEvent, weapon: Weapon, deferTouch = false) {
    if (event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button')) return
    const originX = event.clientX
    const originY = event.clientY
    if (deferTouch && event.pointerType === 'touch') {
      pendingRef.current = {
        pointerId: event.pointerId,
        x: originX,
        y: originY,
        start: () =>
          beginWeaponDrag(
            originX,
            originY,
            originX,
            originY,
            weapon,
            event.currentTarget instanceof Element ? event.currentTarget : null,
            event.pointerId,
          ),
      }
      return
    }
    beginWeaponDrag(
      originX,
      originY,
      originX,
      originY,
      weapon,
      event.currentTarget instanceof Element ? event.currentTarget : null,
      event.pointerId,
    )
  }

  function beginExpandDrag(
    clientX: number,
    clientY: number,
    originX: number,
    originY: number,
    source: Element | null,
    pointerId: number,
  ) {
    if (!expansion) return
    const shape = expansionShape(expansion.count, expansion.rotation)
    const grab = shape[Math.floor(shape.length / 2)] ?? { x: 0, y: 0 }
    const board = boardRef.current
    commitDrag({
      kind: 'expand',
      count: expansion.count,
      rotation: expansion.rotation,
      grab,
      x: clientX,
      y: clientY,
      ox: originX,
      oy: originY,
      cursor: board ? cellFromPoint(clientX, clientY, board, origin, cell) : null,
      overShop: pointingAtShop(clientX, clientY),
    })
    armBagFollowRef.current(source, pointerId)
  }

  function startExpandDrag(event: React.PointerEvent) {
    if (!expansion || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button')) return
    const originX = event.clientX
    const originY = event.clientY
    if (event.pointerType === 'touch') {
      pendingRef.current = {
        pointerId: event.pointerId,
        x: originX,
        y: originY,
        start: () =>
          beginExpandDrag(
            originX,
            originY,
            originX,
            originY,
            event.currentTarget instanceof Element ? event.currentTarget : null,
            event.pointerId,
          ),
      }
      return
    }
    beginExpandDrag(
      originX,
      originY,
      originX,
      originY,
      event.currentTarget instanceof Element ? event.currentTarget : null,
      event.pointerId,
    )
  }

  function spinWeapon(weapon: Weapon) {
    onWeapons(weapons.map((item) => (item.id === weapon.id ? rotateInPlace(item) : item)))
    play('click')
  }

  function autoPlace(weapon: Weapon) {
    if (swallowClick.current) return
    const placed = tryAutoPlace(cells, weapons, weapon)
    if (!placed) {
      flash('背包里没有能放下的空位')
      return
    }
    onWeapons(weapons.map((item) => (item.id === weapon.id ? placed : item)))
    play('place')
    flash(`已放入${CONFIG.weapons[weapon.type].name}`)
  }

  function autoAttach() {
    if (swallowClick.current) return
    if (!expansion) return
    const next = tryAutoAttach(cells, expansion)
    if (!next) {
      flash('周围没有能贴上的位置')
      return
    }
    onCells(next)
    onExpansion(null)
    play('place')
    flash(expansion.count === 2 ? '背包扩了两格' : '背包扩了一格')
  }

  const bagWeapons = weapons.filter((weapon) => weapon.where === 'bag')
  const shopWeapons = weapons.filter((weapon) => weapon.where === 'shop')
  const used = bagWeapons.reduce((sum, weapon) => sum + shapeOf(weapon.type, weapon.rotation).length, 0)
  const dps = bagWeapons.reduce((sum, weapon) => sum + weaponDps(weapon.type, weapon.level), 0)
  const blocked = bagWeapons.some((weapon) => !isBagWeaponLegal(cells, weapons, weapon))

  let preview: { cells: Cell[]; tone: 'ok' | 'bad' | 'merge' } | null = null
  if (drag?.cursor) {
    const cursor = drag.cursor
    if (cursor) {
      if (drag.kind === 'weapon') {
        const hovered = weaponAt(
          weapons.filter((weapon) => weapon.id !== drag.weapon.id),
          cursor,
        )
        if (hovered && hovered.type === drag.weapon.type && hovered.level === drag.weapon.level) {
          preview = { cells: worldCells(hovered), tone: 'merge' }
        } else {
          const anchor = { x: cursor.x - drag.grab.x, y: cursor.y - drag.grab.y }
          const piece = shapeOf(drag.weapon.type, drag.rotation).map((part) => ({
            x: part.x + anchor.x,
            y: part.y + anchor.y,
          }))
          const ok = canPlaceWeapon(cells, weapons, drag.weapon.type, drag.rotation, anchor, drag.weapon.id)
          preview = { cells: piece, tone: ok ? 'ok' : 'bad' }
        }
      } else {
        const anchor = { x: cursor.x - drag.grab.x, y: cursor.y - drag.grab.y }
        const piece = expansionShape(drag.count, drag.rotation).map((part) => ({
          x: part.x + anchor.x,
          y: part.y + anchor.y,
        }))
        const ok = canAttach(cells, drag.count, drag.rotation, anchor)
        preview = { cells: piece, tone: ok ? 'ok' : 'bad' }
      }
    }
  }

  return (
    <section className="shop">
      <header className="shop-head">
        <div>
          <p className="eyebrow">第 {wave} 波之前</p>
          <h2>行囊</h2>
        </div>
        <div className="hp-readout">
          <span>达达利亚</span>
          <div className="hp-track">
            <div className="hp-fill" style={{ width: '100%' }} />
          </div>
          <b>
            {CONFIG.playerMaxHp}/{CONFIG.playerMaxHp}
          </b>
        </div>
      </header>

      <div className="shop-layout">
        <div className="bag-panel">
          <div className="panel-label">
            <span>背包 {used}/{cells.length}</span>
            <span>每秒伤害约 {Math.round(dps)}</span>
          </div>
          <div className="board-scroll" ref={boardScrollRef}>
            <div
              ref={boardRef}
              className="board"
              style={{ width: cols * cell, height: rows * cell + 28 }}
              onPointerDown={(event) => {
                if (event.target instanceof Element && event.target.closest('button')) return
                const cursor = cellFromPoint(event.clientX, event.clientY, event.currentTarget, origin, cell)
                if (!cursor) return
                const weapon = weaponAt(weapons, cursor)
                if (weapon) startWeaponDrag(event, weapon)
              }}
              onContextMenu={(event) => event.preventDefault()}
            >
              {Array.from({ length: rows }, (_, row) =>
                Array.from({ length: cols }, (_, col) => {
                  const x = origin.x + col
                  const y = origin.y + row
                  const isOwned = owned.has(keyOf({ x, y }))
                  return (
                    <div
                      key={keyOf({ x, y })}
                      className={isOwned ? 'slot owned' : 'slot empty'}
                      style={{ left: col * cell, top: row * cell, width: cell, height: cell }}
                    />
                  )
                }),
              )}
              {bagWeapons.map((weapon) => {
                const shape = shapeOf(weapon.type, weapon.rotation)
                const width = (Math.max(...shape.map((part) => part.x)) + 1) * cell
                const height = (Math.max(...shape.map((part) => part.y)) + 1) * cell
                const hidden = drag?.kind === 'weapon' && drag.weapon.id === weapon.id
                return (
                  <div
                    key={weapon.id}
                    className="placed"
                    style={{
                      left: (weapon.x - origin.x) * cell,
                      top: (weapon.y - origin.y) * cell,
                      width,
                      height,
                      opacity: hidden ? 0 : 1,
                    }}
                  >
                    <WeaponView type={weapon.type} level={weapon.level} rotation={weapon.rotation} cell={cell} />
                  </div>
                )
              })}
              {bagWeapons.map((weapon) => {
                if (isBagWeaponLegal(cells, weapons, weapon)) return null
                return worldCells(weapon).map((part) => (
                  <div
                    key={`bad-${weapon.id}-${part.x}-${part.y}`}
                    className="preview bad"
                    style={{
                      left: (part.x - origin.x) * cell + 3,
                      top: (part.y - origin.y) * cell + 3,
                      width: cell - 6,
                      height: cell - 6,
                    }}
                  />
                ))
              })}
              {bagWeapons.map((weapon) => {
                const shape = shapeOf(weapon.type, weapon.rotation)
                const width = (Math.max(...shape.map((part) => part.x)) + 1) * cell
                const height = (Math.max(...shape.map((part) => part.y)) + 1) * cell
                const hidden = drag?.kind === 'weapon' && drag.weapon.id === weapon.id
                if (hidden) return null
                return (
                  <button
                    key={`spin-${weapon.id}`}
                    type="button"
                    className="spin-btn"
                    style={{
                      left: (weapon.x - origin.x) * cell + width / 2,
                      top: (weapon.y - origin.y) * cell + height + 4,
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    onClick={() => spinWeapon(weapon)}
                  >
                    旋转
                  </button>
                )
              })}
              {preview?.cells.map((part) => (
                <div
                  key={`preview-${part.x}-${part.y}`}
                  className={`preview ${preview.tone}`}
                  style={{
                    left: (part.x - origin.x) * cell + 3,
                    top: (part.y - origin.y) * cell + 3,
                    width: cell - 6,
                    height: cell - 6,
                  }}
                />
              ))}
              {bagWeapons.length === 0 && <p className="bag-hint">把武器拖到这些格子里</p>}
            </div>
          </div>
          <p className="tip">
            {blocked
              ? '有武器没放进格子，点它下方的旋转，或拖到空位后才能出发'
              : (tip ?? '武器可以先放在任意位置。点下方的旋转调整方向，拖回商店可以放回去。')}
          </p>
        </div>

        <aside
          ref={shopRef}
          className={drag?.kind === 'weapon' && drag.weapon.where === 'bag' && drag.overShop ? 'offers drop-ready' : 'offers'}
        >
          <div className="shop-title">
            <h3>商店</h3>
            <button
              type="button"
              className="text-btn"
              disabled={refreshed || offerUsed}
              title={offerUsed ? '装入背包或合成过商店武器后，这一波不能刷新' : '这一波还没动过商店武器时可以刷新一次'}
              onClick={() => {
                if (swallowClick.current || refreshed || offerUsed) return
                onRefresh()
                flash('商店已刷新，这一波不能再换')
              }}
            >
              {refreshed ? '本波已刷新' : offerUsed ? '已使用武器' : '刷新'}
            </button>
          </div>
          <p className="offer-note">
            {drag?.kind === 'weapon' && drag.weapon.where === 'bag' && drag.overShop
              ? '松手，这件武器会回到商店'
              : `下一波 ${CONFIG.enemyCount} 名敌人，每位 ${enemyHpForWave(wave)} 点生命。三件都可以拿走，放不下的会留下。`}
          </p>
          {shopWeapons.map((weapon) => {
            const stat = CONFIG.weapons[weapon.type]
            const attack = attackOf(weapon.type, weapon.level)
            return (
              <article
                key={weapon.id}
                className={drag?.kind === 'weapon' && drag.weapon.id === weapon.id ? 'offer dim' : 'offer'}
                data-weapon-id={weapon.id}
                onPointerDown={(event) => startWeaponDrag(event, weapon, true)}
              >
                <WeaponView type={weapon.type} level={weapon.level} rotation={weapon.rotation} cell={34} />
                <div>
                  <strong>{stat.name}</strong>
                  <p>攻击 {attack}</p>
                  <p>间隔 {stat.interval.toFixed(2)} 秒</p>
                  <p>{effectText(weapon.type, weapon.level)}</p>
                  <p className="quiet">{stat.blurb}</p>
                  <button type="button" onClick={() => autoPlace(weapon)}>
                    装入
                  </button>
                </div>
              </article>
            )
          })}
          {expansion && (
            <article
              className={drag?.kind === 'expand' ? 'offer dim' : 'offer'}
              onPointerDown={startExpandDrag}
            >
              <ExpansionView count={expansion.count} rotation={0} cell={34} />
              <div>
                <strong>{expansion.count === 2 ? '相连空格' : '空格子'}</strong>
                <p>{expansion.count === 2 ? '两格必须一起贴到背包边上' : '贴到背包任意一边即可扩容'}</p>
                <button type="button" onClick={autoAttach}>
                  贴上
                </button>
              </div>
            </article>
          )}
          <button
            type="button"
            className="primary"
            disabled={blocked}
            onClick={() => {
              if (swallowClick.current) return
              onStart()
            }}
          >
            迎接第 {wave} 波
          </button>
          {canSave && !askOverwrite && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (swallowClick.current) return
                if (previousSaveWave != null) {
                  setAskEnd(false)
                  setAskOverwrite(true)
                  return
                }
                flash(onSave() ? `已存档，下次可从第 ${wave} 波之前继续` : '这次没能存下来')
              }}
            >
              存档
            </button>
          )}
          {askOverwrite && (
            <div className="confirm">
              <span>这局存档会覆盖上一局第 {previousSaveWave} 波之前的进度，还要存吗？</span>
              <button
                type="button"
                onClick={() => {
                  if (swallowClick.current) return
                  setAskOverwrite(false)
                  flash(onSave() ? `已存档，下次可从第 ${wave} 波之前继续` : '这次没能存下来')
                }}
              >
                覆盖存档
              </button>
              <button type="button" onClick={() => setAskOverwrite(false)}>
                再想想
              </button>
            </div>
          )}
          {askEnd ? (
            <div className="confirm">
              <span>现在结算？</span>
              <button
                type="button"
                onClick={() => {
                  if (swallowClick.current) return
                  onSettle()
                }}
              >
                结束
              </button>
              <button type="button" onClick={() => setAskEnd(false)}>
                再想想
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (swallowClick.current) return
                setAskOverwrite(false)
                setAskEnd(true)
              }}
            >
              暂停并结算
            </button>
          )}
        </aside>
      </div>

      {drag && (
        <>
          <div
            className="float-piece"
            style={{
              left: drag.x - (drag.grab.x + 0.5) * cell,
              top: drag.y - (drag.grab.y + 0.5) * cell,
            }}
          >
            {drag.kind === 'weapon' ? (
              <WeaponView type={drag.weapon.type} level={drag.weapon.level} rotation={drag.rotation} cell={cell} />
            ) : (
              <ExpansionView count={drag.count} rotation={drag.rotation} cell={cell} />
            )}
          </div>
        </>
      )}
    </section>
  )
}
