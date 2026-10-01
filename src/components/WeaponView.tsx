import { useLayoutEffect, useRef } from 'react'
import type { WeaponType } from '../types'
import { expansionShape, shapeOf } from '../game/logic'
import { paintPocket, paintWeapon } from '../game/draw'

function useCanvasPaint(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
  deps: readonly unknown[],
) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    paint(ctx)
    // paint closes over the latest shape arguments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, ...deps])
  return ref
}

export function WeaponView({
  type,
  level,
  rotation,
  cell,
}: {
  type: WeaponType
  level: number
  rotation: number
  cell: number
}) {
  const shape = shapeOf(type, rotation)
  const cols = Math.max(...shape.map((part) => part.x)) + 1
  const rows = Math.max(...shape.map((part) => part.y)) + 1
  const width = cols * cell
  const height = rows * cell
  const ref = useCanvasPaint(width, height, (ctx) => paintWeapon(ctx, type, rotation, level, cell), [
    type,
    level,
    rotation,
    cell,
  ])
  return <canvas ref={ref} className="glyph" style={{ width, height }} />
}

export function ExpansionView({
  count,
  rotation,
  cell,
}: {
  count: 1 | 2
  rotation: number
  cell: number
}) {
  const shape = expansionShape(count, rotation)
  const cols = Math.max(...shape.map((part) => part.x)) + 1
  const rows = Math.max(...shape.map((part) => part.y)) + 1
  const width = cols * cell
  const height = rows * cell
  const ref = useCanvasPaint(
    width,
    height,
    (ctx) => {
      for (const part of expansionShape(count, rotation)) paintPocket(ctx, part.x * cell, part.y * cell, cell)
    },
    [count, rotation, cell],
  )
  return <canvas ref={ref} className="glyph" style={{ width, height }} />
}
