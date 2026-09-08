(function () {
  "use strict"
  let library
  const cache = new Map()
  async function load(attachmentId) {
    if (cache.has(attachmentId)) return cache.get(attachmentId)
    library ||= await import("./vendor/pdfjs/pdf.min.mjs")
    library.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.min.mjs", location.href).href
    const base64 = await window.qestimaDesktop.readPdfBytes(attachmentId)
    const data = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    const task = library.getDocument({ data, isEvalSupported: false, useSystemFonts: true })
    const doc = await task.promise
    cache.set(attachmentId, doc)
    if (cache.size > 2) { const oldest = cache.keys().next().value; const old = cache.get(oldest); cache.delete(oldest); await old.destroy() }
    return doc
  }
  window.QESTIMAPdf = {
    async render(attachmentId, pageNumber) {
      const doc = await load(attachmentId)
      const number = Math.max(1, Math.min(doc.numPages, pageNumber))
      const page = await doc.getPage(number)
      const viewport = page.getViewport({ scale: 2 })
      if (viewport.width * viewport.height > 25000000) throw new Error("صفحة كبيرة جدًا للعرض عند 144 DPI؛ صدّر صفحة أصغر للقياس")
      const canvas = document.createElement("canvas")
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise
      return { ok: true, page: number, pageCount: doc.numPages, dataUrl: canvas.toDataURL("image/png"), method: "pdfjs-bundled" }
    },
    async extract(attachmentId, progress = () => {}, signal) {
      const doc = await load(attachmentId)
      const pages = []
      for (let number = 1; number <= doc.numPages; number++) {
        if (signal?.aborted) throw new Error("تم إلغاء القراءة")
        const page = await doc.getPage(number)
        const content = await page.getTextContent()
        const text = content.items.map((item) => item.str + (item.hasEOL ? "\n" : " ")).join("")
        pages.push({ page: number, text })
        progress(number, doc.numPages)
      }
      const hasText = pages.some((page) => page.text.trim())
      return { ok: hasText, pages, pageCount: doc.numPages, kind: hasText ? "text" : "scanned_or_image", method: "pdfjs-bundled", warnings: hasText ? [] : ["الملف مصور؛ يحتاج محرك OCR منفصلًا."] }
    }
  }
})()
