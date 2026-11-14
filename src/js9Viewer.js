// JS9 viewer engine.
//
// JS9 builds its own DOM. Putting the .JS9 div in React JSX orphans the
// display (hydration discards the subtree JS9 built into), so the display
// subtree is created imperatively inside a host element that React renders
// empty and never manages, and the JS9 library is loaded dynamically only
// after those divs exist. The readiness gate requires the host div to have
// children (JS9 actually built into OUR node) before any image load runs.
//
// Diagnostics are published on window.__gate1 for the Gate 1 probe.
const JS9_SRC = '/js9/js9-allinone.js'

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('failed to load ' + src))
    document.body.appendChild(s)
  })
}

export function mountViewer(host, field, cb) {
  const diag = (window.__gate1 = {
    phase: 'building-host',
    hostChildren: 0,
    displays: 0,
    images: [],
    current: null,
    switches: 0,
    error: null,
  })
  const say = (phase) => {
    diag.phase = phase
    cb.onPhase({ ...diag })
  }

  const display = document.createElement('div')
  display.className = 'JS9'
  display.id = 'JS9'
  display.setAttribute('data-width', '880')
  display.setAttribute('data-height', '660')
  host.appendChild(display)
  const blinkPanel = document.createElement('div')
  blinkPanel.className = 'JS9Blink'
  host.appendChild(blinkPanel)

  let blinkTimer = null
  let lastId = null
  let playing = false

  function play() {
    if (blinkTimer) return
    playing = true
    blinkTimer = setInterval(() => {
      try {
        window.JS9.DisplayNextImage(1)
      } catch {
        /* the monitor reports state; a missed tick is not fatal */
      }
    }, 500)
  }

  function pause() {
    playing = false
    if (blinkTimer) {
      clearInterval(blinkTimer)
      blinkTimer = null
    }
  }

  function startMonitor() {
    setInterval(() => {
      const d = window.JS9 && window.JS9.displays && window.JS9.displays[0]
      const im = d && d.image ? d.image : null
      const cur = im ? im.id : null
      diag.hostChildren = display.childElementCount
      diag.current = cur
      if (lastId !== null && cur && cur !== lastId) {
        diag.switches++
        cb.onEpoch(im, { ...diag })
        cb.onPhase({ ...diag })
      }
      if (cur) lastId = cur
    }, 200)
  }

  async function boot() {
    try {
      say('loading-js9')
      await loadScript(JS9_SRC)
      say('waiting-ready')
      // Readiness gate: JS9 present, a display registered, AND our host div
      // has children. Anything less fails the gate instead of faking a pass.
      const t0 = Date.now()
      await new Promise((resolve, reject) => {
        const iv = setInterval(() => {
          diag.displays =
            window.JS9 && window.JS9.displays ? window.JS9.displays.length : 0
          diag.hostChildren = display.childElementCount
          if (diag.displays > 0 && diag.hostChildren > 0) {
            clearInterval(iv)
            resolve()
          } else if (Date.now() - t0 > 30000) {
            clearInterval(iv)
            reject(
              new Error(
                'JS9 readiness gate timed out (displays=' +
                  diag.displays +
                  ', hostChildren=' +
                  diag.hostChildren +
                  ')',
              ),
            )
          }
        }, 100)
      })
      say('loading-images')
      const load = (url) =>
        new Promise((resolve, reject) => {
          window.JS9.Load(url, {
            scale: 'linear',
            scalemin: field.scale.scalemin,
            scalemax: field.scale.scalemax,
            onload: (im) => resolve(im),
            onerror: () => reject(new Error('JS9 failed to load ' + url)),
          })
        })
      await load(field.epochs[0].url)
      await load(field.epochs[1].url)
      window.JS9.images.forEach((im) => {
        if (im.tmp) im.tmp.blinkMode = true
      })
      diag.images = window.JS9.images.map((im) => ({
        id: im.id,
        file: im.file || im.id,
      }))
      diag.hostChildren = display.childElementCount
      startMonitor()
      play()
      say('ready')
    } catch (e) {
      diag.error = String((e && e.message) || e)
      say('error')
    }
  }
  boot()

  return {
    play,
    pause,
    isPlaying: () => playing,
    show(epochIdx) {
      pause()
      const im = window.JS9 && window.JS9.images && window.JS9.images[epochIdx]
      if (im) {
        window.JS9.Display(im)
        cb.onEpoch(im, { ...diag })
      }
    },
  }
}
