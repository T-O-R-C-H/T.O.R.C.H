import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Waveform } from './Waveform'
import { LEVEL_HISTORY, levelToDisplay, rmsFromTimeDomain } from '../../hooks/useAudioCapture'

/**
 * The bars are the audio, not an animation.
 *
 * This closes the chain the level meter depends on: samples produce an RMS,
 * the RMS produces a bar height, and the bar height is what actually reaches
 * the DOM. If any link were decorative, one of these would fail.
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

/** The vertical scale each bar is drawn at, in order. */
function barScales(): number[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.waveform__bar')).map((bar) => {
    const match = /scaleY\(([\d.]+)\)/.exec(bar.style.transform)
    return match ? Number(match[1]) : NaN
  })
}

async function render(levels: number[]): Promise<void> {
  await act(async () => {
    root.render(<Waveform levels={levels} />)
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('Waveform', () => {
  it('draws one bar per slot in the history', async () => {
    await render([])
    expect(barScales()).toHaveLength(LEVEL_HISTORY)
  })

  it('draws silence flat', async () => {
    await render(new Array(LEVEL_HISTORY).fill(0))
    const scales = barScales()

    // All equal, and all at the floor.
    expect(new Set(scales).size).toBe(1)
    expect(scales[0]).toBeLessThan(0.1)
  })

  it('keeps silent bars visible rather than zero-height', async () => {
    // A row of nothing reads as broken; a flat row reads as "hearing nothing".
    await render(new Array(LEVEL_HISTORY).fill(0))
    expect(barScales()[0]).toBeGreaterThan(0)
  })

  it('draws a louder frame taller than a quieter one', async () => {
    await render([0.1, 0.9])
    const scales = barScales()

    expect(scales[scales.length - 1]).toBeGreaterThan(scales[scales.length - 2])
  })

  it('fills from the right, so a short history does not rescale the row', async () => {
    await render([1])
    const scales = barScales()

    expect(scales[scales.length - 1]).toBeGreaterThan(0.9)
    expect(scales[0]).toBeLessThan(0.1)
  })

  it('renders measured audio, end to end', async () => {
    // Build real frames, run them through the real analysis, and check the
    // rendered heights follow the amplitude that produced them.
    const frameAt = (amplitude: number): Uint8Array => {
      const frame = new Uint8Array(512)
      for (let i = 0; i < frame.length; i += 1) {
        frame[i] = 128 + (i % 2 === 0 ? amplitude : -amplitude)
      }
      return frame
    }
    const measured = [0, 4, 12, 40].map((amp) => levelToDisplay(rmsFromTimeDomain(frameAt(amp))))

    await render(measured)
    const scales = barScales().slice(-4)

    expect(scales[0]).toBeLessThan(scales[1])
    expect(scales[1]).toBeLessThan(scales[2])
    expect(scales[2]).toBeLessThan(scales[3])
  })
})
