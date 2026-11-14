import { useEffect, useRef, useState } from 'react'
import './App.css'
import fieldsData from './fields.json'
import { mountViewer } from './js9Viewer.js'

const FIELDS = fieldsData.fields

function fieldFromUrl() {
  try {
    const id = new URLSearchParams(window.location.search).get('field')
    return FIELDS.find((f) => f.id === id) || FIELDS[0]
  } catch {
    return FIELDS[0]
  }
}

function statusText(d) {
  if (!d) return 'STARTING'
  switch (d.phase) {
    case 'loading-js9':
      return 'LOADING JS9...'
    case 'waiting-ready':
      return 'WAITING FOR JS9 READY...'
    case 'loading-images':
      return 'LOADING EPOCHS...'
    case 'switching-field':
      return 'SWITCHING FIELD...'
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

function fmtLambda(v) {
  return v == null ? 'not measured' : v.toFixed(4) + ' µm'
}

export default function App() {
  const hostRef = useRef(null)
  const viewerRef = useRef(null)
  const startedRef = useRef(false)
  const [field, setField] = useState(fieldFromUrl)
  const fieldRef = useRef(field)
  const [diag, setDiag] = useState(null)
  const [epochIdx, setEpochIdx] = useState(0)
  const [epochLabel, setEpochLabel] = useState(field.epochs[0].label)
  const [playing, setPlaying] = useState(field.blink !== false)

  useEffect(() => {
    if (startedRef.current) return // StrictMode double-mount guard
    startedRef.current = true
    viewerRef.current = mountViewer(hostRef.current, fieldRef.current, {
      onPhase: (d) => setDiag(d),
      onEpoch: (im) => {
        const idx =
          window.JS9 && window.JS9.images
            ? window.JS9.images.findIndex((i) => i.id === im.id)
            : -1
        if (idx >= 0 && fieldRef.current.epochs[idx]) {
          setEpochIdx(idx)
          setEpochLabel(fieldRef.current.epochs[idx].label)
        }
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchField = (f) => {
    if (f.id === fieldRef.current.id) return
    fieldRef.current = f
    setField(f)
    setEpochIdx(0)
    setEpochLabel(f.epochs[0].label)
    setPlaying(f.blink !== false)
    try {
      window.history.replaceState(null, '', '?field=' + f.id)
    } catch {
      /* deep link is insurance, not a dependency */
    }
    viewerRef.current && viewerRef.current.setField(f)
  }

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
    setEpochIdx(idx)
    setEpochLabel(field.epochs[idx].label)
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

      <nav className="picker" aria-label="Field picker">
        {FIELDS.map((f) => (
          <button
            key={f.id}
            type="button"
            data-picker-field={f.id}
            className={f.id === field.id ? 'picker-btn active' : 'picker-btn'}
            onClick={() => switchField(f)}
          >
            <span className="picker-title">{f.title}</span>
            <span className="picker-meta">
              {f.object} - {f.release}
            </span>
          </button>
        ))}
        <p className="picker-caption">
          Curated fields from the picker, the challenge&apos;s five test
          targets by their coordinates, blinking epochs out.
        </p>
      </nav>

      <div id="gate1-status" data-state={diag ? diag.phase : 'starting'}>
        {statusText(diag)}
      </div>

      <main>
        <section className="viewer">
          <div className="bar">
            <span className="field-title" id="field-title">
              {field.title}
            </span>
            <span className="epoch-label" id="epoch-label">
              Showing: {epochLabel}
            </span>
          </div>
          <div className="controls">
            <button type="button" onClick={togglePlay}>
              {playing ? 'Pause blink' : 'Resume blink'}
            </button>
          </div>
          <div className="timeline" aria-label="Epoch timeline">
            {field.epochs.map((ep, i) => (
              <button
                key={ep.url}
                type="button"
                data-epoch-chip={i}
                className={i === epochIdx ? 'chip active' : 'chip'}
                onClick={() => showEpoch(i)}
              >
                {ep.short}
                {ep.lambdaUm != null
                  ? ' - λ ' + ep.lambdaUm.toFixed(3) + ' µm'
                  : ''}
              </button>
            ))}
          </div>
          {/* React renders this host empty and never manages its children:
              the JS9 display subtree is built imperatively inside it. */}
          <div id="js9-host" ref={hostRef}></div>
        </section>

        <aside className="panel">
          <h2>What am I seeing?</h2>
          {field.story.map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          <h3>Wavelength at the target</h3>
          <table className="lambda-table">
            <tbody>
              {field.epochs.map((ep) => (
                <tr key={ep.url}>
                  <td>{ep.short}</td>
                  <td>{fmtLambda(ep.lambdaUm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{field.lambdaLine}.</p>
          <p className="note">
            These wavelength values were computed from each original
            frame&apos;s wavelength table when the field was prepared and are
            stored with the field. Nothing is read live.
          </p>

          <h3>The numbers</h3>
          <p>
            Baseline: {field.baseline}. Release: {field.release}.
            {field.shiftPx != null
              ? ' Measured shift: ' + field.shiftPx + ' pixels.'
              : ''}
          </p>
          {field.shiftNote ? <p>{field.shiftNote}</p> : null}
          {field.snrMethod ? (
            <p>
              Signal-to-noise by {field.snrMethod}:{' '}
              {field.epochs
                .map((ep) => ep.short + ' ' + ep.snr)
                .join(', ')}
              .
            </p>
          ) : (
            <p>No mover is claimed for this field.</p>
          )}
          <p className="note">
            This demo verifies a known object at its measured position in
            archival data. Nothing here is claimed as a discovery.
          </p>
        </aside>
      </main>

      <section className="story-section" id="about-pluto">
        <h2>The one that got away: Pluto</h2>
        <p>
          Pluto was the first target this project tested, back in October,
          and the answer was no. The staged pair from that work is a phantom:
          with the correct ephemeris, Pluto sits about 659 pixels off-frame
          in both files, and aperture photometry at the claimed pixels gives
          signal-to-noise 0.2 and -0.5. Empty sky.
        </p>
        <p>
          The repair hunt searched Data Release 1 for frames containing
          Pluto&apos;s true position and presence-tested three
          wavelength-matched pairs. D1, matched to 0.81 percent:
          signal-to-noise -1.40 and +1.85, noise. D2, matched to 0.60
          percent: zero flux at the predicted pixel in both epochs. D6,
          matched to 3.63 percent: signal-to-noise 0.63 and -0.05. Pair
          after pair, the data said no.
        </p>
        <div className="refused-card">
          <h3>Refused pair</h3>
          <p>
            A Pluto pair from 2025-10-09, frames 2025W41_1A_0729_4 and
            2025W41_1A_0756_1, detector D1. At Pluto&apos;s true pixel the
            wavelengths run 0.777 to 1.062 microns, 31.0 percent apart. The 2
            percent rule refuses it, so it never blinks. The pair is also a
            phantom: Pluto sits just off the detector&apos;s left edge in
            both frames.
          </p>
        </div>
        <p className="note">
          This covers the pairs tested. It does not claim Pluto cannot be
          seen in SPHEREx data at all.
        </p>
      </section>

      <section className="story-section" id="coordinate-targets">
        <h2>The official test targets, by coordinates</h2>
        <p>
          The challenge names five test targets. The tool handles them by
          their coordinates, not as picker fields. Two have measured results
          so far:
        </p>
        <ul>
          <li>
            <strong>Barnard&apos;s Star:</strong> detected at its propagated
            pixel. Measured shift 1.29 pixels over 262.2 days, against 1.20
            predicted. Real motion, but under a pixel, too small to blink.
          </li>
          <li>
            <strong>Epsilon Indi B:</strong> detected at its propagated
            pixel. Measured shift 0.72 pixels over 370.0 days, against 0.77
            predicted. Real motion, but under a pixel, too small to blink.
          </li>
        </ul>
        <p className="note">
          WISE 0855, RW Aurigae, and R Draconis have no result in this
          build. Their tests are still running.
        </p>
      </section>

      <footer className="credits">
        <p>
          Built by Kenichi Nishimura (solo competitor) with disclosed AI
          assistance. The field preparation and audit work was done by K3N1,
          an AI agent working from the competitor&apos;s design, and the
          results were red-teamed by an outside panel of other AI models.
        </p>
        <p>
          Data: NASA/IRSA SPHEREx archive (Quick Release 2, Quick Release 3,
          Data Release 1). Ephemerides: JPL Horizons. Moving-object check:
          SkyBoT. Viewer: JS9, the SAOImage DS9 viewer for the web
          (Smithsonian Astrophysical Observatory).
        </p>
        <p>
          This publication makes use of data products from the
          Spectro-Photometer for the History of the Universe, Epoch of
          Reionization and Ices Explorer (SPHEREx), which is a joint project
          of the Jet Propulsion Laboratory and the California Institute of
          Technology, and is funded by the National Aeronautics and Space
          Administration.
        </p>
      </footer>
    </div>
  )
}
