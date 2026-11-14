# Planet X and SPHEREx

RiverHacks x NASA Space Apps 2026 — a SPHEREx epoch blink viewer.

Built by Kenichi Nishimura (solo competitor) with disclosed AI assistance.
The field preparation and audit work was done by K3N1, an AI agent working
from the competitor's design, and the results were red-teamed by an outside
panel of other AI models. Data: NASA/IRSA SPHEREx archive (Quick Release 2,
Quick Release 3, Data Release 1). Ephemerides: JPL Horizons.

This publication makes use of data products from the Spectro-Photometer for
the History of the Universe, Epoch of Reionization and Ices Explorer
(SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the
California Institute of Technology, and is funded by the National
Aeronautics and Space Administration.

Blink viewer: JS9 v3.9.0 (Smithsonian Astrophysical Observatory), vendored
under public/js9 from the official npm distribution. SPHEREx FITS field data
is staged locally under public/data (SHA-256-verified against the field
slate manifest) and is not committed. Wavelength values shown in the app
were computed from each original frame's wavelength table during field
preparation and are stored in src/fields.json; nothing is read live.
