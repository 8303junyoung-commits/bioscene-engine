import type { BioEdge, BioNode } from './types'

export function blueprintRelationship(edge: BioEdge, nodes: BioNode[], edges: BioEdge[]) {
  const label = (id: string) => nodes.find(node => node.id === id)?.data.label ?? id
  const blocked = edges.find(item => item.id === edge.data?.blockedEdgeId)
  const target = blocked ? `[${label(blocked.source)} ${blocked.data?.interaction} ${label(blocked.target)}]` : label(edge.target)
  return `${label(edge.source)} ${edge.data?.indirect ? 'INDIRECT' : edge.data?.interaction} ${target}`
}

/** Refuse to capture a scene whose expected BLOCK geometry is missing. */
export function assertVisibleBlocksForCapture(root: HTMLElement, expectedIds: string[]) {
  const groups = Array.from(root.querySelectorAll('.react-flow__edge'))
  for (const id of expectedIds) {
    const group = groups.find(element => element.getAttribute('data-id') === id)
    const path = group?.querySelector<SVGPathElement>('.react-flow__edge-path')
    const bar = group?.querySelector<SVGPathElement>('.inhibition-mark')
    const paint = path && getComputedStyle(path)
    if (!path || !bar || !path.getAttribute('marker-end')?.includes(`inhibitory-${id}`) || !Number.isFinite(path.getTotalLength()) || path.getTotalLength() < 1 || paint?.display === 'none' || paint?.visibility === 'hidden' || paint?.stroke === 'none' || Number(paint?.opacity) === 0) {
      throw new Error('BLOCK relationship is not visible. Export stopped to preserve inhibition semantics.')
    }
  }
}

/** html-to-image 1.11.13 does not copy all descendant SVG CSS.
 * Freeze paint during capture, restoring the live DOM afterward; keep marker
 * URLs as local #fragments so the downloaded SVG remains portable.
 */
export function inlineSvgPaintForCapture(root:HTMLElement) {
  const properties=['fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','display','visibility','font-size','font-family','font-weight','text-anchor','paint-order','vector-effect']
  const snapshots=Array.from(root.querySelectorAll<SVGElement>('svg *')).map(element=>({element,style:element.getAttribute('style'),paint:properties.map(key=>[key,getComputedStyle(element).getPropertyValue(key)] as const)}))
  for(const {element,paint} of snapshots)for(const [key,value] of paint){
    const normalized = value.includes('url(') ? value.replace(/url\(["']?[^)"']*#([^)"']+)["']?\)/g, 'url(#$1)') : value
    element.style.setProperty(key,normalized)
  }
  return ()=>{for(const {element,style} of snapshots){if(style===null)element.removeAttribute('style');else element.setAttribute('style',style)}}
}
