import assert from 'node:assert/strict'
import { safeAssetFile } from '../src/assetRegistry'
import { sanitizedEndpoint } from '../src/backend'
import { cloneTemplate, sceneTemplates } from '../src/data'
import { parseMechanism, sceneFromMechanism } from '../src/mechanism'
import type { SceneTemplateId } from '../src/types'
import { biologicalWarnings, regionBoundsFor, safeHttpUrl } from '../src/utils'
import { membraneLipidSamples, offsetMembranePoints } from '../src/membraneGeometry'

for (const [id, template] of Object.entries(sceneTemplates)) {
  assert.deepEqual(biologicalWarnings(template.nodes, template.edges), [], `${id} must be scientifically and spatially valid`)
  for (const cell of template.nodes.filter((node) => node.data.kind === 'cell')) {
    assert.equal(cell.deletable, false, `${id} cell containers must not be keyboard-deletable`)
    const width = Number(cell.style?.width ?? 620)
    for (const compartment of ['extracellular','membrane','cytoplasm','nucleus','endosome','mitochondria'] as const) {
      const bounds = regionBoundsFor(compartment, width)
      assert.ok(bounds.x[0] <= bounds.x[1], `${id} ${compartment} bounds must be ordered`)
      assert.ok(bounds.x[1] + 132 <= width, `${id} ${compartment} nodes must remain inside the cell`)
    }
  }
  const clone = cloneTemplate(id as SceneTemplateId)
  assert.notEqual(clone.nodes, template.nodes, `${id} must clone node arrays`)
  assert.notEqual(clone.edges, template.edges, `${id} must clone edge arrays`)
}

assert.equal(safeHttpUrl('javascript:alert(1)'), undefined)
assert.equal(safeHttpUrl('data:text/html,test'), undefined)
assert.equal(safeHttpUrl('https://example.org/paper')?.startsWith('https://example.org/'), true)
assert.equal(safeAssetFile('../secret.svg'), undefined)
assert.equal(safeAssetFile('folder\\secret.svg'), undefined)
assert.equal(safeAssetFile('proteins/receptor.svg'), 'proteins/receptor.svg')

const horizontalMembrane=[{x:0,y:20},{x:100,y:20}]
assert.deepEqual(offsetMembranePoints(horizontalMembrane,5),[{x:0,y:25},{x:100,y:25}])
const lipidSamples=membraneLipidSamples(horizontalMembrane,20)
assert.equal(lipidSamples.length,5); assert.equal(lipidSamples.every((sample)=>sample.point.y===20&&sample.angle===90),true)

assert.throws(() => sanitizedEndpoint('http://example.org/api'))
assert.equal(sanitizedEndpoint('https://user:pass@example.org/api?token=secret#fragment'), 'https://example.org/api')
assert.equal(sanitizedEndpoint('http://127.0.0.1:54321/api'), 'http://127.0.0.1:54321/api')

const il18bp = parseMechanism('IL-18BP neutralizes inflammatory signaling.')
assert.equal(il18bp.entities.some((entity) => entity.id === 'il18bp'), true)
assert.equal(il18bp.entities.some((entity) => entity.id === 'il18'), false, 'IL-18BP must not be misclassified as IL-18')

const il2 = parseMechanism('IL-2 activates STAT5 in T cells.')
assert.equal(il2.interactions.some((edge) => edge.source === 'il2r' && edge.target === 'stat5' && edge.interaction === 'ACTIVATE'), true)
const checkpoint = parseMechanism('PD-L1 binds PD-1 on a CD8 T cell.')
assert.equal(checkpoint.interactions.some((edge) => edge.source === 'pdl1' && edge.target === 'pd1' && edge.interaction === 'BIND'), true)

const blocked = sceneFromMechanism(parseMechanism('SLC-7020 blocks IL-18Rβ signaling in an NK cell.'))
assert.deepEqual(biologicalWarnings(blocked.nodes, blocked.edges), [], 'generated blockade scene must not emit active signaling from blocked nodes')
assert.equal(blocked.nodes.some((node) => node.data.provenance === 'inferred'), true, 'inferred entities must preserve provenance')

console.log('Core tests passed: templates, geometry, parser, provenance, URL safety, assets, and endpoint security')

