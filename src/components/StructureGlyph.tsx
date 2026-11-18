import { useId } from 'react'
import type { BioNodeData, StructuralTemplate } from '../types'

const inferredTemplate = (data: BioNodeData): StructuralTemplate =>
  data.kind === 'receptor'
    ? 'single_pass_receptor'
    : data.kind === 'antibody'
      ? 'igg'
      : data.kind === 'ligand'
        ? 'cytokine'
        : 'globular'

const confidenceColor = (value: number) =>
  value >= 90 ? '#2458d3' : value >= 70 ? '#20a7db' : value >= 50 ? '#f0c928' : '#ed6a35'

const antibodyColors = ['#7348b8', '#e06348', '#1f8ea3', '#c44576', '#3d8f62']

function isPhosphorylated(data: BioNodeData) {
  return data.phosphorylated === true || Boolean(data.state && /phosphorylated/i.test(data.state))
}

function isInactiveState(data: BioNodeData) {
  return Boolean(data.state && /inactive|blocked|cytoplasmic|suppressed/i.test(data.state) && data.kind !== 'receptor')
}

function PhosphoBadge({ x = 56, y = 16 }: { x?: number; y?: number }) {
  return (
    <g className="phospho-badge" transform={`translate(${x}, ${y})`}>
      <circle r="7.5" fill="#fbbf24" stroke="#b45309" strokeWidth="1.4" />
      <circle cx="-2" cy="-2.2" r="2.2" fill="rgba(255,255,255,0.55)" />
      <text x="0" y="3.1" textAnchor="middle" fill="#78350f" fontSize="8.5" fontWeight="900" style={{ display: 'block' }}>
        P
      </text>
    </g>
  )
}

function WarheadStar({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      d={`M${cx} ${cy - 4.8} L${cx + 1.5} ${cy - 1.5} L${cx + 4.8} ${cy} L${cx + 1.5} ${cy + 1.5} L${cx} ${cy + 4.8} L${cx - 1.5} ${cy + 1.5} L${cx - 4.8} ${cy} L${cx - 1.5} ${cy - 1.5} Z`}
      fill="#f59e0b"
      stroke="#b45309"
      strokeWidth="0.9"
    />
  )
}

function SmallMoleculeGlyph({ color = '#0ea5e9', label }: { color?: string; label: string }) {
  return (
    <svg className="structure-glyph small-molecule-structure" viewBox="0 0 72 64" aria-label={label}>
      <ellipse cx="36" cy="33" rx="24" ry="18" fill={color} fillOpacity="0.14" />
      <polygon
        points="27,22 36,27 36,38 27,43 18,38 18,27"
        fill={color}
        fillOpacity="0.28"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <polygon
        points="45,22 54,27 54,38 45,43 36,38 36,27"
        fill={color}
        fillOpacity="0.52"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <line x1="22" y1="29" x2="22" y2="36" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="54" y1="27" x2="60" y2="23" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="61" cy="22" r="3" fill="#f97316" stroke="#ffffff" strokeWidth="1" />
      <circle cx="18" cy="38" r="2.8" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
    </svg>
  )
}

function FabGlyph({ color, label, scfv = false }: { color: string; label: string; scfv?: boolean }) {
  return (
    <svg className="structure-glyph antibody-structure fab-structure" viewBox="0 0 72 64" aria-label={label}>
      {scfv ? (
        <g>
          <path d="M28 18 C36 10, 46 14, 44 26" fill="none" stroke="#64748b" strokeWidth="2.2" strokeDasharray="3 2" />
          <rect x="20" y="18" width="15" height="24" rx="7.5" transform="rotate(14 27 30)" fill={color} stroke="#3b2667" strokeWidth="1.6" />
          <rect x="37" y="21" width="15" height="24" rx="7.5" transform="rotate(14 44 33)" fill="#9b7bd8" stroke="#3b2667" strokeWidth="1.6" />
          <ellipse cx="26" cy="24" rx="3" ry="6" transform="rotate(14 26 24)" fill="rgba(255,255,255,0.38)" />
        </g>
      ) : (
        <g>
          {/* Constant CH1/CL upper pair */}
          <rect x="27" y="10" width="11" height="20" rx="5.5" transform="rotate(18 32 20)" fill="#a594c8" stroke="#4c3b73" strokeWidth="1.5" />
          <rect x="39" y="14" width="11" height="20" rx="5.5" transform="rotate(18 44 24)" fill="#c2b5de" stroke="#4c3b73" strokeWidth="1.5" />
          {/* Variable VH/VL antigen-binding lower pair aiming downward */}
          <rect x="21" y="29" width="12" height="22" rx="6" transform="rotate(18 27 40)" fill={color} stroke="#38235e" strokeWidth="1.6" />
          <rect x="33" y="33" width="12" height="22" rx="6" transform="rotate(18 39 44)" fill={color} fillOpacity="0.86" stroke="#38235e" strokeWidth="1.6" />
          <ellipse cx="26" cy="36" rx="2.6" ry="6" transform="rotate(18 26 36)" fill="rgba(255,255,255,0.4)" />
        </g>
      )}
    </svg>
  )
}

