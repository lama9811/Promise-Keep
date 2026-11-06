// Draws the coin faces onto canvases. Each face gets two maps:
//  color: light metal with darker engraved marks
//  bump:  white = raised, black = cut into the metal
import { CanvasTexture, SRGBColorSpace } from 'three'
import { formatCents } from '../money'

const SIZE = 1024
const C = SIZE / 2
const DISPLAY = '"Bricolage Grotesque Variable", system-ui, sans-serif'

function makeCanvas() {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  return c
}

function ringText(ctx, text, radius, size) {
  ctx.save()
  ctx.font = `600 ${size}px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const chars = [...text]
  const step = (Math.PI * 2) / chars.length
  chars.forEach((ch, i) => {
    ctx.save()
    ctx.translate(C, C)
    ctx.rotate(i * step - Math.PI / 2)
    ctx.translate(0, -radius)
    ctx.fillText(ch, 0, 0)
    ctx.restore()
  })
  ctx.restore()
}

function drawFace(ctx, { base, mark }, side, stakeCents) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.strokeStyle = mark
  ctx.fillStyle = mark

  // Two cut rings near the edge
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(C, C, SIZE * 0.47, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(C, C, SIZE * 0.33, 0, Math.PI * 2)
  ctx.stroke()

  if (side === 'front') {
    ringText(ctx, 'KEEP YOUR WORD ✦ KEEP YOUR WORD ✦ ', SIZE * 0.4, 52)
    // A heavy check mark: the promise, kept.
    ctx.lineWidth = 46
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(C - 120, C + 6)
    ctx.lineTo(C - 30, C + 96)
    ctx.lineTo(C + 136, C - 92)
    ctx.stroke()
  } else {
    ringText(ctx, 'PROMISE KEEPER ✦ BET ON YOURSELF ✦ ', SIZE * 0.4, 52)
    const label = stakeCents > 0 ? formatCents(stakeCents) : '$?'
    let size = 230
    ctx.font = `800 ${size}px ${DISPLAY}`
    while (ctx.measureText(label).width > SIZE * 0.5 && size > 80) {
      size -= 10
      ctx.font = `800 ${size}px ${DISPLAY}`
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, C, C - 10)
    ctx.font = `600 44px ${DISPLAY}`
    ctx.fillText('on the line', C, C + size * 0.62)
  }
}

export function makeFaceTextures(side, stakeCents = 0) {
  const color = makeCanvas()
  const bump = makeCanvas()
  // Metal colour: the engraving is a little darker so it reads under reflections.
  drawFace(color.getContext('2d'), { base: '#eceef8', mark: '#6c7299' }, side, stakeCents)
  drawFace(bump.getContext('2d'), { base: '#ffffff', mark: '#000000' }, side, stakeCents)
  const map = new CanvasTexture(color)
  map.colorSpace = SRGBColorSpace
  map.anisotropy = 8
  const bumpMap = new CanvasTexture(bump)
  bumpMap.anisotropy = 8
  return { map, bumpMap }
}

// Fine vertical ridges for the coin's edge.
export function makeReedTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 8
  const ctx = c.getContext('2d')
  for (let x = 0; x < 512; x += 4) {
    ctx.fillStyle = x % 8 === 0 ? '#ffffff' : '#000000'
    ctx.fillRect(x, 0, 4, 8)
  }
  return new CanvasTexture(c)
}
