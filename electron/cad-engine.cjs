"use strict"

// A deliberately small, dependency-free DXF reader.  It is intended for
// auditable takeoff assistance (layers, blocks, lengths, areas and counts),
// not as a replacement for a licensed CAD editor.  Native DWG remains an
// adapter boundary in main.cjs so a customer can supply an approved converter.

const fs = require("node:fs")

const number = (value) => {
  const parsed = Number(String(value ?? "").trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function pairLines(text) {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/)
  const pairs = []
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number(String(lines[index]).trim())
    if (!Number.isFinite(code)) continue
    pairs.push({ code, value: String(lines[index + 1] ?? "").trimEnd() })
  }
  return pairs
}

function parseHeader(pairs) {
  const header = {}
  for (let index = 0; index < pairs.length - 1; index += 1) {
    if (pairs[index].code !== 9) continue
    const key = pairs[index].value
    const value = pairs[index + 1]
    if (key.startsWith("$")) header[key] = value?.value || ""
  }
  return header
}

function sectionPairs(pairs, name) {
  const result = []
  let active = false
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]
    if (pair.code === 0 && pair.value === "SECTION") {
      const next = pairs[index + 1]
      active = next?.code === 2 && next.value.toUpperCase() === name.toUpperCase()
      if (active) index += 1
      continue
    }
    if (active && pair.code === 0 && pair.value === "ENDSEC") break
    if (active) result.push(pair)
  }
  return result
}

function splitEntities(pairs) {
  const entities = []
  let current = null
  for (const pair of pairs) {
    if (pair.code === 0) {
      if (current) entities.push(current)
      current = { type: pair.value.toUpperCase(), pairs: [] }
    } else if (current) current.pairs.push(pair)
  }
  if (current) entities.push(current)
  return entities
}

function values(entity, code) { return entity.pairs.filter((pair) => pair.code === code).map((pair) => pair.value) }
function first(entity, code, fallback = "") { return values(entity, code)[0] ?? fallback }
function point(entity, xCode = 10, yCode = 20, index = 0) { return { x: number(values(entity, xCode)[index]), y: number(values(entity, yCode)[index]) } }
function distance(a, b) { return Math.hypot(number(b.x) - number(a.x), number(b.y) - number(a.y)) }
function angleDelta(start, end) {
  let delta = (number(end) - number(start)) * Math.PI / 180
  while (delta < 0) delta += Math.PI * 2
  return delta || Math.PI * 2
}

function bulgeLength(a, b, bulge) {
  const chord = distance(a, b); const bValue = number(bulge)
  if (!bValue || !chord) return chord
  const theta = 4 * Math.atan(Math.abs(bValue))
  const radius = chord * (1 + bValue ** 2) / (4 * Math.abs(bValue))
  return Math.abs(radius * theta)
}

