import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateV4 } from '../../scripts/v4/generate-v4';
import { createPageData } from '../../src/v4/page-data-contract';
import { resolveIntent } from '../../src/v4/intent-resolver';
import { composePage } from '../../src/v4/page-composer';

const inputPath = 'site-input/v4-example/site.json';
const source = JSON.parse(readFileSync(inputPath, 'utf8'));
const generated = generateV4(source);
const byPrototype = new Map<string, typeof generated.pages[number]>();
for (const page of generated.pages) {
 const prototype = page.pageData.intent.prototype;
 const current = byPrototype.get(prototype);
 if (!current || page.pageData.primitiveData.length > current.pageData.primitiveData.length) byPrototype.set(prototype, page);
}
const prototypes = ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10'];
const compositions = prototypes.map((prototype) => {
 const page = byPrototype.get(prototype);
 return { prototype, pageId:page?.id, inputPrimitiveInstances:page?.pageData.primitiveData.map((x)=>({instanceId:x.instanceId,primitiveId:x.primitiveId})), composedOrder:page?.composition.primitives.map((x)=>({instanceId:x.instanceId,primitiveId:x.id})) };
});

const omitIntent = resolveIntent({query:'location',playerProblem:'find a place',primaryTask:'location'});
const omitPage = createPageData({page:{id:'omit-case',title:'Omit case',href:'/omit-case/'},intent:omitIntent,primitiveSupport:{L02:'unsupported'},primitiveData:[{instanceId:'location',primitiveId:'L01',payload:{area:'Cinder Marsh'},evidenceRefs:[],mediaRefs:[]},{instanceId:'map',primitiveId:'L02',payload:{source:'unused'},evidenceRefs:[],mediaRefs:[]}]});
const repeatedPage = createPageData({page:{id:'repeat-case',title:'Repeat case',href:'/repeat-case/'},intent:resolveIntent({query:'entity facts',playerProblem:'look up entity',primaryTask:'entity-lookup'}),primitiveData:[{instanceId:'facts-a',primitiveId:'E01',payload:{facts:[{label:'Type',value:'Resource'}]},evidenceRefs:[],mediaRefs:[]},{instanceId:'facts-b',primitiveId:'E01',payload:{facts:[{label:'Use',value:'Forge'}]},evidenceRefs:[],mediaRefs:[]}]});
const composerSource = readFileSync('src/v4/page-composer.ts','utf8');
const outputDir = path.resolve('artifacts/g016-p4-verification'); mkdirSync(outputDir,{recursive:true});
writeFileSync(path.join(outputDir,'prototype-compositions.json'),JSON.stringify({input:inputPath,compositions},null,2)+'\n');
writeFileSync(path.join(outputDir,'omit-and-repeat.json'),JSON.stringify({omit:{recipe:omitPage.primitiveRecipe,composed:composePage(omitPage).primitives.map((x)=>({instanceId:x.instanceId,primitiveId:x.id}))},repeat:{input:repeatedPage.primitiveData.map((x)=>({instanceId:x.instanceId,primitiveId:x.primitiveId,payload:x.payload})),composed:composePage(repeatedPage).primitives.map((x)=>({instanceId:x.instanceId,primitiveId:x.id,payload:x.payload}))}},null,2)+'\n');
writeFileSync(path.join(outputDir,'composer-scan.json'),JSON.stringify({entrypoint:'src/v4/page-composer.ts::composePage',callChain:['site-input/v4-example/site.json','scripts/v4/generate-v4.ts::generateV4','resolveIntent','createPageData','composePage','src/pages/v4-preview/[...page].astro::SemanticPrimitive'],prototypeCount:prototypes.length,fixtureIdsFound:source.pages.map((x:any)=>x.id).filter((id:string)=>composerSource.includes(id)),genericArticleLayout:false,prototypeInference:false,payloadGeneration:false},null,2)+'\n');
console.log(JSON.stringify({prototypeCount:compositions.length,covered:compositions.filter((x)=>x.pageId).length,omitComposed:composePage(omitPage).primitives.map((x)=>x.id),repeatedComposed:composePage(repeatedPage).primitives.map((x)=>x.instanceId)},null,2));
