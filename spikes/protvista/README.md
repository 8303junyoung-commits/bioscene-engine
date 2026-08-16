# ProtVista spike

The spike is integrated into the production Protein & Construct Setup dialog instead of living on a disconnected demo route.

- Wrapper: `src/integrations/protvista/ProtVistaPanel.tsx`
- Provider boundary: `src/integrations/uniprot/UniProtProvider.ts`
- Dependency: `protvista-uniprot@4.9.1` (MIT)
- Scope: annotation reference viewer only; structure track disabled
- Persistence: explicit feature selection becomes a BioScene `DomainDefinition`
- Non-persisted state: viewer zoom, filters, category expansion, tooltips, raw component data

Manual smoke test:

1. Open Protein & Construct Setup.
2. Select or create a public natural protein and complete UniProt lookup, or enter a valid public UniProt accession in the optional field.
3. In **2 · Structure**, open **ProtVista annotation reference**.
4. Select a track feature, or select a normalized UniProt feature from the Domain bridge.
5. Click **Add as BioScene domain** and confirm that the new domain appears in **3 · Function** with UniProt provenance.
6. Verify that a private/proprietary molecule does not expose public lookup.

