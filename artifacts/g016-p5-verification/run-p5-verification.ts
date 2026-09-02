import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateV4 } from '../../scripts/v4/generate-v4';

const inputPath = 'site-input/v4-example/site.json';
const source = JSON.parse(readFileSync(inputPath, 'utf8'));
const generated = generateV4(source);
const pageIds = new Set(generated.pages.map((page) => page.id));
const pageById = new Map(generated.pages.map((page) => [page.id, page]));
const ordered = generated.homepage.pageIds.map((id) => pageById.get(id)).filter(Boolean);
const navigationItems = generated.navigation.primary.flatMap((category) => category.groups ?? []).flatMap((group) => group.items);
const browsePages = navigationItems.map((item) => pageById.get(item.pageId ?? '')).filter(Boolean);
const categoryGroups = generated.navigation.primary.flatMap((category) => category.groups ?? []).map((group) => ({ id:group.id, label:group.label, pageIds:group.items.map((item) => item.pageId).filter((id): id is string => Boolean(id) && pageIds.has(id)) })).filter((group) => group.pageIds.length > 0);
const searchIndex = generated.pages.map((page) => ({ id:page.id, title:page.title, href:page.href, prototype:page.pageData.intent.prototype }));

const cleanroomRoot = '/Users/lanling/Code/hot_words_websites/_g016-v4-cleanroom-emberfall/dist';
const internalHrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]).filter((href) => href.startsWith('/') && !href.startsWith('/_astro/') && !href.includes('#'));
const routeExists = (href: string) => {
 const clean = href.split('?')[0].replace(/\/$/,'') || '/';
 return existsSync(path.join(cleanroomRoot, clean === '/' ? 'index.html' : clean.slice(1,).concat('/index.html')));
};
const cleanroomPages = ['index.html','search/index.html','category/index.html'];
const cleanroom = cleanroomPages.map((file) => {
 const filePath = path.join(cleanroomRoot,file); const html = readFileSync(filePath,'utf8'); const hrefs = internalHrefs(html);
 return { file, exists:existsSync(filePath), internalHrefCount:hrefs.length, brokenInternalHrefs:hrefs.filter((href)=>!routeExists(href)), containsLegacyStarter:/starter|getting-started/i.test(html) };
});

const sparse = generateV4({ game:{name:'Sparse Game',slug:'sparse-game'}, navigation:{primary:[{id:'home',label:'Home',href:'/'},{id:'guide',label:'Guide',href:'/category/',groups:[{id:'only',label:'Only pages',items:[{id:'s1',label:'One',href:'/one/',pageId:'s1'},{id:'s2',label:'Two',href:'/two/',pageId:'s2'},{id:'s3',label:'Three',href:'/three/',pageId:'s3'}]}]}],utilities:[{id:'search',label:'Search',href:'/search/'}]}, pages:[
 {id:'s1',title:'One',href:'/one/',query:'one',playerProblem:'find one',primaryTask:'entity-lookup',priority:3},
 {id:'s2',title:'Two',href:'/two/',query:'two',playerProblem:'find two',primaryTask:'procedure',priority:2},
 {id:'s3',title:'Three',href:'/three/',query:'three',playerProblem:'find three',primaryTask:'location',priority:1},
]});
const sparseOrdered = sparse.homepage.pageIds.map((id)=>sparse.pages.find((page)=>page.id===id)).filter(Boolean);
const sparseNavIds = sparse.navigation.primary.flatMap((category)=>category.groups??[]).flatMap((group)=>group.items.map((item)=>item.pageId).filter((id):id is string=>Boolean(id)));
const sparseGroups = sparse.navigation.primary.flatMap((category)=>category.groups??[]).map((group)=>({id:group.id,pageIds:group.items.map((item)=>item.pageId).filter((id):id is string=>Boolean(id)&&sparse.pages.some((page)=>page.id===id))})).filter((group)=>group.pageIds.length>0);

const surfaceFiles = ['src/pages/v4-preview.astro','src/pages/v4-preview/search.astro','src/pages/v4-preview/category.astro','scripts/v4/standalone/pages/index.astro','scripts/v4/standalone/pages/search.astro','scripts/v4/standalone/pages/category.astro'];
const surfaceSource = surfaceFiles.map((file)=>readFileSync(file,'utf8')).join('\n');
const knownFixtureIds = source.pages.map((page:any)=>page.id);
const outputDir = path.resolve('artifacts/g016-p5-verification'); mkdirSync(outputDir,{recursive:true});
writeFileSync(path.join(outputDir,'discovery-flow.json'),JSON.stringify({input:inputPath,generatedPageIds:[...pageIds],homepage:{pageIds:generated.homepage.pageIds,orderedPageIds:ordered.map((page)=>page.id)},search:{count:searchIndex.length,entries:searchIndex,allLinksResolveToGeneratedPages:searchIndex.every((item)=>pageIds.has(item.id)&&Boolean(item.href))},category:{groups:categoryGroups},navigation:{itemPageIds:navigationItems.map((item)=>item.pageId),allPageIdsExist:navigationItems.every((item)=>!item.pageId||pageIds.has(item.pageId)),browsePageIds:browsePages.map((page)=>page.id)}} ,null,2)+'\n');
writeFileSync(path.join(outputDir,'sparse-site.json'),JSON.stringify({input:{pageIds:sparse.pages.map((page)=>page.id)},homepage:{pageIds:sparse.homepage.pageIds,sections:{startHere:sparseOrdered.slice(1,3).map((page)=>page.id),browse:sparseNavIds}},search:{count:sparse.pages.length,pageIds:sparse.pages.map((page)=>page.id)},category:{groups:sparseGroups},navigation:{pageIds:sparseNavIds,allPageIdsExist:sparseNavIds.every((id)=>sparse.pages.some((page)=>page.id===id))},noEmberfallFallback:!JSON.stringify(sparse).toLowerCase().includes('emberfall')},null,2)+'\n');
writeFileSync(path.join(outputDir,'cleanroom-output.json'),JSON.stringify({root:cleanroomRoot,pages:cleanroom},null,2)+'\n');
writeFileSync(path.join(outputDir,'hardcoded-scan.json'),JSON.stringify({files:surfaceFiles,fixtureIdsFound:knownFixtureIds.filter((id:string)=>surfaceSource.includes(id)),emberfallLiteralFound:/emberfall/i.test(surfaceSource),exampleGameLiteralFound:/example game/i.test(surfaceSource),staticPageArrayFallback:/generated\.pages\[0\]|generated\.pages\.slice/.test(surfaceSource),emptySectionGuards:{homepage:/startHere\.length > 0/.test(surfaceSource),browse:/browseGroups\.length > 0/.test(surfaceSource),category:/filter\(\(group\) => group\.ids\.length > 0\)/.test(surfaceSource)},surfacesUseGeneratedData:surfaceFiles.every((file)=>readFileSync(file,'utf8').includes('generated'))},null,2)+'\n');
console.log(JSON.stringify({emberfallPages:generated.pages.length,searchEntries:searchIndex.length,categoryGroups:categoryGroups.length,cleanroomBrokenLinks:cleanroom.flatMap((page)=>page.brokenInternalHrefs),sparsePages:sparse.pages.length,sparseSearchEntries:sparse.pages.length,sparseCategoryGroups:sparseGroups.length},null,2));
