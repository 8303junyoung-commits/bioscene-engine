import { strict as assert } from 'node:assert'
import { cleanOverlays, detailOverlays, figurePresetOverlays } from '../src/components/CanvasDisplayContext'

assert.equal(Object.values(cleanOverlays).some(Boolean), false, 'CLEAN must start without technical overlays')
assert.equal(detailOverlays.names, true)
assert.equal(detailOverlays.ports, true)
assert.equal(detailOverlays.compartments, true)
assert.deepEqual(figurePresetOverlays.publication, cleanOverlays)
assert.equal(figurePresetOverlays.presentation.names, true)
assert.equal(figurePresetOverlays.presentation.ports, false)
assert.equal(figurePresetOverlays.mechanism.interactionLabels, true)
assert.equal(figurePresetOverlays.debug.ids, true)
assert.equal(figurePresetOverlays.debug.debug, true)

console.log('Canvas display preset tests passed')
