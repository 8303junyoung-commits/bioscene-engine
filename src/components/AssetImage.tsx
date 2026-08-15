import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { safeAssetFile } from '../assetRegistry'

function fileCandidates(file: string) {
  const candidates = [
    file,
    file.replaceAll('Simon_Dürr', 'Simon_Durr').replaceAll('Cléber-Gomes', 'Cleber-Gomes').replaceAll('Ana-Viñuela', 'Ana-Vinuela').replaceAll('/KeHan/', '/kehan/'),
    file.replaceAll('Simon_Durr', 'Simon_Dürr').replaceAll('Cleber-Gomes', 'Cléber-Gomes').replaceAll('Ana-Vinuela', 'Ana-Viñuela').replaceAll('/kehan/', '/KeHan/'),
  ]
  return Array.from(new Set(candidates)).flatMap((item) => safeAssetFile(item) ? [item] : [])
}

export function AssetImage({ file, alt, className, fallback }: { file: string; alt: string; className?: string; fallback: ReactNode }) {
  const candidates = useMemo(() => fileCandidates(file), [file])
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [file])
  if (!candidates[index]) return <>{fallback}</>
  return <img className={className} src={`/assets/bioicons-library/${candidates[index]}`} alt={alt} onError={() => setIndex((current) => current + 1)} />
}
