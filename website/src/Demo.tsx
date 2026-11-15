import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { Calculator, Cart, Check, FileText, Globe, Stop, Windows } from './icons'

/*
 * A scripted re-creation of a real TORCH run: the request is typed, the
 * blue edge glow comes up, TORCH's own cursor glides to each control and
 * blinks as it clicks, and the to-do panel ticks along. Each scene is a
 * task TORCH has completed for real in testing.
 */

type SceneId = 'calc' | 'shop' | 'notes'
type Phase = 'idle' | 'typing' | 'working' | 'done' | 'handoff'

type State = {
  full: string
  scene: SceneId
  phase: Phase
  prompt: string
  todos: string[]
  current: number
  cursor: { x: number; y: number; show: boolean; tag: string }
  clicks: number
  calc: { display: string; expr: string; pressed: string }
  shop: { page: 'list' | 'product' | 'checkout'; looking: number; cart: number; toast: boolean }
  notes: { text: string; dialog: boolean; filename: string; saved: boolean }
}

const SCENES: { id: SceneId; label: string; prompt: string; todos: string[] }[] = [
  {
    id: 'shop',
    label: 'Shopping',
    prompt: 'Find the cheapest laptop, add it to the cart and check out',
    todos: [
      'Open the store',
      'Compare laptop prices',
      'Add the cheapest to the cart',
      'Go to checkout'
    ]
  },
  {
    id: 'calc',
    label: 'Calculator',
    prompt: 'Open Calculator and work out 128 × 24',
    todos: ['Open Calculator', 'Enter 128 × 24', 'Read the answer']
  },
  {
    id: 'notes',
    label: 'Writing',
    prompt: 'Write a short poem about Lagos and save it',
    todos: ['Open Notepad', 'Write the poem', 'Save it as lagos.txt']
  }
]

const POEM = [
  'Lagos wakes where the lagoon meets the sky,',
  'yellow buses hum and the traders cry.',
  "Night falls soft on Victoria's shore,",
  'a city that sleeps, then asks for more.'
]

const PRODUCTS = [
  { name: 'Aero 14', spec: '16 GB · 1 TB', price: '$1,099' },
  { name: 'Nova 13', spec: '16 GB · 512 GB', price: '$899' },
  { name: 'Lite 15', spec: '8 GB · 256 GB', price: '$700' }
]

function fresh(scene: SceneId): State {
  return {
    full: '',
    scene,
    phase: 'idle',
    prompt: '',
    todos: [],
    current: 0,
    cursor: { x: 78, y: 86, show: false, tag: '' },
    clicks: 0,
    calc: { display: '0', expr: '', pressed: '' },
    shop: { page: 'list', looking: -1, cart: 0, toast: false },
    notes: { text: '', dialog: false, filename: '', saved: false }
  }
}

class Cancelled extends Error {}

export type { SceneId }

