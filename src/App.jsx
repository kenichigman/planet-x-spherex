import { useEffect, useRef, useState } from 'react'
import './App.css'
import { HERO } from './fields.js'
import { mountViewer } from './js9Viewer.js'

function statusText(d) {
  if (!d) return 'STARTING'
  switch (d.phase) {
    case 'loading-js9':
      return 'LOADING JS9...'
    case 'waiting-ready':
      return 'WAITING FOR JS9 READY...'
    case 'loading-images':
      return 'LOADING EPOCHS...'
    case 'ready':
      return (
        'READY - images=' +
        d.images.length +
        ', hostChildren=' +
        d.hostChildren +
        ', switches=' +
        d.switches
      )
    case 'error':
      return 'ERROR - ' + d.error
    default:
      return 'STARTING'
  }
}

export default function App() {
  const hostRef = useRef(null)
  const viewerRef = useRef(null)
  const startedRef = useRef(false)
  const [diag, setDiag] = useState(null)
  const [epochLabel, setEpochLabel] = useState('...')
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (startedRef.current) return // StrictMode double-mount guard
    startedRef.current = true
    viewerRef.current = mountViewer(hostRef.current, HERO, {
      onPhase: (d) => setDiag(d),
      onEpoch: (im) => {
        const idx =
          window.JS9 && window.JS9.images
            ? window.JS9.images.findIndex((i) => i.id === im.id)
            : -1
        if (idx >= 0) setEpochLabel(HERO.epochs[idx].label)
      },
    })
  }, [])

  const togglePlay = () => {
    const v = viewerRef.current
    if (!v) return
    if (v.isPlaying()) {
      v.pause()
      setPlaying(false)
    } else {
      v.play()
      setPlaying(true)
    }
  }

  const showEpoch = (idx) => {
    viewerRef.current && viewerRef.current.show(idx)
    setPlaying(false)
    setEpochLabel(HERO.epochs[idx].label)
  }

  return (
    <div className="page">
      <header>
        <h1>Planet X and SPHEREx</h1>
        <p className="sub">
          A blink comparator for NASA&apos;s SPHEREx all-sky infrared survey,
          in the spirit of Tombaugh&apos;s 1930 Pluto search.
        </p>
      </header>

      <div id="gate1-status" data-state={diag ? diag.phase : 'starting'}>
        {statusText(diag)}
      </div>

      <main>
        <section className="viewer">
          <div className="bar">
            <span className="field-title">{HERO.title}</span>
            <span className="epoch-label">Showing: {epochLabel}</span>
          </div>
          <div className="controls">
            <button type="button" onClick={togglePlay}>
              {playing ? 'Pause blink' : 'Resume blink'}
            </button>
            <button type="button" onClick={() => showEpoch(0)}>
              Show Epoch A
            </button>
            <button type="button" onClick={() => showEpoch(1)}>
              Show Epoch B
            </button>
          </div>
          {/* React renders this host empty and never manages its children:
              the JS9 display subtree is built imperatively inside it. */}
          <div id="js9-host" ref={hostRef}></div>
        </section>

        <aside className="panel">
          <h2>What am I seeing?</h2>
          <p>
            Comet 3I/ATLAS in two SPHEREx epochs, {HERO.baseline}. The comet
            moved {HERO.shiftPx} pixels between the frames; the blink flips
            between them so the motion jumps out, the way a blink comparator
            makes a moving point of light stand still nowhere.
          </p>
          <p>
            Wavelengths matched to within 2 percent, near 4.5 to 4.6 microns
            (4.533 / 4.602 µm at the comet&apos;s pixel, Δλ {HERO.deltaLambdaPct}
            %). The wavelength values were computed from each original
            frame&apos;s wavelength table when this field was prepared and are
            stored with the field.
          </p>
          <p>
            Signal-to-noise by aperture photometry: {HERO.epochs[0].snr} (Epoch
            A), {HERO.epochs[1].snr} (Epoch B). This demo verifies a known
            comet at its measured position in archival data.
          </p>
          <p className="credit">
            Data: NASA/IRSA SPHEREx archive (Data Release 1 / Quick Release
            2). Viewer: JS9, the SAOImage DS9 viewer for the web
            (Smithsonian Astrophysical Observatory).
          </p>
        </aside>
      </main>
    </div>
  )
}
