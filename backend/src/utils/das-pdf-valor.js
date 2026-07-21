/**
 * Tenta extrair o valor total do DAS a partir do PDF (texto embutido).
 * Útil no extrato CONSEXTRATO16, onde a API não devolve o valor estruturado.
 */

const parseBrMoney = (raw) => {
  const s = String(raw || '').trim().replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * @param {string|null|undefined} pdfBase64
 * @returns {number|null}
 */
export const tryExtractDasTotalFromPdfBase64 = (pdfBase64) => {
  if (!pdfBase64 || typeof pdfBase64 !== 'string') return null
  let text = ''
  try {
    text = Buffer.from(pdfBase64.replace(/\s/g, ''), 'base64').toString('latin1')
  } catch {
    return null
  }
  if (!text.includes('%PDF')) return null

  // Preferência: linha "Principal … Total 328,41" do extrato PGDAS-D
  const patterns = [
    /Principal\s+[\d.,]+\s+Multa\s+[\d.,]+\s+Juros\s+[\d.,]+\s+Total\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    /Total\s+do\s+D[ée]bito\s+Exig[ií]vel[\s\S]{0,200}?Total\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    /Valor\s+Pago\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    /(?:^|\D)Total\s+(\d{1,3}(?:\.\d{3})*,\d{2})(?:\D|$)/im,
  ]

  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const n = parseBrMoney(m[1])
      if (n !== null && n > 0) return n
    }
  }

  // Streams de texto PDF: "(328,41)" perto de "Total"
  const streamHits = [...text.matchAll(/\((Total)\)[\s\S]{0,80}\((\d{1,3}(?:\.\d{3})*,\d{2})\)/gi)]
  for (const m of streamHits) {
    const n = parseBrMoney(m[2])
    if (n !== null && n > 0) return n
  }

  return null
}
