import { TorchMiniApp } from './app-demo.js'
import { DemoRunner } from './demo-engine.js'

const instances = new Map()

function initDemo(el) {
  if (instances.has(el)) return

  const scenario = el.dataset.demo
  const isShowcase = el.dataset.role === 'showcase'
  const startIdle = el.dataset.startIdle === 'true'
  const pauseApproval = el.dataset.pauseApproval === 'true'

  const app = new TorchMiniApp(el, {
    compact: !isShowcase,
    showMetrics: isShowcase,
    startIdle
  })

  const runner = new DemoRunner(app)
  instances.set(el, { app, runner, scenario, isShowcase, pauseApproval })

  if (isShowcase) {
    setTimeout(() => runner.run(scenario, { loop: true }), 600)
    return
  }

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const data = instances.get(el)
        if (!data) return
        if (entry.isIntersecting) {
          if (!data.runner.running) {
            data.runner.run(data.scenario, {
              loop: true,
              pauseOnApproval: data.pauseApproval,
              autoApproveHitl: !data.pauseApproval
            })
          }
        } else {
          data.runner.stop()
        }
      })
    },
    { threshold: 0.4, rootMargin: '0px 0px -40px 0px' }
  )
  obs.observe(el)
}

document.querySelectorAll('[data-demo]').forEach(initDemo)

const revealEls = document.querySelectorAll('.reveal')
const revealObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        revealObs.unobserve(entry.target)
      }
    })
  },
  { threshold: 0.12, rootMargin: '0px 0px -5% 0px' }
)
revealEls.forEach((el) => revealObs.observe(el))

const header = document.getElementById('header')
window.addEventListener('scroll', () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 12)

  const showcase = document.querySelector('.showcase__wrap')
  if (showcase && window.scrollY < window.innerHeight * 1.2) {
    showcase.style.transform = `translateY(${Math.min(window.scrollY * 0.04, 24)}px)`
  }
}, { passive: true })

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href')
    if (!id || id === '#') return
    const target = document.querySelector(id)
    if (!target) return
    e.preventDefault()
    const top = target.getBoundingClientRect().top + window.scrollY - 60
    window.scrollTo({ top, behavior: 'smooth' })
  })
})

document.getElementById('btn-download')?.addEventListener('click', (e) => {
  e.preventDefault()
  alert('TORCH for Windows is coming soon. Contact hello@torch.app to get early access.')
})
