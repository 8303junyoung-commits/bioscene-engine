import type {
  BioKind,
  BioNode,
  BioNodeData,
  BioNodeFields,
  BioNodePatch,
  Compartment,
  InteractionType,
  PortDefinition,
} from './types'

type SemanticDefaults = Omit<BioNodeFields, 'label'>

const port = (definition: PortDefinition) => definition
const bindingGrammar: InteractionType[] = ['BIND', 'BLOCK', 'AGONIZE', 'CLUSTER', 'RECRUIT', 'DIMERIZE', 'COMPETE', 'ACTIVATE']
const signalGrammar: InteractionType[] = ['ACTIVATE', 'INHIBIT', 'SIGNAL_ABSENT', 'PHOSPHORYLATE', 'EXPRESS', 'DEGRADE', 'CLEAVE']
const transportGrammar: InteractionType[] = ['TRANSLOCATE', 'SECRETE', 'INTERNALIZE']

export const semanticDefaults: Record<BioKind, SemanticDefaults> = {
  cell: {
    kind: 'cell', compartment: 'cytoplasm', domains: [], sites: [], ports: [],
    anchors: [{ id: 'anchor:cell:scene', type: 'parent', compartment: 'cytoplasm', orientation: 'free' }],
    states: [{ id: 'state:cell:present', label: 'present', allowedCompartments: ['cytoplasm'] }],
    allowedCompartments: ['cytoplasm'], state: 'state:cell:present',
  },
  annotation: {
    kind: 'annotation', compartment: 'cytoplasm', domains: [], sites: [], ports: [], anchors: [], states: [],
    allowedCompartments: ['extracellular', 'membrane', 'cytoplasm', 'nucleus', 'endosome', 'mitochondria'],
    annotation: { title: 'Key finding', body: 'Add a concise scientific interpretation.', tone: 'finding' },
  },
  receptor: {
    kind: 'receptor', compartment: 'membrane',
    domains: [
      { id: 'domain:receptor:extracellular', label: 'Extracellular domain', kind: 'extracellular' },
      { id: 'domain:receptor:transmembrane', label: 'Transmembrane domain', kind: 'transmembrane' },
      { id: 'domain:receptor:intracellular', label: 'Intracellular domain', kind: 'intracellular' },
    ],
    sites: [
      { id: 'site:receptor:ligand', label: 'Ligand-binding site', domainId: 'domain:receptor:extracellular', semantic: 'ligand-binding' },
      { id: 'site:receptor:epitope', label: 'Antibody epitope', domainId: 'domain:receptor:extracellular', semantic: 'antibody-epitope' },
    ],
    ports: [
      port({ id: 'binding-in', role: 'target', semantic: 'binding', side: 'top', domainId: 'domain:receptor:extracellular', siteId: 'site:receptor:ligand', allowedInteractions: bindingGrammar }),
      port({ id: 'complex-out', role: 'source', semantic: 'binding', side: 'right', domainId: 'domain:receptor:extracellular', siteId: 'site:receptor:ligand', allowedInteractions: bindingGrammar }),
      port({ id: 'signal-out', role: 'source', semantic: 'signal', side: 'bottom', domainId: 'domain:receptor:intracellular', allowedInteractions: signalGrammar }),
      port({ id: 'transport-out', role: 'source', semantic: 'transport', side: 'right', domainId: 'domain:receptor:transmembrane', allowedInteractions: transportGrammar }),
      port({ id: 'transport-in', role: 'target', semantic: 'transport', side: 'left', domainId: 'domain:receptor:transmembrane', allowedInteractions: transportGrammar }),
    ],
    anchors: [{ id: 'anchor:receptor:membrane', type: 'membrane', compartment: 'membrane', orientation: 'extracellular-to-cytoplasm' }, { id: 'anchor:receptor:endosome', type: 'compartment', compartment: 'endosome', orientation: 'free' }],
    states: [
      { id: 'state:receptor:inactive', label: 'inactive', allowedCompartments: ['membrane'] },
      { id: 'state:receptor:bound', label: 'bound', allowedCompartments: ['membrane'] },
      { id: 'state:receptor:active', label: 'active', allowedCompartments: ['membrane'] },
      { id: 'state:receptor:blocked', label: 'blocked', allowedCompartments: ['membrane'] },
      { id: 'state:receptor:internalized', label: 'internalized', allowedCompartments: ['endosome'] },
    ],
    allowedCompartments: ['membrane', 'endosome'], state: 'state:receptor:inactive',
  },
  ligand: {
    kind: 'ligand', compartment: 'extracellular',
    domains: [{ id: 'domain:ligand:functional', label: 'Functional surface', kind: 'functional' }],
    sites: [{ id: 'site:ligand:receptor', label: 'Receptor-binding site', domainId: 'domain:ligand:functional', semantic: 'ligand-binding' }],
    ports: [port({ id: 'binding-out', role: 'source', semantic: 'binding', side: 'bottom', domainId: 'domain:ligand:functional', siteId: 'site:ligand:receptor', allowedInteractions: bindingGrammar })],
    anchors: [{ id: 'anchor:ligand:extracellular', type: 'compartment', compartment: 'extracellular', orientation: 'free' }],
    states: [
      { id: 'state:ligand:soluble', label: 'soluble', allowedCompartments: ['extracellular'] },
      { id: 'state:ligand:bound', label: 'bound', allowedCompartments: ['extracellular'] },
    ],
    allowedCompartments: ['extracellular'], state: 'state:ligand:soluble',
  },
  antibody: {
    kind: 'antibody', compartment: 'extracellular',
    domains: [
      { id: 'domain:antibody:fab-left', label: 'Fab left', kind: 'variable' },
      { id: 'domain:antibody:fab-right', label: 'Fab right', kind: 'variable' },
      { id: 'domain:antibody:fc', label: 'Fc', kind: 'constant' },
    ],
    sites: [
      { id: 'site:antibody:fab-left', label: 'Fab antigen site', domainId: 'domain:antibody:fab-left', semantic: 'antibody-epitope' },
      { id: 'site:antibody:fab-right', label: 'Fab antigen site', domainId: 'domain:antibody:fab-right', semantic: 'antibody-epitope' },
    ],
    ports: [
      port({ id: 'fab-left', role: 'source', semantic: 'binding', side: 'bottom', domainId: 'domain:antibody:fab-left', siteId: 'site:antibody:fab-left', allowedInteractions: bindingGrammar }),
      port({ id: 'fab-right', role: 'source', semantic: 'binding', side: 'right', domainId: 'domain:antibody:fab-right', siteId: 'site:antibody:fab-right', allowedInteractions: bindingGrammar }),
    ],
    anchors: [{ id: 'anchor:antibody:extracellular', type: 'compartment', compartment: 'extracellular', orientation: 'free' }],
    states: [
      { id: 'state:antibody:free', label: 'free', allowedCompartments: ['extracellular'] },
      { id: 'state:antibody:bound', label: 'bound', allowedCompartments: ['extracellular'] },
    ],
    allowedCompartments: ['extracellular'], state: 'state:antibody:free',
  },
  signal: {
    kind: 'signal', compartment: 'cytoplasm',
    domains: [{ id: 'domain:signal:functional', label: 'Signaling domain', kind: 'functional' }],
    sites: [{ id: 'site:signal:phosphorylation', label: 'Phosphorylation site', domainId: 'domain:signal:functional', semantic: 'phosphorylation' }],
    ports: [
      port({ id: 'signal-in', role: 'target', semantic: 'signal', side: 'top', domainId: 'domain:signal:functional', allowedInteractions: signalGrammar }),
      port({ id: 'signal-out', role: 'source', semantic: 'signal', side: 'bottom', domainId: 'domain:signal:functional', allowedInteractions: signalGrammar }),
      port({ id: 'transport-out', role: 'source', semantic: 'transport', side: 'right', domainId: 'domain:signal:functional', allowedInteractions: transportGrammar }),
    ],
    anchors: [
      { id: 'anchor:signal:cytoplasm', type: 'compartment', compartment: 'cytoplasm', orientation: 'free' },
      { id: 'anchor:signal:nucleus', type: 'compartment', compartment: 'nucleus', orientation: 'free' },
      { id: 'anchor:signal:mitochondria', type: 'compartment', compartment: 'mitochondria', orientation: 'free' },
    ],
    states: [
      { id: 'state:signal:inactive', label: 'inactive', allowedCompartments: ['cytoplasm'] },
      { id: 'state:signal:active', label: 'active', allowedCompartments: ['cytoplasm'] },
      { id: 'state:signal:phosphorylated', label: 'phosphorylated', allowedCompartments: ['cytoplasm', 'nucleus'] },
      { id: 'state:signal:mitochondrial', label: 'mitochondrial', allowedCompartments: ['mitochondria'] },
    ],
    allowedCompartments: ['cytoplasm', 'nucleus', 'mitochondria'], state: 'state:signal:inactive',
  },
  transcription: {
    kind: 'transcription', compartment: 'nucleus',
    domains: [{ id: 'domain:transcription:dna-binding', label: 'DNA-binding domain', kind: 'functional' }],
    sites: [{ id: 'site:transcription:localization', label: 'Nuclear localization site', domainId: 'domain:transcription:dna-binding', semantic: 'localization' }],
    ports: [
      port({ id: 'signal-in', role: 'target', semantic: 'signal', side: 'top', domainId: 'domain:transcription:dna-binding', allowedInteractions: signalGrammar }),
      port({ id: 'transport-in', role: 'target', semantic: 'transport', side: 'left', domainId: 'domain:transcription:dna-binding', siteId: 'site:transcription:localization', allowedInteractions: transportGrammar }),
    ],
    anchors: [
      { id: 'anchor:transcription:cytoplasm', type: 'compartment', compartment: 'cytoplasm', orientation: 'free' },
      { id: 'anchor:transcription:nucleus', type: 'compartment', compartment: 'nucleus', orientation: 'free' },
    ],
    states: [
      { id: 'state:transcription:cytoplasmic', label: 'cytoplasmic', allowedCompartments: ['cytoplasm'] },
      { id: 'state:transcription:nuclear', label: 'nuclear', allowedCompartments: ['nucleus'] },
    ],
    allowedCompartments: ['cytoplasm', 'nucleus'], state: 'state:transcription:nuclear',
  },
}

