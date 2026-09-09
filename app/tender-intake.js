(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.QESTIMATenderIntake=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict'
  const categories={boq:'BOQ REVIEW',commercial:'CONTRACT AI',specifications:'SPECIFICATIONS',vendors:'VENDOR LIST',drawings:'DRAWING REVIEW',addenda:'ADDENDUMS',clarifications:'CLARIFICATIONS',instructions:'TENDER INSTRUCTIONS',other:'OTHER / MIXED'}
  const patterns={boq:/\bboq\b|bill.of.quantit|مقايس|كميات/i,commercial:/contract|agreement|conditions|عقد|شروط عام|شروط خاص/i,specifications:/specification|\bspecs?\b|مواصفات/i,vendors:/vendor|manufacturer|\bavl\b|مصنعين|مصنعون|موردين معتمد/i,drawings:/drawing|layout|\.(dwg|dxf)$/i,addenda:/addend|ملحق|تعديل المناقص/i,clarifications:/clarification|\brfi\b|استفسار|توضيح/i,instructions:/instruction|تعليمات/i}
  function suggest(name){
    const hits=Object.entries(patterns).filter(([,p])=>p.test(name)).map(([k])=>k)
    return {category:hits.length===1?hits[0]:'other',candidates:hits,method:'filename-rules',confidence:null,needsReview:true,reason:hits.length>1?'أكثر من تصنيف محتمل؛ راجع محتوى الملف.':hits.length?'اقتراح من اسم الملف فقط؛ لم يُقرأ المحتوى.':'اسم الملف غير كافٍ للتصنيف.'}
  }
  function stage(project,files,actor,at){
    const queue=JSON.parse(JSON.stringify(project.tenderIntake||[])), hashes=new Set([...(project.documents||[]).map(d=>d.hash),...queue.filter(d=>d.status!=='rejected').map(d=>d.source.hash)].filter(Boolean));let duplicates=0
    for(const file of files){
      if(file.hash&&hashes.has(file.hash)){duplicates++;continue}if(file.hash)hashes.add(file.hash)
      const source={attachmentId:file.id,name:file.originalName||file.name,size:file.size||0,hash:file.hash||'',fileType:file.fileType||'',uploadedBy:actor,uploadedAt:at}
      queue.push({id:'intake-'+file.id,source,suggestion:suggest(source.name),status:'pending'})
    }
    return {queue,duplicates}
  }
  function approve(project,id,review,actor,at){
    const next=JSON.parse(JSON.stringify(project)), record=(next.tenderIntake||[]).find(r=>r.id===id)
    if(!record||record.status!=='pending')throw Error('REVIEW_NOT_PENDING')
    if(!Object.hasOwn(categories,review.category)||!String(review.documentNumber||'').trim()||!String(review.revision||'').trim())throw Error('DOCUMENT_ID_REVISION_REQUIRED')
    const number=review.documentNumber.trim(),revision=review.revision.trim();next.documents||=[]
    const existing=next.documents.filter(d=>String(d.documentNumber).trim().toLowerCase()===number.toLowerCase())
    if(existing.some(d=>String(d.revision).toLowerCase()===revision.toLowerCase()))throw Error('REVISION_ALREADY_EXISTS')
    const current=existing.filter(d=>d.status!=='superseded')
    if(current.length>1)throw Error('MULTIPLE_CURRENT_REVISIONS')
    if(current.length&&review.supersedes!==current[0].id)throw Error('REVISION_CONFIRMATION_REQUIRED')
    if(!current.length&&review.supersedes)throw Error('INVALID_PREVIOUS_REVISION')
    const docId='doc-'+record.source.attachmentId
    existing.forEach(d=>{d.manualRevision=true;d.latestRevision=false;d.status='superseded';d.supersededBy=docId})
    next.documents.push({id:docId,documentNumber:number,title:record.source.name,category:review.category==='other'?'scope':review.category,discipline:review.discipline||'MEP',revision,issueDate:'',receivedDate:at.slice(0,10),fileType:record.source.fileType,originalName:record.source.name,size:record.source.size,hash:record.source.hash,attachment:{id:record.source.attachmentId,name:record.source.name},status:'current',latestRevision:true,supersededBy:'',manualRevision:true,notes:'',intakeApprovedBy:actor,intakeApprovedAt:at})
    record.status='approved';record.review={...review,approvedBy:actor,approvedAt:at};record.documentId=docId
    next.tenderReview={...(next.tenderReview||{}),completedAt:''};return next
  }
  return {categories,suggest,stage,approve}
});
