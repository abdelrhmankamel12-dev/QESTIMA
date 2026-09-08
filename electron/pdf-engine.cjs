"use strict"

// PDF capability adapter used by the Electron shell.  Poppler and Tesseract
// are intentionally external executables (their licenses and language packs
// vary by deployment); this module normalises their output into one auditable
// contract and never fabricates text when an engine is unavailable.

function parsePdfInfo(text) {
  const metadata = {}
  String(text || "").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([^:]+):\s*(.*?)\s*$/)
    if (match) metadata[match[1].trim()] = match[2]
  })
  return metadata
}

function normalisePages(pages = [], pageCount = 0) {
  const result = (Array.isArray(pages) ? pages : []).map((page, index) => ({ page: Math.max(1, Number(page?.page || index + 1)), text: String(page?.text || "").trim() })).filter((page) => page.text)
  const count = Math.max(0, Number(pageCount) || 0)
  return { pages: result, pageCount: Math.max(count, result.reduce((max, page) => Math.max(max, page.page), 0)) }
}

function classifyExtraction(input = {}) {
  const text = normalisePages(input.pages || [], input.pageCount)
  const ocr = normalisePages(input.ocrPages || [], text.pageCount)
  const textLength = text.pages.reduce((sum, page) => sum + page.text.length, 0)
  const ocrLength = ocr.pages.reduce((sum, page) => sum + page.text.length, 0)
  if (textLength >= Math.max(40, Number(input.minimumCharacters || 40))) return { ok: true, kind: "text", method: String(input.textMethod || "pdftotext"), ...text, warnings: [] }
  if (ocrLength) return { ok: true, kind: "ocr", method: String(input.ocrMethod || "pdftoppm+tesseract"), pages: ocr.pages, pageCount: Math.max(text.pageCount, ocr.pageCount), warnings: [...(input.warnings || [])] }
  return { ok: false, reason: "PDF_TEXT_UNAVAILABLE", kind: "scanned_or_image", method: "unavailable", pages: [], pageCount: text.pageCount, warnings: [...(input.warnings || []), "No extractable PDF text was returned by the configured engines."] }
}

function searchPages(pages = [], query = "", limit = 20) {
  const needle = String(query || "").trim().toLowerCase()
  if (!needle) return []
  return pages.filter((page) => String(page.text || "").toLowerCase().includes(needle)).slice(0, Math.max(1, Math.min(100, Number(limit) || 20))).map((page) => ({ page: page.page, excerpt: String(page.text).slice(0, 500) }))
}

module.exports = { parsePdfInfo, normalisePages, classifyExtraction, searchPages }