export function createBioData(kind: BioKind, label: string, overrides: BioNodePatch = {}): BioNodeData {
  const defaults = semanticDefaults[kind]
  const interactionFallback: Record<PortDefinition['semantic'], InteractionType[]> = {
    binding: bindingGrammar, signal: signalGrammar, transport: transportGrammar,
  }
  return {
    ...defaults,
    ...overrides,
    kind,
    label,
    domains: (overrides.domains ?? defaults.domains).map((item) => ({ ...item })),
    sites: (overrides.sites ?? defaults.sites).map((item) => ({ ...item })),
    ports: (overrides.ports ?? defaults.ports).map((item) => {
      const matchingDefault = defaults.ports.find((candidate) => candidate.id === item.id)
      return {
        ...matchingDefault,
        ...item,
        allowedInteractions: [...(item.allowedInteractions ?? matchingDefault?.allowedInteractions ?? interactionFallback[item.semantic])],
      }
    }),
    anchors: (overrides.anchors ?? defaults.anchors).map((item) => ({ ...item })),
    states: (overrides.states ?? defaults.states).map((item) => ({ ...item, allowedCompartments: [...item.allowedCompartments] })),
    allowedCompartments: [...(overrides.allowedCompartments ?? defaults.allowedCompartments)],
    asset: overrides.asset ? { ...overrides.asset, synonyms: [...overrides.asset.synonyms], identifiers: overrides.asset.identifiers.map((item) => ({ ...item })), svgDomains: overrides.asset.svgDomains.map((item) => ({ ...item })) } : undefined,
    annotation: overrides.annotation ? { ...overrides.annotation } : undefined,
  }
}