/**
 * Biologically oriented IgG:
 * Fc stem sits at top (y=4..27), hinge in center (y=27..31), and paired Fab arms
 * open downward (y=30..59) so paratopes naturally engage receptors/cytokines below.
 */
function IgGGlyph({
  leftColor,
  rightColor,
  withFc = true,
  hasPayload = false,
  label,
  showLabels = false,
  extraColors = [],
  leftOpacity = 1,
  rightOpacity = 1,
  fcOpacity = 1,
}: {
  leftColor: string
  rightColor: string
  withFc?: boolean
  hasPayload?: boolean
  label: string
  showLabels?: boolean
  extraColors?: string[]
  leftOpacity?: number
  rightOpacity?: number
  fcOpacity?: number
}) {
  return (
    <svg className="structure-glyph antibody-structure igg-structure" viewBox="0 0 72 64" aria-label={label}>
      {/* Fc Stem (CH3 + CH2 + N-glycan pearls) */}
      {withFc && (
        <g style={{ opacity: fcOpacity }}>
          <rect x="26.5" y="4" width="8.5" height="11.5" rx="4.2" fill="#9d8ec4" stroke="#48386e" strokeWidth="1.4" />
          <rect x="37" y="4" width="8.5" height="11.5" rx="4.2" fill="#9d8ec4" stroke="#48386e" strokeWidth="1.4" />
          <rect x="26" y="15.5" width="8.8" height="11.5" rx="4.4" fill="#b3a5d6" stroke="#48386e" strokeWidth="1.4" />
          <rect x="37.2" y="15.5" width="8.8" height="11.5" rx="4.4" fill="#b3a5d6" stroke="#48386e" strokeWidth="1.4" />
          {/* Fc Glycan pearls */}
          <circle cx="35.3" cy="21" r="1.5" fill="#38bdf8" />
          <circle cx="36.9" cy="21" r="1.5" fill="#34d399" />
          <ellipse cx="29" cy="9" rx="1.8" ry="3.5" fill="rgba(255,255,255,0.38)" />
          <ellipse cx="39.5" cy="9" rx="1.8" ry="3.5" fill="rgba(255,255,255,0.38)" />
        </g>
      )}
      {!withFc && <path className="antibody-fab2-tail" d="M29 25 Q36 20 43 25" fill="none" stroke="#5b4982" strokeWidth="2.2" />}

      {/* Flexible Hinge & Disulfide Bridges */}
      <g className="antibody-hinge">
        <path d="M31 26.5 L28 32 M41 26.5 L44 32" stroke="#48386e" strokeWidth="2" strokeLinecap="round" />
        <line x1="30" y1="28.5" x2="42" y2="28.5" stroke="#d97706" strokeWidth="1.4" />
        <line x1="29.5" y1="30.6" x2="42.5" y2="30.6" stroke="#d97706" strokeWidth="1.4" />
      </g>

      {/* Left Fab Arm (CH1/CL + colored VH/VL aiming down-left) */}
      <g style={{ opacity: leftOpacity }}>
        <g transform="rotate(30 25 38)">
          <rect x="19.5" y="29" width="7.8" height="13" rx="3.9" fill="#b4a6d6" stroke="#48386e" strokeWidth="1.4" />
          <rect x="11.5" y="30" width="7.5" height="12.5" rx="3.7" fill="#cfc5e8" stroke="#48386e" strokeWidth="1.4" />
          <rect className="antibody-variable-domain" x="19.5" y="42" width="8.2" height="14" rx="4.1" fill={leftColor} stroke="#311f54" strokeWidth="1.5" />
          <rect className="antibody-variable-domain" x="11" y="42.5" width="8" height="13.5" rx="4" fill={leftColor} fillOpacity="0.86" stroke="#311f54" strokeWidth="1.5" />
          <ellipse cx="22.3" cy="48" rx="1.6" ry="4" fill="rgba(255,255,255,0.42)" />
        </g>
      </g>

      {/* Right Fab Arm (CH1/CL + colored VH/VL aiming down-right) */}
      <g style={{ opacity: rightOpacity }}>
        <g transform="rotate(-30 47 38)">
          <rect x="44.7" y="29" width="7.8" height="13" rx="3.9" fill="#b4a6d6" stroke="#48386e" strokeWidth="1.4" />
          <rect x="53" y="30" width="7.5" height="12.5" rx="3.7" fill="#cfc5e8" stroke="#48386e" strokeWidth="1.4" />
          <rect className="antibody-variable-domain" x="44.3" y="42" width="8.2" height="14" rx="4.1" fill={rightColor} stroke="#311f54" strokeWidth="1.5" />
          <rect className="antibody-variable-domain" x="53" y="42.5" width="8" height="13.5" rx="4" fill={rightColor} fillOpacity="0.86" stroke="#311f54" strokeWidth="1.5" />
          <ellipse cx="47.2" cy="48" rx="1.6" ry="4" fill="rgba(255,255,255,0.42)" />
        </g>
      </g>

      {/* Multivalent extra binding units (2+1, 2+2, trispecific) */}
      {extraColors.slice(0, 4).map((color, index) => (
        <g key={`${color}-${index}`}>
          <circle
            className="antibody-extra-unit"
            cx={index % 2 === 0 ? 15 : 57}
            cy={22 + Math.floor(index / 2) * 11}
            r="4.8"
            fill={color}
            stroke="#311f54"
            strokeWidth="1.3"
          />
          <circle cx={(index % 2 === 0 ? 15 : 57) - 1.3} cy={20.7 + Math.floor(index / 2) * 11} r="1.4" fill="rgba(255,255,255,0.45)" />
        </g>
      ))}

      {/* ADC Payload Linker + Cytotoxic Warhead Stars */}
      {hasPayload && (
        <g className="adc-payloads">
          <path d="M26 12 C19 10, 17 15, 12 13" fill="none" stroke="#b45309" strokeWidth="1.4" />
          <WarheadStar cx={11} cy={13} />
          <path d="M46 12 C53 10, 55 15, 60 13" fill="none" stroke="#b45309" strokeWidth="1.4" />
          <WarheadStar cx={61} cy={13} />
          <path d="M26 21 C20 22, 18 26, 14 25" fill="none" stroke="#b45309" strokeWidth="1.4" />
          <WarheadStar cx={13} cy={25} />
          <path d="M46 21 C52 22, 54 26, 58 25" fill="none" stroke="#b45309" strokeWidth="1.4" />
          <WarheadStar cx={59} cy={25} />
        </g>
      )}

      {showLabels && (
        <>
          {withFc && <text className="antibody-label" x="49" y="12">Fc</text>}
          <text className="antibody-label" x="3" y="59">Fab</text>
          <text className="antibody-label" x="56" y="59">Fab</text>
        </>
      )}
    </svg>
  )
}

