/** Deterministic zero-dependency build for the native ESM frontend.
 * Browser imports remain ESM modules. Vercel serves dist/ + api/ functions.
 */
import {cp,copyFile,mkdir,rm,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist=path.join(root,'dist');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await copyFile(path.join(root,'index.html'),path.join(dist,'index.html'));
await cp(path.join(root,'src'),path.join(dist,'src'),{recursive:true});
await cp(path.join(root,'public'),dist,{recursive:true});
for(const name of ['index.html','src/main.js','src/core.js','src/importExcel.js','src/style.css','seed.json','release.json'])await stat(path.join(dist,name));
console.log(`Smart TKB 1.8.4: built dist/ without external bundler. Files are ready for Vercel.`);
