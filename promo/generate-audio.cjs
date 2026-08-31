const fs = require('fs')
const path = require('path')

const sampleRate = 48000
const duration = 28
const frames = sampleRate * duration
const channels = 2
const data = Buffer.alloc(frames * channels * 2)
const bpm = 112
const beat = 60 / bpm
const twoPi = Math.PI * 2

const chordRoots = [110, 82.41, 87.31, 98]
const chordIntervals = [1, 1.25, 1.5]
const transitions = [2.6, 6.2, 9.2, 13.5, 17.7, 22.3, 25.2]

const smooth = (x) => x * x * (3 - 2 * x)
const frac = (x) => x - Math.floor(x)

function envelope(t, start, attack, hold, release) {
  const local = t - start
  if (local < 0 || local > attack + hold + release) return 0
  if (local < attack) return smooth(local / attack)
  if (local < attack + hold) return 1
  return 1 - smooth((local - attack - hold) / release)
}

function noise(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return (frac(x) * 2 - 1)
}

for (let i = 0; i < frames; i++) {
  const t = i / sampleRate
  const beatIndex = Math.floor(t / beat)
  const beatPhase = frac(t / beat)
  const bar = Math.floor(t / (beat * 4))
  const root = chordRoots[bar % chordRoots.length]
  let left = 0
  let right = 0

  // Warm, slow harmonic bed.
  for (let v = 0; v < chordIntervals.length; v++) {
    const f = root * chordIntervals[v]
    const drift = Math.sin(twoPi * 0.07 * t + v) * 0.002
    const pad = Math.sin(twoPi * f * (1 + drift) * t + v * 0.7) * 0.026
    left += pad * (0.85 + v * 0.05)
    right += pad * (1.05 - v * 0.06)
  }

  // Soft kick on each beat.
  if (beatPhase < 0.32) {
    const bt = beatPhase * beat
    const kick = Math.sin(twoPi * (76 - bt * 115) * bt) * Math.exp(-bt * 18) * 0.19
    left += kick
    right += kick
  }

  // Tight hats on eighth notes.
  const halfPhase = frac(t / (beat / 2))
  if (halfPhase < 0.16) {
    const ht = halfPhase * beat / 2
    const hat = noise(i) * Math.exp(-ht * 90) * (beatIndex % 2 ? 0.035 : 0.024)
    left += hat * 0.8
    right += hat
  }

  // Glassy arpeggio, deliberately sparse.
  const arpStep = Math.floor(t / (beat / 2))
  const arpStart = arpStep * beat / 2
  const arpEnv = envelope(t, arpStart, 0.008, 0.02, 0.24)
  const arpFreq = root * 4 * [1, 1.25, 1.5, 2][arpStep % 4]
  const arp = Math.sin(twoPi * arpFreq * t) * arpEnv * 0.045
  left += arp * (arpStep % 2 ? 0.55 : 1)
  right += arp * (arpStep % 2 ? 1 : 0.55)

  // Scene-transition whooshes.
  for (const start of transitions) {
    const e = envelope(t, start - 0.34, 0.28, 0.02, 0.22)
    if (e > 0) {
      const phase = Math.max(0, t - (start - 0.34))
      const whoosh = noise(i) * e * (0.012 + phase * 0.07)
      left += whoosh
      right += whoosh * 0.92
    }
  }

  // Interaction click and confirmation chime.
  const clickEnv = envelope(t, 7.18, 0.001, 0.006, 0.07)
  left += noise(i) * clickEnv * 0.12
  right += noise(i + 11) * clickEnv * 0.12
  const doneEnv = envelope(t, 18.1, 0.01, 0.04, 0.65)
  left += Math.sin(twoPi * 659.25 * t) * doneEnv * 0.045
  right += Math.sin(twoPi * 783.99 * t) * doneEnv * 0.045

  // Gentle master fade.
  const fadeIn = Math.min(1, t / 0.8)
  const fadeOut = Math.min(1, (duration - t) / 1.4)
  const master = Math.max(0, Math.min(fadeIn, fadeOut)) * 0.82
  left = Math.tanh(left * 1.6) * master
  right = Math.tanh(right * 1.6) * master

  data.writeInt16LE(Math.round(left * 32767), i * 4)
  data.writeInt16LE(Math.round(right * 32767), i * 4 + 2)
}

const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + data.length, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)
header.writeUInt16LE(channels, 22)
header.writeUInt32LE(sampleRate, 24)
header.writeUInt32LE(sampleRate * channels * 2, 28)
header.writeUInt16LE(channels * 2, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(data.length, 40)

const output = path.join(__dirname, 'public', 'torch-score.wav')
fs.writeFileSync(output, Buffer.concat([header, data]))
console.log(`Wrote ${output}`)
