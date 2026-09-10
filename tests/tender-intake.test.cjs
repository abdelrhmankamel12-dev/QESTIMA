const test=require('node:test'),assert=require('node:assert/strict')
const Intake=require('../app/tender-intake.js'), C=require('../app/core.js')
const at='2026-09-09T18:00:00Z'
function file(id,name,hash=id){return {id,name,hash,fileType:'PDF',size:100}}
test('classification is an unapproved filename suggestion, never an invented confidence score',()=>{
  assert.equal(Intake.suggest('Contract.pdf').category,'commercial')
  assert.equal(Intake.suggest('Contract and Specifications.pdf').category,'other')
  assert.equal(Intake.suggest('Tender-001.pdf').category,'other')
  assert.equal(Intake.suggest('Contract.pdf').confidence,null)
  assert.equal(Intake.suggest('Contract.pdf').needsReview,true)
})
test('intake deduplicates by content hash, not filename, and leaves source and prices untouched',()=>{
  const p={documents:[],boq:[{quantity:16,manualRate:500}],tenderIntake:[]}, before=JSON.stringify(p)
  const stage=Intake.stage(p,[file('a','BOQ.pdf','hash1'),file('b','Renamed.pdf','hash1'),file('c','BOQ.pdf','hash2')],'engineer',at)
  assert.equal(stage.duplicates,1);assert.equal(stage.queue.length,2);assert.equal(JSON.stringify(p),before)
  p.tenderIntake=stage.queue;const source=JSON.stringify(p.tenderIntake[0].source)
  const reviewed=Intake.approve(p,stage.queue[0].id,{category:'boq',documentNumber:'BQ-01',revision:'0'},'reviewer',at)
  assert.equal(p.documents.length,0);assert.equal(reviewed.documents.length,1)
  assert.equal(JSON.stringify(reviewed.tenderIntake[0].source),source);assert.deepEqual(reviewed.boq,p.boq)
})
test('revision replacement needs explicit confirmation and survives normalization',()=>{
  let p={documents:[],boq:[]};p.tenderIntake=Intake.stage(p,[file('a','Drawing rev02.pdf')],'u',at).queue
  p=Intake.approve(p,'intake-a',{category:'drawings',documentNumber:'M-301',revision:'02'},'u',at)
  p.tenderIntake=Intake.stage(p,[file('b','Drawing rev01.pdf')],'u',at).queue
  const r={category:'drawings',documentNumber:'M-301',revision:'01'}
  assert.throws(()=>Intake.approve(p,'intake-b',r,'u',at),/REVISION_CONFIRMATION_REQUIRED/)
  const next=Intake.approve(p,'intake-b',{...r,supersedes:'doc-a'},'u',at)
  C.recalculateDocumentRevisions(next)
  assert.equal(next.documents.find(d=>d.id==='doc-b').status,'current');assert.equal(next.documents.find(d=>d.id==='doc-a').status,'superseded')
  assert.throws(()=>Intake.approve(next,'intake-b',r,'u',at),/REVIEW_NOT_PENDING/)
  assert.equal(p.documents[0].status,'current')
})