export function StructureGlyph({ data }: { data: BioNodeData }) {
  const uidPrefix = useId().replace(/:/g, '')
  const model = data.structuralModel
  const template = model?.template ?? inferredTemplate(data)
  const domains = model?.domains ?? data.domains
  const highlighted = new Set(domains.filter((domain) => domain.highlighted).map((domain) => domain.id))
  const opacity = (id?: string) => (highlighted.size && (!id || !highlighted.has(id)) ? 0.28 : 1)
  const architecture = model?.architecture
  const phospho = isPhosphorylated(data)
  const inactive = isInactiveState(data)
  const custom = data.customColor
  const labelUpper = data.label.toUpperCase()

  // 0. Explicit small-molecule inhibitor / agonist glyph
  if (data.smallMolecule) {
    return <SmallMoleculeGlyph color={custom ?? '#0284c7'} label={`${data.label} small molecule representation`} />
  }

  // 1. Intracellular signaling node (MyD88, JAK, STAT, ZAP70, PI3K, AKT, ERK, SHP-2)
  if (data.kind === 'signal') {
    const baseFill = inactive ? '#94a3b8' : custom ?? '#3b82f6'
    const darkStroke = inactive ? '#64748b' : '#1d4ed8'
    const secondFill = inactive ? '#cbd5e1' : '#60a5fa'
    return (
      <svg className="structure-glyph signaling-structure" viewBox="0 0 72 64" aria-label={`${data.label} signaling protein representation`}>
        <defs>
          <linearGradient id={`${uidPrefix}-sig`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={secondFill} />
            <stop offset="100%" stopColor={baseFill} />
          </linearGradient>
        </defs>
        {!inactive && <ellipse cx="36" cy="34" rx="28" ry="18" fill={baseFill} fillOpacity="0.12" />}
        {/* Bilobed kinase / adaptor complex */}
        <rect
          x="11"
          y="19"
          width="50"
          height="28"
          rx="14"
          fill={`url(#${uidPrefix}-sig)`}
          stroke={darkStroke}
          strokeWidth="1.8"
          strokeDasharray={inactive ? '4 2.5' : undefined}
        />
        <path d="M36 20 C33 27, 39 39, 36 46" fill="none" stroke={darkStroke} strokeOpacity="0.45" strokeWidth="1.4" />
        <ellipse cx="26" cy="26" rx="9" ry="4" fill="rgba(255,255,255,0.42)" />
        <circle cx="48" cy="33" r="4.2" fill="rgba(255,255,255,0.24)" />
        {phospho && <PhosphoBadge x={57} y={17} />}
      </svg>
    )
  }

  // 2. Nuclear transcription factor + DNA promoter duplex (NF-kB, STAT3/5, NFAT, FOXP3)
  if (data.kind === 'transcription') {
    const tfFill = inactive ? '#94a3b8' : custom ?? '#db5a42'
    const tfStroke = inactive ? '#64748b' : '#9a3412'
    return (
      <svg className="structure-glyph transcription-structure" viewBox="0 0 72 64" aria-label={`${data.label} transcription factor representation`}>
        {/* Double-stranded DNA promoter */}
        <path d="M6 48 C16 42, 26 54, 36 48 C46 42, 56 54, 66 48" fill="none" stroke="#4f46e5" strokeWidth="2.3" strokeLinecap="round" />
        <path d="M6 53 C16 59, 26 47, 36 53 C46 59, 56 47, 66 53" fill="none" stroke="#818cf8" strokeWidth="2.1" strokeLinecap="round" />
        {[14, 22, 30, 42, 50, 58].map((x) => (
          <line key={x} x1={x} y1="47.5" x2={x} y2="53.5" stroke="#a5b4fc" strokeWidth="1.2" />
        ))}
        {/* Transcription start arrow */}
        {!inactive && (
          <g stroke="#16a34a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M53 45 V35 H64" />
            <path d="M60 31.5 L64.5 35 L60 38.5" />
          </g>
        )}
        {/* Bound TF dimer */}
        <ellipse cx="29" cy="31" rx="11" ry="13" fill={tfFill} stroke={tfStroke} strokeWidth="1.7" strokeDasharray={inactive ? '3.5 2' : undefined} />
        <ellipse cx="42" cy="33" rx="10" ry="11.5" fill={tfFill} fillOpacity="0.88" stroke={tfStroke} strokeWidth="1.7" strokeDasharray={inactive ? '3.5 2' : undefined} />
        <ellipse cx="26" cy="25" rx="4" ry="2.5" fill="rgba(255,255,255,0.45)" />
        {phospho && <PhosphoBadge x={54} y={18} />}
      </svg>
    )
  }

  // 3. Antibodies, Bispecifics, ADCs, Fab, scFv
  const adcLike = Boolean(data.hasPayload || /adc/i.test(data.label))
  if (architecture?.kind === 'antibody') {
    const units = architecture.components.filter((item) => item.type === 'binding_unit').slice(0, 8)
    const unitColors = units.map((unit, idx) =>
      idx === 0 && custom
        ? custom
        : antibodyColors[Math.max(0, architecture.specificities.findIndex((item) => item.id === unit.specificityId)) % antibodyColors.length],
    )
    const label = `${architecture.antibodyFormat ?? 'custom'} antibody architecture`
    if (architecture.antibodyFormat === 'scfv') {
      return <FabGlyph color={custom ?? unitColors[0] ?? antibodyColors[0]} label={label} scfv />
    }
    if (units.length <= 1 && !architecture.fc) {
      return <FabGlyph color={custom ?? unitColors[0] ?? antibodyColors[0]} label={label} />
    }
    return (
      <IgGGlyph
        leftColor={custom ?? unitColors[0] ?? antibodyColors[0]}
        rightColor={unitColors[1] ?? custom ?? unitColors[0] ?? antibodyColors[0]}
        withFc={architecture.fc}
        hasPayload={adcLike}
        label={label}
        showLabels={model?.displayLevel === 'full'}
        extraColors={unitColors.slice(2)}
      />
    )
  }
  if (template === 'fab') return <FabGlyph color={custom ?? antibodyColors[0]} label="Fab structural representation" />
  if (['igg', 'bispecific_igg', 'asymmetric_bispecific', 'fab2'].includes(template)) {
    const left = domains.find((domain) => /fab.?1/i.test(domain.label))
    const right = domains.find((domain) => /fab.?2/i.test(domain.label))
    const fc = domains.find((domain) => /^fc$/i.test(domain.label))
    const bispecific = template !== 'igg'
    return (
      <IgGGlyph
        leftColor={custom ?? antibodyColors[0]}
        rightColor={bispecific ? antibodyColors[1] : custom ?? antibodyColors[0]}
        withFc={template !== 'fab2'}
        hasPayload={adcLike}
        label={`${template} structural representation`}
        showLabels={model?.displayLevel === 'full'}
        leftOpacity={opacity(left?.id)}
        rightOpacity={opacity(right?.id)}
        fcOpacity={opacity(fc?.id)}
      />
    )
  }

  // 4. Optional AlphaFold C-alpha trace when full structure display is enabled
  const trace = model?.structureTrace
  if (model?.displayLevel === 'full' && trace?.points && trace.points.length > 1) {
    return (
      <svg
        className="structure-glyph protein-structure-trace"
        viewBox="0 0 72 64"
        role="img"
        aria-label={`${data.label} actual AlphaFold structure, mean confidence ${Math.round(trace.meanConfidence ?? 0)} pLDDT`}
      >
        <title>{`${data.label} · ${trace.source} ${trace.modelId} · mean ${Math.round(trace.meanConfidence ?? 0)} pLDDT`}</title>
        <g className="protein-trace-shadow">
          {trace.points.slice(1).map((point, index) => (
            <line key={`shadow-${index}`} x1={trace.points[index][0]} y1={trace.points[index][1]} x2={point[0]} y2={point[1]} />
          ))}
        </g>
        <g>
          {trace.points.slice(1).map((point, index) => (
            <line
              key={index}
              className="protein-trace-segment"
              style={{ stroke: confidenceColor((trace.points[index][2] + point[2]) / 2) }}
              x1={trace.points[index][0]}
              y1={trace.points[index][1]}
              x2={point[0]}
              y2={point[1]}
            />
          ))}
        </g>
        <text className="structure-source-badge" x="69" y="61" textAnchor="end">AF</text>
      </svg>
    )
  }

  const membrane = data.membraneAnchor ? null : (
    <>
      <path className="membrane-line" d="M4 38h64" />
      <path className="membrane-line" d="M4 43h64" />
    </>
  )

  // 5. Single-pass & Complex Membrane Receptors (PD-1, PD-L1, TCR/CD3, IL-18Ra/b, EGFR, HER2)
  if (template === 'single_pass_receptor' || template === 'receptor_complex') {
    const isTcr = /TCR|CD3/.test(labelUpper)
    const isCytokineR = /IL-?18R|IL-?2R|IL-?6R|GP130|IFNGR/.test(labelUpper) || template === 'receptor_complex'
    const mainColor = custom ?? (isTcr ? '#0d9488' : /PD-?L1|TUMOR|HER2|EGFR/.test(labelUpper) ? '#e05d5d' : isCytokineR ? '#2589bd' : '#2a8c6f')
    const darkColor = isTcr ? '#115e59' : /PD-?L1|TUMOR|HER2|EGFR/.test(labelUpper) ? '#991b1b' : isCytokineR ? '#1e4e79' : '#1b5745'
    const tm = domains.find((domain) => domain.kind === 'transmembrane')
    const intracellular = domains.find((domain) => domain.kind === 'intracellular')

    return (
      <svg className="structure-glyph receptor-structure" viewBox="0 0 72 64" aria-label={`${template} structural representation`}>
        {membrane}
        {isTcr ? (
          /* TCR alpha/beta heterodimer + flanking CD3 subunits */
          <g>
            {/* CD3 flanking dimers */}
            <rect x="13" y="24" width="7" height="22" rx="3.5" fill="#64748b" stroke="#334155" strokeWidth="1.2" />
            <rect x="52" y="24" width="7" height="22" rx="3.5" fill="#64748b" stroke="#334155" strokeWidth="1.2" />
            {/* TCR alpha / beta chains */}
            <rect x="26" y="33" width="7" height="16" rx="3.5" fill="#5eead4" stroke={darkColor} strokeWidth="1.4" />
            <rect x="39" y="33" width="7" height="16" rx="3.5" fill="#5eead4" stroke={darkColor} strokeWidth="1.4" />
            <path d="M23 11 C23 6, 34 6, 34 14 V32 H23 Z" fill={mainColor} stroke={darkColor} strokeWidth="1.5" />
            <path d="M38 11 C38 6, 49 6, 49 14 V32 H38 Z" fill="#14b8a6" stroke={darkColor} strokeWidth="1.5" />
            {/* ITAM cytoplasmic tails */}
            <path d="M16.5 46 V57 M29.5 49 V59 M42.5 49 V59 M55.5 46 V57" stroke={darkColor} strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="27" cy="15" rx="2" ry="5" fill="rgba(255,255,255,0.4)" />
          </g>
        ) : isCytokineR ? (
          /* Curved Cytokine Receptor Cradle (IL-18Ra / IL-18Rb / Heterodimer) */
          <g>
            {(template === 'receptor_complex' ? [26, 46] : [36]).map((cx, idx) => {
              const shade = idx === 1 ? '#38a3a5' : mainColor
              return (
                <g key={cx}>
                  {/* Transmembrane helix */}
                  <rect className="domain-tm" style={{ opacity: opacity(tm?.id) }} x={cx - 4} y="33" width="8" height="15" rx="4" fill="#94a3b8" stroke={darkColor} strokeWidth="1.4" />
                  {/* D3 + D2 + curved D1 cytokine-binding cradle */}
                  <rect className="domain-ecd" x={cx - 6.5} y="22" width="13" height="11" rx="5.5" fill={shade} stroke={darkColor} strokeWidth="1.5" />
                  <path
                    className="domain-ecd"
                    d={`M${cx - 9} 22 C${cx - 11} 10, ${cx - 5} 5, ${cx} 9 C${cx + 5} 5, ${cx + 11} 10, ${cx + 9} 22 Z`}
                    fill={shade}
                    stroke={darkColor}
                    strokeWidth="1.5"
                  />
                  <ellipse cx={cx - 3.5} cy="15" rx="2.2" ry="4.5" fill="rgba(255,255,255,0.42)" />
                  {/* Cytoplasmic TIR / Box1 domain */}
                  <rect
                    className="domain-icd"
                    style={{ opacity: opacity(intracellular?.id) }}
                    x={cx - 5.5}
                    y="48"
                    width="11"
                    height="12"
                    rx="5"
                    fill={shade}
                    fillOpacity="0.72"
                    stroke={darkColor}
                    strokeWidth="1.4"
                  />
                </g>
              )
            })}
          </g>
        ) : (
          /* Canonical Ig-superfamily Checkpoint / Single-pass Receptor (PD-1, PD-L1, CD28, EGFR) */
          <g>
            {/* Transmembrane alpha-helix cylinder */}
            <rect className="domain-tm" style={{ opacity: opacity(tm?.id) }} x="31.5" y="33" width="9" height="15" rx="4.5" fill="#94a3b8" stroke={darkColor} strokeWidth="1.5" />
            {/* Stalk */}
            <line x1="36" y1="28" x2="36" y2="34" stroke={darkColor} strokeWidth="2.6" />
            {/* Cup-shaped IgV Extracellular Binding Domain */}
            <path
              className="domain-ecd"
              d="M23 14 C23 7, 30 6, 33 11 C35 13.5, 37 13.5, 39 11 C42 6, 49 7, 49 14 C49 23, 43 29, 36 29 C29 29, 23 23, 23 14 Z"
              fill={mainColor}
              stroke={darkColor}
              strokeWidth="1.6"
            />
            <ellipse cx="29.5" cy="17" rx="2.8" ry="5.5" fill="rgba(255,255,255,0.42)" />
            {/* Intracellular ITIM / Kinase signaling tail */}
            <path
              className="domain-icd"
              style={{ opacity: opacity(intracellular?.id) }}
              d="M36 48 V58 M31 53 H41 M32 58 H40"
              stroke={darkColor}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
        )}
        {phospho && <PhosphoBadge x={55} y={53} />}
        {model?.displayLevel === 'full' && (
          <>
            <text x="52" y="16">ECD</text>
            <text x="48" y="44">TM</text>
            <text x="48" y="60">ICD</text>
          </>
        )}
      </svg>
    )
  }

  // 6. Multi-pass, GPCR (7TM), Ion Channel
  if (template === 'multi_pass_receptor' || template === 'gpcr' || template === 'ion_channel') {
    const count = template === 'gpcr' ? 7 : template === 'ion_channel' ? 4 : 5
    const xs = Array.from({ length: count }, (_, index) => 15 + index * (42 / Math.max(1, count - 1)))
    const barrelColor = custom ?? (template === 'ion_channel' ? '#0891b2' : '#0d9488')
    return (
      <svg className={`structure-glyph receptor-structure ${template}`} viewBox="0 0 72 64" aria-label={`${template} structural representation`}>
        {membrane}
        <path
          className="multipass-loop extracellular-loop"
          d={xs.slice(1).map((x, index) => `M${xs[index]} ${index % 2 ? 31 : 28} Q${(xs[index] + x) / 2} ${index % 2 ? 17 : 21} ${x} ${index % 2 ? 28 : 31}`).join(' ')}
          fill="none"
          stroke="#115e59"
          strokeWidth="1.8"
        />
        <path
          className="multipass-loop intracellular-loop"
          d={xs.slice(1).map((x, index) => `M${xs[index]} ${index % 2 ? 49 : 51} Q${(xs[index] + x) / 2} ${index % 2 ? 60 : 57} ${x} ${index % 2 ? 51 : 49}`).join(' ')}
          fill="none"
          stroke="#115e59"
          strokeWidth="1.8"
        />
        {xs.map((x, index) => (
          <g key={x}>
            <rect className="domain-tm helix" x={x - 3} y={index % 2 ? 29 : 27} width="6" height="23" rx="3" fill={barrelColor} stroke="#134e4a" strokeWidth="1.3" />
            <line x1={x - 1} y1={index % 2 ? 32 : 30} x2={x - 1} y2={index % 2 ? 48 : 46} stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        ))}
        {template === 'ion_channel' && <path className="ion-pore" d="M33 25 v28 M39 25 v28" stroke="#67e8f9" strokeWidth="1.8" strokeDasharray="3 2" />}
      </svg>
    )
  }

  // 7. Fc-Fusion / Cytokine Receptor Trap (e.g. IL-18BP / Etanercept / Aflibercept)
  if (template === 'fc_fusion' || template === 'receptor_trap') {
    const trapColor = custom ?? '#0ea5e9'
    return (
      <svg className="structure-glyph fusion-structure" viewBox="0 0 72 64" aria-label={`${template} structural representation`}>
        {/* Top Fc dimer */}
        <rect x="27" y="5" width="8" height="19" rx="4" fill="#9d8ec4" stroke="#48386e" strokeWidth="1.4" />
        <rect x="37" y="5" width="8" height="19" rx="4" fill="#9d8ec4" stroke="#48386e" strokeWidth="1.4" />
        <line x1="30" y1="26" x2="42" y2="26" stroke="#d97706" strokeWidth="1.5" />
        {/* Linkers to receptor trap jaws */}
        <path d="M31 24 L21 35 M41 24 L51 35" stroke="#48386e" strokeWidth="2" strokeLinecap="round" />
        {/* Capturing ectodomain jaws facing down */}
        <path d="M13 34 C11 46, 19 57, 28 54 C24 47, 23 40, 25 34 Z" fill={trapColor} stroke="#0369a1" strokeWidth="1.6" />
        <path d="M59 34 C61 46, 53 57, 44 54 C48 47, 49 40, 47 34 Z" fill={trapColor} stroke="#0369a1" strokeWidth="1.6" />
      </svg>
    )
  }

  // 8. Secreted Cytokines & Ligands (IL-18, IL-2, IFN-g, TNF-a, pMHC, Granzyme)
  if (template === 'cytokine' || data.kind === 'ligand') {
    if (/PMHC|MHC/.test(labelUpper)) {
      return (
        <svg className="structure-glyph cytokine-structure pmhc-structure" viewBox="0 0 72 64" aria-label="pMHC structural representation">
          <rect x="28" y="10" width="16" height="20" rx="5" fill="#f59e0b" stroke="#92400e" strokeWidth="1.5" />
          <path d="M22 28 H50 V42 C50 48, 43 50, 36 44 C29 50, 22 48, 22 42 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />
          {/* Presented antigenic peptide sphere */}
          <circle cx="36" cy="50" r="5" fill="#ef4444" stroke="#991b1b" strokeWidth="1.4" />
          <circle cx="34.5" cy="48.5" r="1.5" fill="rgba(255,255,255,0.55)" />
        </svg>
      )
    }
    const cytoColor =
      custom ??
      (/IFN|IL-?2\b/.test(labelUpper)
        ? '#14b8a6'
        : /TNF|GRANZYME|PERFORIN/.test(labelUpper)
          ? '#f43f5e'
          : '#f59e0b')
    const cytoStroke =
      /IFN|IL-?2\b/.test(labelUpper)
        ? '#0f766e'
        : /TNF|GRANZYME|PERFORIN/.test(labelUpper)
          ? '#9f1239'
          : '#b45309'
    return (
      <svg className="structure-glyph cytokine-structure" viewBox="0 0 72 64" aria-label="cytokine structural representation">
        <defs>
          <radialGradient id={`${uidPrefix}-cyto`} cx="38%" cy="34%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="38%" stopColor={cytoColor} />
            <stop offset="100%" stopColor={cytoStroke} />
          </radialGradient>
        </defs>
        {/* Subtle secreted halo + satellite cytokine spheres */}
        <circle cx="36" cy="34" r="22" fill={cytoColor} fillOpacity="0.13" />
        <circle cx="15" cy="20" r="4.2" fill={cytoColor} fillOpacity="0.75" stroke={cytoStroke} strokeWidth="1.1" />
        <circle cx="57" cy="23" r="3.4" fill={cytoColor} fillOpacity="0.68" stroke={cytoStroke} strokeWidth="1.1" />
        {/* Main 3D trefoil / helical bundle sphere */}
        <circle cx="36" cy="35" r="15.5" fill={`url(#${uidPrefix}-cyto)`} stroke={cytoStroke} strokeWidth="1.6" />
        <path className="protein-fold" d="M27 33 C32 26, 40 42, 45 33" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  // 9. Enzymes & Generic Soluble Globular Proteins
  const blobColor = custom ?? (template === 'enzyme' ? '#ec4899' : '#10b981')
  const blobStroke = template === 'enzyme' ? '#9d174d' : '#065f46'
  return (
    <svg className="structure-glyph soluble-structure" viewBox="0 0 72 64" aria-label={`${template} structural representation`}>
      <path
        className="protein-blob"
        d="M17 33c-6-9 2-20 12-17 6-10 21-4 20 6 12 1 14 17 4 22-5 11-20 9-24 3-11 4-19-5-12-14Z"
        fill={blobColor}
        fillOpacity="0.85"
        stroke={blobStroke}
        strokeWidth="1.7"
      />
      <ellipse cx="29" cy="24" rx="7" ry="3.5" fill="rgba(255,255,255,0.4)" />
      {template === 'enzyme' && <path className="enzyme-cleft" d="M40 16c-7 7-8 15 1 20 7 4 7 11 2 16" fill="none" stroke="#ffffff" strokeWidth="2" />}
      {phospho && <PhosphoBadge x={56} y={17} />}
    </svg>
  )
}
