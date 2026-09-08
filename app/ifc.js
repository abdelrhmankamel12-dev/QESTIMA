(function (root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) module.exports = api
  if (root) root.QESTIMAModel = api
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict"

  const nowIso = () => new Date().toISOString()
  const id = (prefix = "id") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const number = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    const parsed = Number(String(value ?? "").replace(/[,٬]/g, "").replace(/٫/g, ".").trim())
    return Number.isFinite(parsed) ? parsed : 0
  }
  const clone = (value) => JSON.parse(JSON.stringify(value))

  function unquote(value) {
    const raw = String(value ?? "").trim()
    if (!raw || raw === "$" || raw === "*") return ""
    if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'")
    const wrapped = raw.match(/^IFC[A-Z0-9_]+\((.*)\)$/i)
    return wrapped ? unquote(wrapped[1]) : raw
  }

  function splitArgs(value) {
    const source = String(value || "")
    const output = []; let current = ""; let depth = 0; let quoted = false
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index]
      if (character === "'" && source[index + 1] === "'") { current += "''"; index += 1; continue }
      if (character === "'") { quoted = !quoted; current += character; continue }
      if (!quoted && character === "(") depth += 1
      if (!quoted && character === ")") depth -= 1
      if (!quoted && character === "," && depth === 0) { output.push(current.trim()); current = "" } else current += character
    }
    output.push(current.trim())
    return output
  }

  function refsFrom(value) {
    return [...String(value || "").matchAll(/#(\d+)/g)].map((match) => Number(match[1])).filter(Number.isFinite)
  }

  function parseStepEntities(text) {
    const entities = new Map()
    const source = String(text || "").replace(/\/\*[^]*?\*\//g, "")
    const pattern = /#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([^]*?)\)\s*;/gi
    let match
    while ((match = pattern.exec(source))) entities.set(Number(match[1]), { id: Number(match[1]), type: String(match[2]).toUpperCase(), args: splitArgs(match[3]) })
    return entities
  }

  function entityName(entity) {
    if (!entity) return ""
    return unquote(entity.args?.[2] || entity.args?.[0] || entity.args?.[1] || "")
  }

  function entityDescription(entity) {
    return unquote(entity?.args?.[3] || "")
  }

  function categoryForType(type) {
    const value = String(type || "").toUpperCase()
    if (/FIRE|SPRINKLER|HYDRANT|FIRESUPPRESSION/.test(value)) return "Fire Fighting"
    if (/PIPE|PLUMB|SANITARY|WASTETERMINAL|DRAIN|VALVE|FLOWFITTING/.test(value)) return "Plumbing"
    if (/DUCT|HVAC|FAN|PUMP|AIRHANDLER|AIRTERMINAL|UNITARY|MECHANICAL|CHILLER|COIL/.test(value)) return "HVAC"
    if (/ELECTRIC|CABLE|LIGHT|SWITCH|OUTLET/.test(value)) return "Electrical"
    if (/WALL|SLAB|ROOF|COLUMN|BEAM|DOOR|WINDOW|STAIR|FURNISHING|SPACE/.test(value)) return "Architectural"
    return "General"
  }

  function quantityField(name, type) {
    const key = `${name || ""} ${type || ""}`.toLowerCase()
    if (type === "IFCQUANTITYLENGTH" || /length|lengthmeasure|linear/.test(key)) return "length"
    if (type === "IFCQUANTITYAREA" || /area|surface/.test(key)) return "area"
    if (type === "IFCQUANTITYVOLUME" || /volume|capacity/.test(key)) return "volume"
    if (type === "IFCQUANTITYCOUNT" || /count|number|quantity/.test(key)) return "count"
    return ""
  }

  function dimensionsFromText(values) {
    const source = values.filter(Boolean).join(" ")
    const match = source.match(/(?:ø|dia(?:meter)?|size|dn|width|height|depth)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(mm|cm|m|in|\")/i)
    return match ? `${match[1].replace(",", ".")} ${match[2]}` : ""
  }

  function parseIfcText(text, options = {}) {
    const source = String(text || "")
    const entities = parseStepEntities(source)
    const schema = source.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)/i)?.[1] || "Unknown"
    const modelVersion = String(options.modelVersion || options.revision || "01")
    const propertySets = new Map()
    const quantities = new Map()
    const products = []
    const containment = new Map()
    const zones = new Map()
    const materials = new Map()
    const types = new Map()

    entities.forEach((entity) => {
      if (entity.type === "IFCPROPERTYSINGLEVALUE") {
        propertySets.set(entity.id, { kind: "single", name: unquote(entity.args[0]), value: unquote(entity.args[2] || entity.args[1]), rawValue: entity.args[2] || entity.args[1] || "" })
      } else if (/^IFCQUANTITY(LENGTH|AREA|VOLUME|COUNT)$/.test(entity.type)) {
        const field = quantityField(unquote(entity.args[0]), entity.type)
        const numeric = entity.args.slice(2).map((value) => unquote(value)).find((value) => /^-?(?:\d+\.?\d*|\.\d+)$/.test(String(value).trim()))
        quantities.set(entity.id, { field, name: unquote(entity.args[0]), value: number(numeric ?? entity.args[2] ?? entity.args[1]), type: entity.type })
      } else if (entity.type === "IFCELEMENTQUANTITY") {
        const list = refsFrom(entity.args.find((arg) => /#\d+/.test(arg)) || "")
        propertySets.set(entity.id, { kind: "quantities", name: entityName(entity), quantityRefs: list })
      } else if (entity.type === "IFCMATERIAL") {
        materials.set(entity.id, unquote(entity.args[0]))
      } else if (/TYPE$/.test(entity.type) || entity.type === "IFCTYPEPRODUCT") {
        types.set(entity.id, { name: entityName(entity), type: entity.type, predefinedType: unquote(entity.args[8] || "") })
      } else if (entity.type === "IFCZONE") {
        zones.set(entity.id, entityName(entity))
      } else if (/^IFC(PRODUCT|FLOW|PIPE|DUCT|PUMP|FAN|AHU|FCU|AIR|VALVE|SANITARY|FIRE|MECHANICAL|WALL|SLAB|DOOR|WINDOW|SPACE|FURNISHING|BUILDING|SITE|PROJECT)/.test(entity.type) && !/REL|PROPERTY|QUANTITY|TYPE$/.test(entity.type)) {
        products.push(entity)
      }
    })

    const propertyLinks = new Map()
    entities.forEach((entity) => {
      if (entity.type === "IFCRELDEFINESBYPROPERTIES") {
        const refs = refsFrom(entity.args[4] || entity.args.slice(0, -1).join(",")); const definition = refsFrom(entity.args.at(-1) || "")[0]
        refs.forEach((ref) => { if (!propertyLinks.has(ref)) propertyLinks.set(ref, []); if (definition != null) propertyLinks.get(ref).push(definition) })
      }
      if (entity.type === "IFCRELCONTAINEDINSPATIALSTRUCTURE") {
        const refs = refsFrom(entity.args[4] || ""); const structure = refsFrom(entity.args.at(-1) || "")[0]
        const level = entityName(entities.get(structure))
        refs.forEach((ref) => containment.set(ref, level))
      }
      if (entity.type === "IFCRELASSIGNSTOGROUP") {
        const refs = refsFrom(entity.args[4] || ""); const group = refsFrom(entity.args.at(-1) || "")[0]
        const zone = zones.get(group) || entityName(entities.get(group))
        refs.forEach((ref) => { if (zone) containment.set(`${ref}:zone`, zone) })
      }
      if (entity.type === "IFCRELASSOCIATESMATERIAL") {
        const refs = refsFrom(entity.args[4] || ""); const material = refsFrom(entity.args.at(-1) || "")[0]
        refs.forEach((ref) => materials.set(ref, materials.get(material) || entityName(entities.get(material)) || ""))
      }
      if (entity.type === "IFCRELDEFINESBYTYPE") {
        const refs = refsFrom(entity.args[4] || ""); const typeRef = refsFrom(entity.args.at(-1) || "")[0]
        refs.forEach((ref) => types.set(ref, types.get(typeRef) || { name: entityName(entities.get(typeRef)), type: entities.get(typeRef)?.type || "" }))
      }
    })

    const elements = products.filter((entity) => !/^IFC(PROJECT|SITE|BUILDING|BUILDINGSTOREY|SPACE|ZONE)$/.test(entity.type)).map((entity) => {
      const psets = {}; const quantitiesByField = { length: 0, area: 0, volume: 0, count: 1 }
      ;(propertyLinks.get(entity.id) || []).forEach((propertyId) => {
        const property = propertySets.get(propertyId)
        if (!property) return
        if (property.kind === "single") psets[property.name || `Property ${propertyId}`] = property.value
        if (property.kind === "quantities") property.quantityRefs.forEach((quantityId) => { const quantity = quantities.get(quantityId); if (quantity?.field) quantitiesByField[quantity.field] = number(quantity.value) })
      })
      const typeInfo = types.get(entity.id) || {}
      const values = [entityName(entity), entityDescription(entity), ...Object.entries(psets).flat()]
      const type = String(entity.type || "")
      const size = psets.Size || psets.size || psets.Diameter || psets.DiameterNominal || dimensionsFromText(values)
      const family = typeInfo.name || type.replace(/^IFC/, "").replace(/STANDARDCASE|TYPE$/g, "").replace(/([a-z])([A-Z])/g, "$1 $2")
      const elementId = unquote(entity.args[0]) || `#${entity.id}`
      return {
        elementId,
        expressId: entity.id,
        globalId: elementId,
        ifcType: type,
        category: categoryForType(type),
        family,
        typeName: typeInfo.name || type,
        predefinedType: typeInfo.predefinedType || "",
        name: entityName(entity),
        description: entityDescription(entity),
        system: String(psets.System || psets.SystemName || psets.Reference || ""),
        level: containment.get(entity.id) || "",
        zone: containment.get(`${entity.id}:zone`) || "",
        size: String(size || ""),
        material: materials.get(entity.id) || String(psets.Material || psets.MaterialName || ""),
        properties: psets,
        quantities: { length: number(quantitiesByField.length), area: number(quantitiesByField.area), volume: number(quantitiesByField.volume), count: number(quantitiesByField.count) || 1 },
        source: { expressId: entity.id, modelVersion },
        modelVersion,
        mappingStatus: "unmapped",
        boqItemId: "",
        rateAssemblyId: "",
        status: "pending",
      }
    })

    const summaries = [...new Map(elements.map((element) => {
      const key = `${element.category}|${element.system || "General"}|${element.level || "Unassigned"}`
      return [key, { key, category: element.category, system: element.system || "General", level: element.level || "Unassigned", count: 0, length: 0, area: 0, volume: 0 }]
    })).values()]
    elements.forEach((element) => {
      const summary = summaries.find((row) => row.key === `${element.category}|${element.system || "General"}|${element.level || "Unassigned"}`)
      if (!summary) return
      summary.count += 1; summary.length += element.quantities.length; summary.area += element.quantities.area; summary.volume += element.quantities.volume
    })
    return {
      id: options.id || id("ifc-model"), modelId: String(options.modelId || options.id || ""), fileName: String(options.fileName || "model.ifc"), schema, modelVersion,
      importedAt: options.importedAt || nowIso(), importedBy: String(options.importedBy || ""), sourceAttachmentId: String(options.sourceAttachmentId || ""), revision: String(options.revision || modelVersion),
      elementCount: elements.length, elements, summaries, warnings: elements.length ? [] : ["No IFC product elements were found; confirm that the file is a valid STEP IFC export."], advisoryOnly: true, status: "review_required",
    }
  }

  // The Revit bridge exports the same neutral shape as IFC mapping. Keeping
  // this adapter here lets a team review a Revit JSON snapshot without
  // shipping Autodesk binaries inside the desktop application.
  function parseRevitSnapshot(value, options = {}) {
    let payload = value
    if (typeof value === "string") {
      try { payload = JSON.parse(value) } catch { return { id: options.id || id("ifc-model"), fileName: options.fileName || "revit-snapshot.json", revision: options.revision || "01", modelVersion: options.modelVersion || "01", schema: "Revit JSON", elements: [], summaries: [], warnings: ["The Revit snapshot is not valid JSON."], advisoryOnly: true, status: "review_required" } }
    }
    const modelVersion = String(options.modelVersion || payload?.modelVersion || options.revision || "01")
    const elements = (Array.isArray(payload?.elements) ? payload.elements : []).map((entry, index) => ({
      elementId: String(entry.elementId || entry.uniqueId || `revit-${index + 1}`), expressId: number(entry.expressId || entry.id), globalId: String(entry.elementId || entry.uniqueId || `revit-${index + 1}`),
      ifcType: String(entry.ifcType || entry.category || "REVIT_ELEMENT"), category: String(entry.category || "General"), family: String(entry.family || ""), typeName: String(entry.typeName || entry.type || ""), predefinedType: String(entry.predefinedType || ""), name: String(entry.name || ""), description: String(entry.description || ""), system: String(entry.system || ""), level: String(entry.level || ""), zone: String(entry.zone || ""), size: String(entry.size || ""), material: String(entry.material || ""), properties: entry.properties && typeof entry.properties === "object" ? clone(entry.properties) : {}, quantities: { length: number(entry.quantities?.length), area: number(entry.quantities?.area), volume: number(entry.quantities?.volume), count: number(entry.quantities?.count) || 1 }, source: { expressId: number(entry.expressId || entry.id), modelVersion }, modelVersion, mappingStatus: "unmapped", boqItemId: "", rateAssemblyId: "", status: "pending",
    }))
    const summaries = [...new Map(elements.map((element) => { const key = `${element.category}|${element.system || "General"}|${element.level || "Unassigned"}`; return [key, { key, category: element.category, system: element.system || "General", level: element.level || "Unassigned", count: 0, length: 0, area: 0, volume: 0 }] })).values()]
    elements.forEach((element) => { const summary = summaries.find((row) => row.key === `${element.category}|${element.system || "General"}|${element.level || "Unassigned"}`); if (summary) { summary.count += 1; summary.length += element.quantities.length; summary.area += element.quantities.area; summary.volume += element.quantities.volume } })
    return { id: options.id || id("ifc-model"), modelId: String(options.modelId || options.id || ""), fileName: String(options.fileName || payload?.fileName || "revit-snapshot.json"), schema: "Revit JSON", modelVersion, importedAt: options.importedAt || nowIso(), importedBy: String(options.importedBy || ""), sourceAttachmentId: String(options.sourceAttachmentId || ""), revision: String(options.revision || payload?.revision || modelVersion), elementCount: elements.length, elements, summaries, warnings: elements.length ? [] : ["No Revit elements were found in the snapshot."], advisoryOnly: true, status: "review_required" }
  }

  function parseModelSource(text, options = {}) {
    const source = String(text || "").trim()
    if (source.startsWith("{") || source.startsWith("[")) {
      try { const payload = JSON.parse(source); if (payload?.format === "qestima-revit-snapshot" || Array.isArray(payload?.elements)) return parseRevitSnapshot(payload, options) } catch {}
    }
    return parseIfcText(source, options)
  }

  function modelMappingSummary(project = {}, modelId = "") {
    const model = (project.ifcModels || []).find((entry) => entry.id === modelId)
    const elements = model?.elements || (project.ifcElements || []).filter((entry) => entry.modelId === modelId)
    const mappings = (project.ifcMappings || []).filter((entry) => entry.modelId === modelId)
    return { modelId, elements: elements.length, mapped: mappings.filter((entry) => entry.status !== "rejected").length, approved: mappings.filter((entry) => entry.status === "approved").length, pending: mappings.filter((entry) => entry.status === "pending").length, unmapped: elements.filter((element) => !mappings.some((entry) => entry.elementId === element.elementId && entry.status !== "rejected")).length }
  }

  function upsertIfcModel(project, model, options = {}) {
    if (!project || !model) return { ok: false, reason: "MODEL_REQUIRED" }
    project.ifcModels ||= []; project.ifcElements ||= []; project.ifcMappings ||= []; project.modelRevisions ||= []
    const index = project.ifcModels.findIndex((entry) => entry.id === model.id)
    const normalized = clone(model)
    if (index >= 0) project.ifcModels[index] = normalized; else project.ifcModels.unshift(normalized)
    project.ifcElements = project.ifcElements.filter((entry) => entry.modelId !== normalized.id)
    project.ifcElements.push(...normalized.elements.map((entry) => ({ ...entry, modelId: normalized.id })))
    project.modelRevisions.unshift({ id: id("model-revision"), modelId: normalized.id, revision: normalized.revision, schema: normalized.schema, fileName: normalized.fileName, modelVersion: normalized.modelVersion, elementCount: normalized.elementCount, importedAt: normalized.importedAt, importedBy: normalized.importedBy, sourceAttachmentId: normalized.sourceAttachmentId, status: "current" })
    project.modelRevisions.filter((entry) => entry.modelId === normalized.id).slice(1).forEach((entry) => { entry.status = "superseded" })
    return { ok: true, model: normalized, summary: modelMappingSummary(project, normalized.id) }
  }

  function linkIfcElementToBoq(project, input = {}) {
    project.ifcMappings ||= []
    const element = (project.ifcElements || []).find((entry) => entry.modelId === input.modelId && entry.elementId === input.elementId)
    const item = (project.boq || []).find((entry) => entry.id === input.boqItemId)
    if (!element || !item) return { ok: false, reason: "MODEL_ELEMENT_OR_BOQ_NOT_FOUND" }
    const existing = project.ifcMappings.find((entry) => entry.modelId === input.modelId && entry.elementId === input.elementId)
    const mapping = existing || { id: input.id || id("ifc-map"), modelId: input.modelId, elementId: input.elementId, createdAt: nowIso() }
    Object.assign(mapping, { boqItemId: item.id, rateAssemblyId: String(input.rateAssemblyId || mapping.rateAssemblyId || ""), status: "pending", createdBy: String(input.userId || ""), updatedAt: nowIso(), notes: String(input.notes || mapping.notes || ""), quantityField: ["length", "area", "volume", "count"].includes(input.quantityField) ? input.quantityField : mapping.quantityField || "count" })
    if (!existing) project.ifcMappings.push(mapping)
    element.mappingStatus = "pending"; element.boqItemId = item.id; element.rateAssemblyId = mapping.rateAssemblyId
    return { ok: true, mapping: clone(mapping), element, item }
  }

  function setIfcMappingStatus(project, mappingId, status, user = "") {
    const mapping = (project.ifcMappings || []).find((entry) => entry.id === mappingId)
    if (!mapping || !["pending", "approved", "rejected"].includes(status)) return { ok: false, reason: "MAPPING_NOT_FOUND" }
    mapping.status = status; mapping.reviewedBy = user; mapping.reviewedAt = nowIso()
    const element = (project.ifcElements || []).find((entry) => entry.modelId === mapping.modelId && entry.elementId === mapping.elementId)
    if (element) element.mappingStatus = status
    return { ok: true, mapping }
  }

  function applyApprovedIfcQuantity(project, mappingId, user = "") {
    const mapping = (project.ifcMappings || []).find((entry) => entry.id === mappingId)
    if (!mapping) return { ok: false, reason: "MAPPING_NOT_FOUND" }
    if (mapping.status !== "approved") return { ok: false, reason: "MAPPING_NOT_APPROVED" }
    const item = (project.boq || []).find((entry) => entry.id === mapping.boqItemId)
    if (!item) return { ok: false, reason: "BOQ_ITEM_NOT_FOUND" }
    const approved = (project.ifcMappings || []).filter((entry) => entry.boqItemId === item.id && entry.status === "approved").map((entry) => {
      const element = (project.ifcElements || []).find((candidate) => candidate.modelId === entry.modelId && candidate.elementId === entry.elementId)
      const field = entry.quantityField || "count"
      return number(element?.quantities?.[field])
    }).reduce((sum, value) => sum + value, 0)
    item.takeoffQuantity = approved; item.quantityBasis = "takeoff"; item.quantityDecision = "ifc-approved"
    item.sources ||= {}; item.sources.quantity = { type: "ifc", modelId: mapping.modelId, elementId: mapping.elementId, field: mapping.quantityField || "count", date: nowIso(), user }
    return { ok: true, item, quantity: approved }
  }

  function compareIfcModels(before = {}, after = {}) {
    const beforeRows = new Map((before.elements || []).map((entry) => [entry.globalId || entry.elementId || `${entry.ifcType}:${entry.name}`, entry]))
    const afterRows = new Map((after.elements || []).map((entry) => [entry.globalId || entry.elementId || `${entry.ifcType}:${entry.name}`, entry]))
    const added = []; const deleted = []; const changed = []
    afterRows.forEach((entry, key) => { if (!beforeRows.has(key)) added.push(entry) })
    beforeRows.forEach((entry, key) => { if (!afterRows.has(key)) deleted.push(entry) })
    afterRows.forEach((entry, key) => {
      const old = beforeRows.get(key); if (!old) return
      const fields = ["ifcType", "category", "family", "typeName", "system", "level", "zone", "size", "material", "name"]
      const differences = fields.filter((field) => String(old[field] || "") !== String(entry[field] || "")).map((field) => ({ field, before: old[field] || "", after: entry[field] || "" }))
      const quantityFields = ["length", "area", "volume", "count"]
      const quantityChanges = quantityFields.filter((field) => number(old.quantities?.[field]) !== number(entry.quantities?.[field])).map((field) => ({ field, before: number(old.quantities?.[field]), after: number(entry.quantities?.[field]), delta: number(entry.quantities?.[field]) - number(old.quantities?.[field]) }))
      if (differences.length || quantityChanges.length) changed.push({ key, before: old, after: entry, differences, quantityChanges })
    })
    return { ok: true, beforeModelId: before.id || before.modelId || "", afterModelId: after.id || after.modelId || "", beforeRevision: before.revision || before.modelVersion || "", afterRevision: after.revision || after.modelVersion || "", added, deleted, changed, counts: { added: added.length, deleted: deleted.length, changed: changed.length } }
  }

  return { parseStepEntities, parseIfcText, parseRevitSnapshot, parseModelSource, modelMappingSummary, upsertIfcModel, linkIfcElementToBoq, setIfcMappingStatus, applyApprovedIfcQuantity, compareIfcModels }
})
