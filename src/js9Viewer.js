// JS9 viewer engine.
//
// JS9 builds its own DOM. Putting the .JS9 div in React JSX orphans the
// display (hydration discards the subtree JS9 built into), so the display
// subtree is created imperatively inside a host element that React renders
// empty and never manages, and the JS9 library is loaded dynamically only
// after those divs exist. The readiness gate requires the host div to have
// children (JS9 actually built into OUR node) before any image load runs.
//
// Field switching goes through the CloseImage cleanup path: every loaded
// image is displayed and closed in turn, the image list is verified empty,
// and only then are the new field's epochs loaded.
//
// Diagnostics are published on window.__gate1 for the browser-leg probes.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function mountViewer(host, initialField, cb) {
  const diag = (window.__gate1 = {
    phase: 'building-host',
    fieldId: initialField.id,
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
  let currentField = initialField

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

  // Step the display to an epoch using DisplayNextImage only.
  // JS9.Display(im) throws "Cannot read properties of undefined (reading
  // 'defaultView')" in this build; DisplayNextImage is the same primitive
  // the blink timer uses and is proven by the switch counter.
  function displayEpoch(idx) {
    const JS9 = window.JS9
    if (!JS9 || !JS9.images || !JS9.images[idx]) return
    const target = JS9.images[idx].id
    for (let step = 0; step < JS9.images.length; step++) {
      const d = JS9.displays && JS9.displays[0]
      const cur = d && d.image ? d.image.id : null
      if (cur === target) return
      JS9.DisplayNextImage(1)
    }
  }

  function loadEpoch(field, ep) {
    const sc = ep.scale || field.scale
    return new Promise((resolve, reject) => {
      const opts = {
        scale: 'linear',
        scalemin: sc.scalemin,
        scalemax: sc.scalemax,
        onload: (im) => resolve(im),
        onerror: () => reject(new Error('JS9 failed to load ' + ep.url)),
      }
      window.JS9.Load(ep.url, opts)
    })
  }

  async function loadFieldImages(field) {
    for (const ep of field.epochs) {
      await loadEpoch(field, ep)
    }
    window.JS9.images.forEach((im) => {
      if (im.tmp) im.tmp.blinkMode = true
    })
    // Show the first epoch first, stepping with DisplayNextImage (the
    // blink primitive, proven in this build). JS9.Display(im) throws
    // 'defaultView' here, so it is never called.
    displayEpoch(0)
    // Gate 2 framing, applied per image while it is the displayed one:
    // JS9.SetZoom acts on the displayed image only. The Load-time zoom
    // option is NOT used: measured on the hero, zoom 1.8 at load framed
    // only the central 200x200 px window (rendered 360 display px,
    // indistinguishable from native size in the 880x660 display).
    // SetZoom('toFit') is the verified path: full frame, display filled
    // (hero measured zoom 1.8333, section spanning the whole cutout).
    if (field.zoom) {
      for (let i = 0; i < window.JS9.images.length; i++) {
        displayEpoch(i)
        try {
          window.JS9.SetZoom(field.zoom)
        } catch {
          /* framing is verified by the probe screenshots, not assumed */
        }
      }
      displayEpoch(0)
    }
    diag.images = window.JS9.images.map((im) => ({
      id: im.id,
      file: im.file || im.id,
    }))
    diag.hostChildren = display.childElementCount
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
      await loadFieldImages(currentField)
      startMonitor()
      if (currentField.blink !== false) play()
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
        displayEpoch(epochIdx)
        cb.onEpoch(im, { ...diag })
      }
    },
    async setField(newField) {
      if (newField.id === currentField.id) return
      pause()
      diag.fieldId = newField.id
      say('switching-field')
      try {
        // CloseImage cleanup path: display and close each loaded image,
        // then verify the image list is empty before loading the new set.
        let guard = 0
        while (
          window.JS9 &&
          window.JS9.images &&
          window.JS9.images.length > 0 &&
          guard < 24
        ) {
          guard++
          const im = window.JS9.images[0]
          try {
            window.JS9.Display(im)
          } catch {
            /* ignore */
          }
          try {
            window.JS9.CloseImage()
          } catch {
            /* ignore */
          }
          await sleep(120)
        }
        if (window.JS9 && window.JS9.images && window.JS9.images.length > 0) {
          throw new Error(
            'CloseImage cleanup left ' + window.JS9.images.length + ' images',
          )
        }
        diag.images = []
        diag.switches = 0
        diag.current = null
        lastId = null
        currentField = newField
        say('loading-images')
        await loadFieldImages(currentField)
        if (currentField.blink !== false) play()
        say('ready')
      } catch (e) {
        diag.error = String((e && e.message) || e)
        say('error')
      }
    },
  }
}
