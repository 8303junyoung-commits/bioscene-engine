import { MarkerType } from '@xyflow/react'
import type { InteractionType } from './types'

export const interactionColors: Record<InteractionType, string> = {
  BIND: '#2b7a66', BLOCK: '#d65c4a', ACTIVATE: '#2f6fdf', INHIBIT: '#9d4968', SIGNAL_ABSENT: '#7b8580', TRANSLOCATE: '#7b5cc4',
  AGONIZE: '#137f76', CLUSTER: '#8b5a2b', PHOSPHORYLATE: '#2563a9', SECRETE: '#008b9a', EXPRESS: '#38823c', INTERNALIZE: '#8055a5',
  DEGRADE: '#8a5a52', CLEAVE: '#b06d21', RECRUIT: '#3c7180', DIMERIZE: '#74612b', COMPETE: '#b24f72',
}
const arrowTypes = new Set<InteractionType>(['ACTIVATE', 'AGONIZE', 'PHOSPHORYLATE', 'TRANSLOCATE', 'SECRETE', 'EXPRESS', 'INTERNALIZE', 'DEGRADE', 'CLEAVE', 'RECRUIT'])
export const markerForInteraction = (interaction: InteractionType) => arrowTypes.has(interaction) ? { type: MarkerType.ArrowClosed, color: interactionColors[interaction] } : undefined