function polygonArea(points) {
  if (!points || points.length < 3) return 0
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]; const b = points[(index + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return Math.abs(area) / 2
}

function layerName(entity) { return String(first(entity, 8, "0") || "0").trim() || "0" }

function parseLwPolyline(entity) {
  const xs = values(entity, 10).map(number); const ys = values(entity, 20).map(number); const bulges = values(entity, 42).map(number)
  const points = xs.map((x, index) => ({ x, y: ys[index] || 0, bulge: bulges[index] || 0 }))
  const closed = (number(first(entity, 70, 0)) & 1) === 1
  let length = 0
  const last = closed ? points.length : Math.max(0, points.length - 1)
  for (let index = 0; index < last; index += 1) length += bulgeLength(points[index], points[(index + 1) % points.length], points[index].bulge)
  return { points, closed, length, area: closed ? polygonArea(points) : 0, render: { kind: "polyline", points, closed } }
}

function parseClassicPolyline(entity, allEntities) {
  const vertices = []
  const start = allEntities.indexOf(entity)
  for (let index = start + 1; index < allEntities.length; index += 1) {
    const candidate = allEntities[index]
    if (candidate.type === "VERTEX") vertices.push({ ...point(candidate), bulge: number(first(candidate, 42, 0)) })
    else if (candidate.type === "SEQEND") break
    else if (candidate.type !== "VERTEX") break
  }
  const closed = (number(first(entity, 70, 0)) & 1) === 1
  let length = 0
  const last = closed ? vertices.length : Math.max(0, vertices.length - 1)
  for (let index = 0; index < last; index += 1) length += bulgeLength(vertices[index], vertices[(index + 1) % vertices.length], vertices[index].bulge)
  return { points: vertices, closed, length, area: closed ? polygonArea(vertices) : 0, render: { kind: "polyline", points: vertices, closed } }
}

function entityGeometry(entity, allEntities) {
  const type = entity.type
  if (type === "LINE") { const start = point(entity, 10, 20); const end = point(entity, 11, 21); return { length: distance(start, end), area: 0, points: [start, end], render: { kind: "line", start, end } } }
  if (type === "LWPOLYLINE") return parseLwPolyline(entity)
  if (type === "POLYLINE") return parseClassicPolyline(entity, allEntities)
  if (type === "CIRCLE") { const center = point(entity); const radius = Math.abs(number(first(entity, 40))); return { length: 2 * Math.PI * radius, area: Math.PI * radius ** 2, points: [center], render: { kind: "circle", center, radius } } }
  if (type === "ARC") { const center = point(entity); const radius = Math.abs(number(first(entity, 40))); const startAngle = number(first(entity, 50, 0)); const endAngle = number(first(entity, 51, 360)); const start = { x: center.x + radius * Math.cos(startAngle * Math.PI / 180), y: center.y + radius * Math.sin(startAngle * Math.PI / 180) }; const end = { x: center.x + radius * Math.cos(endAngle * Math.PI / 180), y: center.y + radius * Math.sin(endAngle * Math.PI / 180) }; return { length: radius * angleDelta(startAngle, endAngle), area: 0, points: [start, center, end], render: { kind: "arc", center, radius, startAngle, endAngle } } }
  if (type === "ELLIPSE") { const center = point(entity); const majorX = number(first(entity, 11)); const majorY = number(first(entity, 21)); const major = Math.hypot(majorX, majorY); const ratio = Math.abs(number(first(entity, 40))) || 1; const minor = major * ratio; const startParam = number(first(entity, 41, 0)); const endParam = number(first(entity, 42, Math.PI * 2)); return { length: Math.PI * (3 * (major + minor) - Math.sqrt((3 * major + minor) * (major + 3 * minor))), area: Math.PI * major * minor, points: [center], render: { kind: "ellipse", center, majorX, majorY, major, minor, startParam, endParam } } }
  if (["POINT", "TEXT", "MTEXT", "INSERT", "BLOCK", "VERTEX", "SEQEND"].includes(type)) return { length: 0, area: 0, points: [point(entity)] }
  return { length: 0, area: 0, points: [] }
}

function inferSystem(value) {
  const text = String(value || "").toLowerCase()
  if (/hvac|mech|duct|chws?|ahu|fcu|vent/.test(text)) return "HVAC"
  if (/fire|sprink|ff|foam|hose/.test(text)) return "Fire Fighting"
  if (/plumb|pipe|drain|sanit|water|ppr/.test(text)) return "Plumbing"
  if (/elec|power|light|bms/.test(text)) return "Electrical"
  return "General"
}

function parseDxfText(text, options = {}) {
  const pairs = pairLines(text)
  const header = parseHeader(pairs)
  const entities = splitEntities(sectionPairs(pairs, "ENTITIES"))
  const parsed = []
  const layerMap = new Map()
  const typeCounts = {}
  let totalLength = 0; let totalArea = 0
  entities.forEach((entity, index) => {
    const layer = layerName(entity); const geometry = entityGeometry(entity, entities); const name = String(first(entity, 2, ""))
    const record = { id: String(first(entity, 5, `dxf-${index + 1}`)), type: entity.type, layer, blockName: name, system: inferSystem(`${layer} ${name}`), text: [first(entity, 1, ""), ...values(entity, 3)].join(" ").trim(), points: geometry.points, length: geometry.length, area: geometry.area, closed: Boolean(geometry.closed), geometry: geometry.render || null, source: { format: "DXF", entityIndex: index } }
    if (entity.type !== "VERTEX" && entity.type !== "SEQEND") parsed.push(record)
    typeCounts[entity.type] = (typeCounts[entity.type] || 0) + 1
    totalLength += geometry.length; totalArea += geometry.area
    const current = layerMap.get(layer) || { name: layer, system: inferSystem(layer), entities: 0, length: 0, area: 0, counts: {} }
    if (!['VERTEX', 'SEQEND'].includes(entity.type)) { current.entities += 1; current.length += geometry.length; current.area += geometry.area; current.counts[entity.type] = (current.counts[entity.type] || 0) + 1 }
    layerMap.set(layer, current)
  })
  const unitCode = String(header.$INSUNITS || "0")
  const units = { "0": "Unitless", "1": "Inches", "2": "Feet", "3": "Miles", "4": "Millimeters", "5": "Centimeters", "6": "Meters", "7": "Kilometers", "8": "Microinches", "9": "Mils", "10": "Yards" }[unitCode] || unitCode
  const limit = Math.max(1, Math.min(20000, Number(options.entityLimit || 5000)))
  const result = { format: "DXF", version: String(header.$ACADVER || ""), units, header, entityCount: parsed.length, totalLength, totalArea, typeCounts, layers: [...layerMap.values()], entities: parsed.slice(0, limit), truncated: parsed.length > limit, systems: [...new Set([...layerMap.values()].map((layer) => layer.system))] }
  return result
}

function detectCadFormat(input, fileName = "") {
  const name = String(fileName || "").toLowerCase()
  if (name.endsWith(".dxf")) return "DXF"
  if (name.endsWith(".dwg")) return "DWG"
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ""))
  const head = buffer.subarray(0, 16).toString("ascii")
  if (/^AC10\d{2}/.test(head)) return "DWG"
  if (/^\s*0\s*[\r\n]+SECTION/i.test(buffer.toString("utf8", 0, Math.min(buffer.length, 2048)))) return "DXF"
  return "UNKNOWN"
}

function inspectCadBuffer(input, options = {}) {
  const format = detectCadFormat(input, options.fileName)
  if (format !== "DXF") return { ok: false, format, reason: format === "DWG" ? "DWG_CONVERTER_REQUIRED" : "CAD_FORMAT_UNKNOWN", warnings: format === "DWG" ? ["Native DWG is intentionally an adapter boundary. Configure an approved DWG→DXF converter or use a licensed CAD SDK."] : [] }
  const text = Buffer.isBuffer(input) ? input.toString("utf8") : String(input || "")
  return { ok: true, format, model: parseDxfText(text, options) }
}

function parseDxfFile(filePath, options = {}) { return inspectCadBuffer(fs.readFileSync(filePath), { ...options, fileName: options.fileName || filePath }) }

module.exports = { pairLines, parseDxfText, parseDxfFile, detectCadFormat, inspectCadBuffer, polygonArea, bulgeLength }
