import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { bindManifestAsset, metadataFor, normalized, safeAssetFile, searchText, type ManifestAsset } from '../assetRegistry'
import type { AssetReference, BioNode } from '../types'

interface Manifest { assets: ManifestAsset[]; countsByCategory: Record<string, number> }

export function SmartAssetBrowser({ selectedNode, onClose, onAttach }: { selectedNode?: BioNode; onClose: () => void; onAttach: (asset: AssetReference) => void }) {
  const [manifest, setManifest] = useState<Manifest>()
  const [query, setQuery] = useState(selectedNode?.data.label ?? '')
  const [category, setCategory] = useState('all')
  const [license, setLicense] = useState('all')
  const [error, setError] = useState('')

  useEffect(() => { fetch('/assets/bioicons-library/manifest.json').then(async (response) => { if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Manifest missing'); const value = await response.json(); if (!value || !Array.isArray(value.assets) || typeof value.countsByCategory !== 'object') throw new Error('Manifest invalid'); return value as Manifest }).then(setManifest).catch(() => setError('Asset index could not be loaded. Install the Bioicons asset package or configure its CDN.')) }, [])
  const semantic = metadataFor(selectedNode?.data.label ?? '', selectedNode?.data.kind ?? 'cell')
  const terms = normalized(`${query} ${semantic.synonyms.join(' ')}`)
  const assets = useMemo(() => (manifest?.assets ?? []).filter((asset) => {
    if (category !== 'all' && asset.category !== category) return false
    if (license !== 'all' && asset.license.spdx !== license) return false
    if (!query.trim()) return true
    const haystack = searchText(asset)
    return normalized(query).split(/\s+/).some((term) => haystack.includes(term)) || semantic.synonyms.some((term) => haystack.includes(normalized(term))) || terms.includes(normalized(asset.name))
  }).slice(0, 120), [category, license, manifest, query, semantic.synonyms, terms])
  const licenses = Array.from(new Set((manifest?.assets ?? []).map((asset) => asset.license.spdx))).sort()

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Smart asset bank">
    <section className="asset-browser">
      <header><div><span className="eyebrow">PHASE 5 · SMART ASSET BANK</span><h2>Search {manifest?.assets.length?.toLocaleString() ?? 'licensed'} SVGs</h2><p>{selectedNode ? <>Binding to <strong>{selectedNode.data.label}</strong> · {selectedNode.data.kind}</> : 'Select a semantic object before binding an asset.'}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
      <div className="asset-search-row" data-help="이름·생물학적 동의어·저자·카테고리로 검색하고, 분야와 라이선스로 좁힐 수 있습니다. 현재 선택한 개체의 이름과 종류에 맞는 동의어도 자동으로 검색에 포함됩니다."><label className="asset-search"><Search size={16} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, synonym, author, category…" /></label><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option>{Object.keys(manifest?.countsByCategory ?? {}).map((item) => <option key={item}>{item}</option>)}</select><select value={license} onChange={(e) => setLicense(e.target.value)}><option value="all">All licenses</option>{licenses.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="semantic-hints"><span>Synonyms</span>{semantic.synonyms.slice(0, 6).map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}{semantic.identifiers.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer">{item.database}:{item.id}</a>)}</div>
      {error && <p>{error}</p>}
      <div className="asset-results-meta">Showing {assets.length}{(manifest?.assets.length ?? 0) > 120 ? ' matched results (max 120)' : ' results'}</div>
      <div className="asset-grid">{assets.map((asset) => <article key={asset.id} className="asset-card"><div className="asset-preview"><img loading="lazy" src={`/assets/bioicons-library/${safeAssetFile(asset.file) ?? ''}`} alt={asset.name} onError={(event) => { event.currentTarget.style.display = 'none' }} /></div><strong title={asset.name}>{asset.name}</strong><small>{asset.category.replaceAll('_', ' ')} · {asset.author}</small><footer><span>{asset.license.spdx}</span><button data-help="이 SVG를 현재 선택한 개체의 시각 에셋으로 연결합니다. 의미·상태·연결 포트는 바뀌지 않으며 저자와 라이선스 정보가 자동 저장됩니다." disabled={!selectedNode} onClick={() => selectedNode && onAttach(bindManifestAsset(asset, selectedNode.data.label, selectedNode.data.kind))}>Attach</button></footer></article>)}</div>
    </section>
  </div>
}
