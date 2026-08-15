import type { MembranePoint } from './types'

const distance = (a: MembranePoint, b: MembranePoint) => Math.hypot(a.x - b.x, a.y - b.y)
const pointLineDistance = (point: MembranePoint, start: MembranePoint, end: MembranePoint) => {
  const lengthSquared = (end.x-start.x) ** 2 + (end.y-start.y) ** 2
  if (!lengthSquared) return distance(point,start)
  const t = Math.max(0,Math.min(1,((point.x-start.x)*(end.x-start.x)+(point.y-start.y)*(end.y-start.y))/lengthSquared))
  return distance(point,{x:start.x+t*(end.x-start.x),y:start.y+t*(end.y-start.y)})
}

export function simplifyPoints(points: MembranePoint[], tolerance = 4): MembranePoint[] {
  if (points.length <= 2) return points
  let maximum = 0, index = 0
  for (let i=1;i<points.length-1;i++) { const value=pointLineDistance(points[i],points[0],points.at(-1)!); if(value>maximum){maximum=value;index=i} }
  if (maximum <= tolerance) return [points[0],points.at(-1)!]
  return [...simplifyPoints(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyPoints(points.slice(index),tolerance)]
}

export function smoothMembranePoints(points: MembranePoint[], strength = .55) {
  let result = simplifyPoints(points,Math.max(2,7-strength*5))
  const passes = Math.max(0,Math.min(3,Math.round(strength*3)))
  for(let pass=0;pass<passes;pass++){
    if(result.length<3) break
    const next=[result[0]]
    for(let i=0;i<result.length-1;i++){
      const a=result[i],b=result[i+1]
      next.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25},{x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75})
    }
    next.push(result.at(-1)!);result=next
  }
  return result
}

export function membranePathD(points: MembranePoint[]) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  let value=`M ${points[0].x} ${points[0].y}`
  for(let i=1;i<points.length-1;i++){const mid={x:(points[i].x+points[i+1].x)/2,y:(points[i].y+points[i+1].y)/2};value+=` Q ${points[i].x} ${points[i].y} ${mid.x} ${mid.y}`}
  const last=points.at(-1)!;return `${value} T ${last.x} ${last.y}`
}

export function pathPointAt(points: MembranePoint[], pathPosition: number) {
  if (points.length < 2) return { point: points[0] ?? {x:0,y:0}, angle: 0 }
  const segments=points.slice(1).map((point,index)=>distance(points[index],point));const total=segments.reduce((sum,value)=>sum+value,0)
  let remaining=Math.max(0,Math.min(1,pathPosition))*total
  for(let i=0;i<segments.length;i++){
    if(remaining<=segments[i]||i===segments.length-1){const ratio=segments[i]?remaining/segments[i]:0;const start=points[i],end=points[i+1];return {point:{x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio},angle:Math.atan2(end.y-start.y,end.x-start.x)*180/Math.PI+90}}
    remaining-=segments[i]
  }
  return {point:points.at(-1)!,angle:0}
}

export function nearestPathPoint(points: MembranePoint[], target: MembranePoint) {
  if(points.length<2)return {pathPosition:0,point:points[0]??target,angle:0,distance:Infinity}
  const lengths=points.slice(1).map((point,index)=>distance(points[index],point));const total=lengths.reduce((sum,value)=>sum+value,0);let traversed=0;let best={pathPosition:0,point:points[0],angle:0,distance:Infinity}
  for(let i=0;i<lengths.length;i++){
    const start=points[i],end=points[i+1],length=lengths[i];const lengthSquared=length**2
    const ratio=lengthSquared?Math.max(0,Math.min(1,((target.x-start.x)*(end.x-start.x)+(target.y-start.y)*(end.y-start.y))/lengthSquared)):0
    const point={x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio};const candidate=distance(point,target)
    if(candidate<best.distance)best={pathPosition:total?(traversed+length*ratio)/total:0,point,angle:Math.atan2(end.y-start.y,end.x-start.x)*180/Math.PI+90,distance:candidate}
    traversed+=length
  }
  return best
}
