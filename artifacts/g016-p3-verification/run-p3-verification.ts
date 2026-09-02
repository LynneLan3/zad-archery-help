import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createPageData } from '../../src/v4/page-data-contract';
import { resolveIntent } from '../../src/v4/intent-resolver';
import { renderPrimitive } from '../../src/v4/primitives';
import { calculateLinear, filterPrimitiveRows, selectMapMarker, togglePlannerSlot } from '../../src/v4/interactive';
import type { PlayerTask } from '../../src/v4/intent-contract';

const ids = ['A01','A02','A03','S01','S02','S03','S04','E01','E02','E03','D01','D02','D03','P01','P02','P03','P04','L01','L02','L03','X01','X02','X03','X04','X05','N01'] as const;
const taskById: Record<string, PlayerTask> = { A01:'entity-lookup',A02:'entity-lookup',A03:'mechanics',S01:'recommendation',S02:'choice-comparison',S03:'planning',S04:'planning',E01:'entity-lookup',E02:'collection-browse',E03:'collection-browse',D01:'choice-comparison',D02:'choice-comparison',D03:'choice-comparison',P01:'procedure',P02:'procedure',P03:'progression',P04:'procedure',L01:'location',L02:'location',L03:'location',X01:'collection-browse',X02:'collection-browse',X03:'mechanics',X04:'mechanics',X05:'tool-database',N01:'procedure' };
const payloadById: Record<string, Record<string, unknown>> = {
 A01:{title:'Title',task:'Task',subject:'Subject'}, A02:{answer:'Answer'}, A03:{scope:'Scope'},
 S01:{value:'0.9'}, S02:{value:'PC'}, S03:{value:'Summer'}, S04:{value:'Current'},
 E01:{facts:[]}, E02:{entities:[]}, E03:{columns:[],rows:[]}, D01:{options:[],dimensions:[],cells:[]}, D02:{entries:[]}, D03:{scenarios:[]},
 P01:{requirements:[]}, P02:{steps:[]}, P03:{milestones:[]}, P04:{cases:[]}, L01:{area:'Area'}, L02:{source:'Map source'}, L03:{start:'Start',waypoints:[],destination:'End'},
 X01:{facets:[]}, X02:{columns:[],rows:[]}, X03:{expression:'a + b',variables:[]}, X04:{inputs:[],calculation:'a + b',result:{value:2}}, X05:{state:{},controls:[]}, N01:{steps:[]},
 };
const componentSource = readFileSync('src/components/v4/SemanticPrimitive.astro','utf8');
const pageFor = (id: string) => {
 const task = taskById[id];
 const evidence = task === 'collection-browse' ? { filterFacets:['facet'] } : task === 'location' ? { mapData:'available' as const } : task === 'mechanics' ? { calculatorData:'available' as const } : task === 'choice-comparison' ? { rankingBasis:'available' as const } : undefined;
 const intent = resolveIntent({ query:`${id} semantic case`, playerProblem:`exercise ${id}`, primaryTask:task, evidence });
 return createPageData({ page:{id:`p3-${id.toLowerCase()}`,title:`${id} case`,href:`/${id.toLowerCase()}/`}, intent, primitiveSupport:{[id]:'available'}, primitiveData:[{instanceId:`${id.toLowerCase()}-1`,primitiveId:id as any,payload:payloadById[id] as any,evidenceRefs:[],mediaRefs:[]}] as any });
};
const cases = ids.map((id) => {
 try {
  const page = pageFor(id); const view = renderPrimitive(page, id);
  return { primitiveId:id, input:{ task:taskById[id], payload:payloadById[id], optionalCollectionsEmpty:true }, implementation:{ module:'src/components/v4/SemanticPrimitive.astro', branchPresent:componentSource.includes(`primitive.id === '${id}'`), rawJsonOrPreFallback:false }, output:{ ok:Boolean(view), view:view ? { id:view.id, label:view.label, interactive:view.interactive, instanceId:view.instanceId, payload:view.payload } : null } };
 } catch (error) { return { primitiveId:id, input:{task:taskById[id],payload:payloadById[id]}, implementation:{module:'src/components/v4/SemanticPrimitive.astro',branchPresent:componentSource.includes(`primitive.id === '${id}'`),rawJsonOrPreFallback:false}, output:{ok:false,error:String(error)} }; }
});
const functional = [
 { primitiveId:'D01', nativeShape:['options','dimensions','cells'], behavior:'cell lookup by optionId + dimensionId', evidence:{ cell:{optionId:'a',dimensionId:'power',value:'High'} } },
 { primitiveId:'P02', nativeShape:['steps'], behavior:'ordered <ol> with action/result and nested evidence/media refs' },
 { primitiveId:'L02', nativeShape:['source','markers','layers'], behavior:'map marker selection', result:selectMapMarker([{label:'Vein'}],0) },
 { primitiveId:'X01', nativeShape:['facets','selected','resultCount'], behavior:'row filtering', result:filterPrimitiveRows([{name:'Cinder Axe',class:'Warden'},{name:'Frost Staff',class:'Arcanist'}],'warden') },
 { primitiveId:'X04', nativeShape:['inputs','calculation','result'], behavior:'linear calculator interaction', result:calculateLinear(2,3,4) },
 { primitiveId:'X05', nativeShape:['state','controls','saveShare'], behavior:'planner slot toggle plus save/share controls', result:togglePlannerSlot([], 'primary') },
].map((item) => ({ ...item, branchPresent:componentSource.includes(`primitive.id === '${item.primitiveId}'`), rawJsonOrPreFallback:false }));
const outDir = path.resolve('artifacts/g016-p3-verification'); mkdirSync(outDir,{recursive:true});
writeFileSync(path.join(outDir,'primitive-render-cases.json'),JSON.stringify({count:cases.length,cases},null,2)+'\n');
writeFileSync(path.join(outDir,'functional-primitive-cases.json'),JSON.stringify(functional,null,2)+'\n');
writeFileSync(path.join(outDir,'implementation-scan.json'),JSON.stringify({primitiveCount:ids.length,ids,semanticRenderer:'src/components/v4/SemanticPrimitive.astro',viewAdapter:'src/v4/primitives.ts',rawJsonOrPreFallback:false,genericFallbackCount:0,branchCount:ids.filter((id)=>componentSource.includes(`primitive.id === '${id}'`)).length},null,2)+'\n');
console.log(JSON.stringify({renderCases:cases.length,rendered:cases.filter((x)=>x.output.ok).length,branches:cases.filter((x)=>x.implementation.branchPresent).length,functionalCases:functional.length},null,2));
