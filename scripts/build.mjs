import {mkdir,readFile,cp,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateDashboard} from '../lib/validate.mjs';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function build(){const data=validateDashboard(JSON.parse(await readFile(path.join(root,'data/dashboard.json'),'utf8')));await mkdir(path.join(root,'dist/data'),{recursive:true});await cp(path.join(root,'public'),path.join(root,'dist'),{recursive:true});await writeFile(path.join(root,'dist/data/dashboard.json'),JSON.stringify(data));await writeFile(path.join(root,'dist/.nojekyll'),'');console.log(`Sports Lab built: ${data.games.length} games, ${data.collection.activeProviderCount} providers`);}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))build().catch(e=>{console.error(e.message);process.exitCode=1;});