export function stateLabel(data: BioNodeData) {
  return data.states.find((state) => state.id === data.state)?.label ?? data.state
}

export function inferInteraction(sourcePort?: PortDefinition, sourceKind?: BioKind): InteractionType {
  if (sourcePort?.semantic === 'transport') return 'TRANSLOCATE'
  if (sourcePort?.semantic === 'signal') return 'ACTIVATE'
  if (sourceKind === 'antibody') return 'BLOCK'
  return 'BIND'
}

export function validateConnection(
  source?: BioNode,
  target?: BioNode,
  sourceHandle?: string | null,
  targetHandle?: string | null,
  interaction?: InteractionType,
) {
  if (!source || !target) return 'Connection endpoint is missing'
  if (source.id === target.id) return 'An object cannot connect to itself'
  const output = source.data.ports.find((item) => item.id === sourceHandle)
  const input = target.data.ports.find((item) => item.id === targetHandle)
  if (!output || !input) return 'Choose explicit biological ports on both objects'
  if (output.role !== 'source' || input.role !== 'target') return 'Connections must run from a source port to a target port'
  if (output.semantic !== input.semantic) return `${output.semantic} ports cannot connect to ${input.semantic} ports`
  if (interaction && (!output.allowedInteractions.includes(interaction) || !input.allowedInteractions.includes(interaction))) {
    return `${interaction} is not allowed between ${output.id} and ${input.id}`
  }
  return undefined
}

export function stateAllowsCompartment(node: BioNode) {
  const state = node.data.states.find((item) => item.id === node.data.state)
  return !state || state.allowedCompartments.includes(node.data.compartment)
}

export const allCompartments: Compartment[] = ['extracellular', 'membrane', 'cytoplasm', 'nucleus', 'endosome', 'mitochondria']
