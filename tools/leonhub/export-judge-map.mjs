#!/usr/bin/env node
// Exporter LeonHub -> semantic-map (mqc-timeline-master).
// Legge il derivato comafim_judge (sola lettura, originali mai toccati) e
// produce una mappa dated_point_timeline a lato singolo per il rendering A4.
//
// Uso:
//   node tools/leonhub/export-judge-map.mjs <comafim-judge-evidence-pipeline.json> <out-map.json>
import { readFileSync, writeFileSync } from 'node:fs'

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath) {
  console.error('uso: export-judge-map.mjs <judge-pipeline.json> <out-map.json>')
  process.exit(2)
}

const sanitize = (s) => String(s || '')
  .normalize('NFC')
  .replace(/\uFB00/g, 'ff').replace(/\uFB01/g, 'fi').replace(/\uFB02/g, 'fl')
  .replace(/\uFB03/g, 'ffi').replace(/\uFB04/g, 'ffl')
  .replace(/\s+/g, ' ')
  .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
  .replace(/[\u2013\u2014\u2015]/g, '-')
  .trim()

const state = JSON.parse(readFileSync(inputPath, 'utf8'))
const caseData = Object.values(state.cases || {})[0]
if (!caseData?.documents?.length) {
  console.error('nessun documento nel derivato judge')
  process.exit(2)
}

const toYmd = (iso) => {
  const [y, m, d] = String(iso).split('-')
  return `${Number(y)}/${Number(m)}/${Number(d)}`
}
const toDotText = (iso) => {
  const [y, m, d] = String(iso).split('-')
  return `${d}.${m}.${y}`
}

const documents = caseData.documents
  .filter((d) => d.document_date)
  .sort((a, b) => a.document_date.localeCompare(b.document_date))

const events = documents.map((d, i) => {
  const text = sanitize(d.text).slice(0, 180)
  const pages = d.source_page_start === d.source_page_end
    ? `page:${d.source_page_start}`
    : `page:${d.source_page_start}-${d.source_page_end}`
  return {
    id: String(i + 1),
    unit_type: 'event',
    quote_depth: 0,
    time: {
      certainty: 'exact',
      origin: 'extracted',
      kind: 'record',
      raw: toDotText(d.document_date),
      date: toYmd(d.document_date),
      date_text: toDotText(d.document_date),
    },
    head: sanitize(d.title).slice(0, 58),
    body: text.slice(0, 70) || sanitize(d.title),
    source: {
      file: 'giudice_pace.pdf',
      at: pages,
      medium: String(d.text_status || '').startsWith('extracted_ocr') ? 'image' : 'text_layer',
      quote: text.slice(0, 120),
    },
    index_note: `${d.attachment_label || 'allegato'} · prodotto da ${d.produced_by || 'Comafim SA'} · depositato il ${d.filed_at} · hash ${String(d.segment_hash).slice(0, 12)}`,
    head_short: sanitize(d.title).split(' ').slice(0, 4).join(' ').slice(0, 24),
  }
})

const map = {
  schema_version: 2,
  diagram_type: 'timeline',
  title_text: 'Produzione Comafim al Giudice di pace · cronologia documenti',
  layout: 'dated_point_timeline',
  medium: 'a4_portrait',
  axis: { mode: 'proportional_year', unit: 'year' },
  documents: [{
    file: 'giudice_pace.pdf',
    kind: 'fascicolo di produzione Comafim',
    unit_kind: 'page',
    units: 28,
    events_found: events.length,
  }],
  scope: { mode: 'full', selection_source: 'default' },
  events,
  provenance: {
    text_policy: 'verbatim-condensed',
    note: `Derivato LeonHub comafim_judge, pratica ${caseData.practice_id}, pacchetto SHA-256 ${String(caseData.packages?.[0]?.hash || documents[0]?.source_package_hash || '').slice(0, 16)}. Date dai derivati verificati (intestazione documento); produzione unica, lato singolo.`,
  },
  checkpoint: { confirmed: true, extraction_confirmed: true, emphasis_source: 'user' },
}

writeFileSync(outputPath, JSON.stringify(map, null, 2))
console.log(`eventi: ${events.length} -> ${outputPath}`)
console.log('range:', documents[0].document_date, '->', documents[documents.length - 1].document_date)