export default function Demo(): JSX.Element {
  const [sceneIndex, setSceneIndex] = useState(0)
  const [s, setS] = useState<State>(() => fresh(SCENES[0].id))
  const stage = useRef<HTMLDivElement>(null)
  const run = useRef(0)
  const next = useRef(0)
  const pendingPrompt = useRef<string | undefined>(undefined)

  const play = useCallback((index: number, customPrompt?: string) => {
    const id = ++run.current
    const scene = { ...SCENES[index], prompt: customPrompt?.trim() || SCENES[index].prompt }
    const alive = (): void => {
      if (run.current !== id) throw new Cancelled()
    }
    const wait = (ms: number): Promise<void> =>
      new Promise((resolve, reject) =>
        window.setTimeout(() => (run.current === id ? resolve() : reject(new Cancelled())), ms)
      )
    const set = (fn: (p: State) => State): void => {
      alive()
      setS(fn)
    }
    const point = (selector: string): { x: number; y: number } | null => {
      const box = stage.current?.getBoundingClientRect()
      const el = stage.current?.querySelector(selector)?.getBoundingClientRect()
      if (!box || !el) return null
      return {
        x: ((el.left + el.width * 0.55 - box.left) / box.width) * 100,
        y: ((el.top + el.height * 0.55 - box.top) / box.height) * 100
      }
    }
    const move = async (selector: string, tag = 'Looking'): Promise<void> => {
      const p = point(selector)
      if (!p) return
      set((v) => ({ ...v, cursor: { x: p.x, y: p.y, show: true, tag } }))
      await wait(520)
    }
    const click = async (selector: string, then?: (v: State) => State): Promise<void> => {
      await move(selector, 'Clicking')
      set((v) => {
        const next = { ...v, clicks: v.clicks + 1 }
        return then ? then(next) : next
      })
      await wait(260)
    }
    const typeInto = async (
      text: string,
      apply: (v: State, t: string) => State,
      speed = 26
    ): Promise<void> => {
      for (let i = 1; i <= text.length; i++) {
        set((v) => apply(v, text.slice(0, i)))
        await wait(speed)
      }
    }

    const script = async (): Promise<void> => {
      setS({ ...fresh(scene.id), full: scene.prompt })
      await wait(500)
      set((v) => ({ ...v, phase: 'typing' }))
      await typeInto(scene.prompt, (v, t) => ({ ...v, prompt: t }), 24)
      await wait(420)
      set((v) => ({ ...v, phase: 'working', todos: scene.todos, current: 0 }))
      await wait(700)

      if (scene.id === 'calc') {
        set((v) => ({ ...v, current: 1 }))
        const press = async (key: string, display: string, expr = ''): Promise<void> => {
          await click(`[data-k="${key}"]`, (v) => ({ ...v, calc: { display, expr, pressed: key } }))
          window.setTimeout(
            () => run.current === id && setS((v) => ({ ...v, calc: { ...v.calc, pressed: '' } })),
            140
          )
        }
        await press('1', '1')
        await press('2', '12')
        await press('8', '128')
        await press('×', '128', '128 ×')
        await press('2b', '2', '128 ×')
        await press('4', '24', '128 ×')
        set((v) => ({ ...v, current: 2 }))
        await press('=', '3,072', '128 × 24 =')
        await wait(500)
        await move('.calc__display', 'Reading')
        await wait(600)
        set((v) => ({
          ...v,
          phase: 'done',
          current: v.todos.length,
          cursor: { ...v.cursor, show: false }
        }))
      }

      if (scene.id === 'shop') {
        await wait(300)
        set((v) => ({ ...v, current: 1 }))
        for (let i = 0; i < PRODUCTS.length; i++) {
          set((v) => ({ ...v, shop: { ...v.shop, looking: i } }))
          await move(`[data-p="${i}"] .price`, 'Comparing')
          await wait(220)
        }
        set((v) => ({ ...v, current: 2 }))
        await click('[data-p="2"]', (v) => ({
          ...v,
          shop: { ...v.shop, page: 'product', looking: -1 }
        }))
        await wait(500)
        await click('.store__add', (v) => ({ ...v, shop: { ...v.shop, cart: 1, toast: true } }))
        await wait(900)
        set((v) => ({ ...v, current: 3, shop: { ...v.shop, toast: false } }))
        await click('.store__cart', (v) => ({ ...v, shop: { ...v.shop, page: 'checkout' } }))
        await wait(800)
        await move('.store__pay', 'Looking')
        await wait(500)
        set((v) => ({ ...v, phase: 'handoff', cursor: { ...v.cursor, show: false } }))
      }

      if (scene.id === 'notes') {
        set((v) => ({ ...v, current: 1 }))
        await move('.notes__page', 'Typing')
        const full = POEM.join('\n')
        await typeInto(full, (v, t) => ({ ...v, notes: { ...v.notes, text: t } }), 22)
        await wait(400)
        set((v) => ({ ...v, current: 2, notes: { ...v.notes, dialog: true } }))
        await wait(450)
        await move('.save__field', 'Typing')
        await typeInto('lagos.txt', (v, t) => ({ ...v, notes: { ...v.notes, filename: t } }), 45)
        await wait(200)
        await click('.save__button', (v) => ({
          ...v,
          notes: { ...v.notes, dialog: false, saved: true }
        }))
        await wait(500)
        set((v) => ({
          ...v,
          phase: 'done',
          current: v.todos.length,
          cursor: { ...v.cursor, show: false }
        }))
      }

      await wait(scene.id === 'shop' ? 3200 : 2400)
      next.current = (index + 1) % SCENES.length
      setSceneIndex(next.current)
      if (next.current === index) play(index)
    }

    script().catch((error) => {
      if (!(error instanceof Cancelled)) throw error
    })
  }, [])

  useEffect(() => {
    const custom = pendingPrompt.current
    pendingPrompt.current = undefined
    play(sceneIndex, custom)
  }, [sceneIndex, play])

  // A request typed into the site's command bar: act it out with the
  // closest scene, showing the visitor's own words.
  useEffect(() => {
    const onTry = (event: Event): void => {
      const { scene, prompt } = (event as CustomEvent<{ scene: SceneId; prompt: string }>).detail
      const index = SCENES.findIndex((x) => x.id === scene)
      if (index < 0) return
      if (index === sceneIndex) play(index, prompt)
      else {
        pendingPrompt.current = prompt
        setSceneIndex(index)
      }
    }
    window.addEventListener('torch:try', onTry)
    return () => window.removeEventListener('torch:try', onTry)
  }, [sceneIndex, play])

  useEffect(() => () => void (run.current += 1), [])

  const working = s.phase === 'working'
  const showApp = s.phase === 'working' || s.phase === 'done' || s.phase === 'handoff'

  return (
    <div className="demo">
      <div className="stage" ref={stage}>
        <div className={`stage__glow ${working ? 'is-on' : ''}`} />

        <div className="taskbar" aria-hidden="true">
          <span className="taskbar__start">
            <Windows size={13} />
          </span>
          <span className="taskbar__search">Search</span>
          <span className={`taskbar__app ${s.scene === 'shop' && showApp ? 'is-on' : ''}`}>
            <Globe size={13} />
          </span>
          <span className={`taskbar__app ${s.scene === 'calc' && showApp ? 'is-on' : ''}`}>
            <Calculator size={13} />
          </span>
          <span className={`taskbar__app ${s.scene === 'notes' && showApp ? 'is-on' : ''}`}>
            <FileText size={13} />
          </span>
          <span className="taskbar__torch">TORCH</span>
          <span className="taskbar__clock">9:41</span>
        </div>

        <div className={`app ${showApp ? 'is-open' : ''}`} key={s.scene}>
          {s.scene === 'calc' && <CalcApp s={s} />}
          {s.scene === 'shop' && <ShopApp s={s} />}
          {s.scene === 'notes' && <NotesApp s={s} />}
        </div>

        <div className={`prompt ${s.phase === 'typing' || s.phase === 'idle' ? 'is-up' : ''}`}>
          <span className="prompt__text">
            {s.prompt || <span className="prompt__ph">Tell TORCH what to do…</span>}
            {s.phase === 'typing' && <i className="caret" />}
          </span>
          <span className={`prompt__send ${s.full && s.prompt === s.full ? 'is-ready' : ''}`}>
            <ArrowSend />
          </span>
        </div>

        <Panel s={s} />

        <div
          className={`tcursor ${s.cursor.show ? 'is-on' : ''}`}
          style={{ left: `${s.cursor.x}%`, top: `${s.cursor.y}%` }}
        >
          {s.clicks > 0 && (
            <span className="tcursor__blink" key={s.clicks}>
              <i />
              <i />
            </span>
          )}
          <svg
            className="tcursor__arrow"
            key={`a${s.clicks}`}
            viewBox="0 0 28 32"
            aria-hidden="true"
          >
            <path d="M2.5 2.2 L24.5 15.4 L14.2 17.4 L20.2 28.6 L15.4 31 L9.6 19.8 L2.5 26.6 Z" />
          </svg>
          <span className="tcursor__tag">TORCH · {s.cursor.tag}</span>
        </div>
      </div>

      <div className="demo__tabs" role="tablist" aria-label="Demo tasks">
        {SCENES.map((scene, index) => (
          <button
            key={scene.id}
            data-tour={`tab-${scene.id}`}
            role="tab"
            aria-selected={index === sceneIndex}
            className={index === sceneIndex ? 'is-active' : ''}
            onClick={() => (index === sceneIndex ? play(index) : setSceneIndex(index))}
          >
            {scene.id === 'calc' && <Calculator size={16} />}
            {scene.id === 'shop' && <Cart size={16} />}
            {scene.id === 'notes' && <FileText size={16} />}
            {scene.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ArrowSend(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  )
}

function Chrome({ icon, title }: { icon: JSX.Element; title: string }): JSX.Element {
  return (
    <div className="app__bar">
      <span className="app__icon">{icon}</span>
      <span className="app__title">{title}</span>
      <span className="app__ctrls" aria-hidden="true">
        <svg viewBox="0 0 30 10">
          <path d="M1 5h7M12.5 1.5h6v6h-6zM23 1.5l6 6M29 1.5l-6 6" />
        </svg>
      </span>
    </div>
  )
}

function CalcApp({ s }: { s: State }): JSX.Element {
  const keys: [string, string][] = [
    ['7', '7'],
    ['8', '8'],
    ['9', '9'],
    ['÷', '÷'],
    ['4', '4'],
    ['5', '5'],
    ['6', '6'],
    ['×', '×'],
    ['1', '1'],
    ['2', '2'],
    ['3', '3'],
    ['−', '−'],
    ['0', '0'],
    ['.', '.'],
    ['=', '='],
    ['+', '+']
  ]
  return (
    <div className="win win--calc">
      <Chrome icon={<Calculator size={13} />} title="Calculator" />
      <div className="calc">
        <div className="calc__display">
          <span>{s.calc.expr}</span>
          <strong key={s.calc.display}>{s.calc.display}</strong>
        </div>
        <div className="calc__keys">
          {keys.map(([label]) => {
            // The "2" is pressed twice; after "×" it answers to its own name
            // so the script can tell the two presses apart.
            const target = label === '2' && s.calc.expr ? '2b' : label
            return (
              <span
                key={label}
                data-k={target}
                className={`calc__key ${'÷×−+='.includes(label) ? 'is-op' : ''} ${label === '=' ? 'is-eq' : ''} ${s.calc.pressed === target ? 'is-pressed' : ''}`}
              >
                {label}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ShopApp({ s }: { s: State }): JSX.Element {
  return (
    <div className="win win--shop">
      <Chrome icon={<Globe size={13} />} title="Store" />
      <div className="store">
        <div className="store__nav">
          <span className="store__url">
            <LockMini /> store.example/laptops
          </span>
          <span className="store__cart">
            <Cart size={14} />
            {s.shop.cart > 0 && <b key="c">{s.shop.cart}</b>}
          </span>
        </div>
        {s.shop.page === 'list' && (
          <div className="store__list page-in">
            <h4>Laptops</h4>
            <div className="store__grid">
              {PRODUCTS.map((p, i) => (
                <div
                  key={p.name}
                  data-p={i}
                  className={`card ${s.shop.looking === i ? 'is-looking' : ''}`}
                >
                  <span className="card__img">
                    <LaptopArt />
                  </span>
                  <strong>{p.name}</strong>
                  <small>{p.spec}</small>
                  <span className="price">{p.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {s.shop.page === 'product' && (
          <div className="store__product page-in">
            <span className="store__hero">
              <LaptopArt />
            </span>
            <div>
              <small>Laptops / Lite 15</small>
              <h4>Lite 15</h4>
              <p>8 GB memory · 256 GB storage · 15.6″</p>
              <strong className="store__price">$700</strong>
              <span className="store__add">Add to cart</span>
            </div>
            {s.shop.toast && <span className="toast">Added to cart</span>}
          </div>
        )}
        {s.shop.page === 'checkout' && (
          <div className="store__checkout page-in">
            <h4>Checkout</h4>
            <div className="line">
              <span>Lite 15</span>
              <span>$700</span>
            </div>
            <div className="field">
              <small>Name on card</small>
              <span />
            </div>
            <div className="field">
              <small>Card number</small>
              <span />
            </div>
            <span className="store__pay">Place order · $700</span>
          </div>
        )}
      </div>
    </div>
  )
}

function NotesApp({ s }: { s: State }): JSX.Element {
  return (
    <div className="win win--notes">
      <Chrome
        icon={<FileText size={13} />}
        title={s.notes.saved ? 'lagos.txt — Notepad' : 'Untitled — Notepad'}
      />
      <div className="notes">
        <div className="notes__menu">
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
        </div>
        <pre className="notes__page">
          {s.notes.text}
          {s.phase === 'working' && !s.notes.dialog && !s.notes.saved && <i className="caret" />}
        </pre>
        {s.notes.dialog && (
          <div className="save">
            <strong>Save as</strong>
            <div className="save__row">
              <small>File name</small>
              <span className="save__field">
                {s.notes.filename}
                <i className="caret" />
              </span>
            </div>
            <div className="save__actions">
              <span>Cancel</span>
              <span className="save__button">Save</span>
            </div>
          </div>
        )}
        {s.notes.saved && <span className="toast toast--soft">Saved</span>}
      </div>
    </div>
  )
}

function Panel({ s }: { s: State }): JSX.Element {
  const visible = s.phase === 'working' || s.phase === 'done' || s.phase === 'handoff'
  const doneCount = Math.min(s.current, s.todos.length)
  const status = s.phase === 'done' ? 'Done' : s.phase === 'handoff' ? 'Your turn' : 'Working'
  return (
    <div className={`panel ${visible ? 'is-on' : ''}`} data-phase={s.phase}>
      <div className="panel__head">
        <span className={`panel__dot panel__dot--${s.phase}`} />
        <span className="panel__title">{s.prompt}</span>
      </div>
      <div className="panel__meta">
        <b>TORCH</b> · {status}
      </div>
      {s.phase === 'handoff' && (
        <div className="panel__turn">
          <strong>Your turn</strong>
          <p>The order form is ready. Payment details are yours to enter.</p>
          <span className="panel__btn">Done, continue</span>
        </div>
      )}
      <div className="todos">
        <div className="todos__head">
          <span>To-dos</span>
          <span>
            {doneCount} of {s.todos.length}
          </span>
        </div>
        {s.todos.map((todo, i) => {
          const state =
            i < s.current ? 'done' : i === s.current && s.phase === 'working' ? 'now' : 'next'
          return (
            <div key={todo} className={`todo todo--${state}`}>
              <span className="todo__mark">{state === 'done' ? <Check size={11} /> : null}</span>
              <span>{todo}</span>
            </div>
          )
        })}
      </div>
      {s.phase === 'working' && (
        <span className="panel__stop">
          <Stop size={12} /> Stop
        </span>
      )}
    </div>
  )
}

function LockMini(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function LaptopArt(): JSX.Element {
  return (
    <svg viewBox="0 0 64 40" aria-hidden="true">
      <rect x="12" y="6" width="40" height="25" rx="2" className="la-screen" />
      <rect x="15" y="9" width="34" height="19" rx="1" className="la-glass" />
      <path d="M6 33h52l-3 3H9z" className="la-base" />
    </svg>
  )
}
