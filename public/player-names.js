import {players,playerIds} from './localization.js';
import {provisionalNames} from './translated-names.js';
import {wikidataNbaNames,wikidataMlbNames} from './wikidata-player-names.js';
import {curatedNameTokens} from './name-token-data.js';
import {onomaverseNameTokens} from './onomaverse-name-tokens.js';

// Automatically composed names are explicitly labelled and never overwrite
// curated or Wikidata names. Only complete, unambiguous token matches count.
const norm = x => String(x ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const learned = new Map();
function learn(en, zh) {
 const words = String(en).trim().split(/\s+/), parts = String(zh).split(/[·・]/);
 if(words.length !== 2 || parts.length !== 2 || words.some(w=>!/^[\p{L}\p{M}'-]+$/u.test(w)) || parts.some(p=>!/^\p{Script=Han}+$/u.test(p))) return;
 for(let i=0;i<2;i++) { const key=norm(words[i]); if(!key) continue; const counts=learned.get(key)??new Map(); counts.set(parts[i],(counts.get(parts[i])??0)+1); learned.set(key,counts); }
}
for(const [name,value] of Object.entries(players))if(value?.name_zh)learn(name,value.name_zh);
for(const [name,value] of Object.entries(provisionalNames))learn(name,value);
const tokens = new Map();
for(const [name,counts] of learned){const best=[...counts].sort((a,b)=>b[1]-a[1]);if(best.length===1||best[0][1]>best[1][1])tokens.set(name,best[0][0]);}
// Public-domain dictionary tokens are provisional and fill only missing entries.
for(const [name,zh] of Object.entries(curatedNameTokens))if(!tokens.has(norm(name))&&/^\p{Script=Han}+$/u.test(zh))tokens.set(norm(name),zh);
for(const [name,zh] of Object.entries(onomaverseNameTokens))if(!tokens.has(norm(name))&&/^\p{Script=Han}+$/u.test(zh))tokens.set(norm(name),zh);
const manualProvisional={'Michael Ajayi':'麥可·阿賈伊'};
// Selected commonly used Traditional Chinese names matched to MLB player IDs.
// https://www.cna.com.tw/news/aspt/202502150017.aspx
// https://www.cna.com.tw/news/aspt/202602140170.aspx
// https://news.ttv.com.tw/news/11107110000300W/amp
const knownMlbPlayers={
 '660271':{name:'Shohei Ohtani',zh:'大谷翔平'},
 '808967':{name:'Yoshinobu Yamamoto',zh:'山本由伸'},
 '808963':{name:'Roki Sasaki',zh:'佐佐木朗希'},
 '592450':{name:'Aaron Judge',zh:'亞倫·賈吉'},
 '665742':{name:'Juan Soto',zh:'胡安·索托'},
 '605141':{name:'Mookie Betts',zh:'穆奇·貝茲'},
 '545361':{name:'Mike Trout',zh:'麥克·楚奧特'},
 '547180':{name:'Bryce Harper',zh:'布萊斯·哈波'}
};
const suffixes={jr:'小',sr:'老',ii:'二世',iii:'三世',iv:'四世',v:'五世'};
export function composeTentativeName(name){
 if(typeof name!=='string'||!name.trim()||!/^[-'.\p{L}\p{M}\s]+$/u.test(name))return null;
 const words=name.trim().split(/\s+/), rawSuffix=words.length>2?norm(words.at(-1)):'';
 let suffix='';if(Object.hasOwn(suffixes,rawSuffix)){suffix=suffixes[rawSuffix];words.pop();}
 if(words.length<2)return null;
 const out=[];
 for(const word of words){
  const direct=tokens.get(norm(word));if(direct){out.push(direct);continue;}
  const compound=word.split('-');if(compound.length<2)return null;
  const parts=compound.map(p=>tokens.get(norm(p)));if(parts.some(x=>!x))return null;out.push(parts.join('·'));
 }
 return suffix==='小'||suffix==='老'?`${suffix}${out.join('·')}`:`${out.join('·')}${suffix}`;
}
export function resolvePlayerChinese({name='',id=null,league='NBA'}={}){
 if(typeof name!=='string'||!name.trim())return {zh:null,kind:'missing'};
 const known=league==='NBA'?(players[name]?.name_zh || (id!=null?playerIds[String(id)]:null)):null;
 if(known)return {zh:known,kind:'curated'};
 const mlb=league==='MLB'&&id!=null?knownMlbPlayers[String(id)]:null;
 if(mlb&&norm(mlb.name)===norm(name))return {zh:mlb.zh,kind:'curated'};
 const wikidataName=id!=null?(league==='MLB'?wikidataMlbNames[String(id)]:wikidataNbaNames[String(id)]):null;
 if(wikidataName)return {zh:wikidataName,kind:'wikidata'};
 if(provisionalNames[name]||manualProvisional[name])return {zh:provisionalNames[name]||manualProvisional[name],kind:'provisional'};
 const zh=composeTentativeName(name);return zh?{zh,kind:'provisional'}:{zh:null,kind:'missing'};
}
export function playerChineseText(input){const r=resolvePlayerChinese(input);return r.zh?`${r.zh}${r.kind==='provisional'?'（暫定音譯）':''}`:'中文譯名待確認';}
export function playerBilingualText(input){return `${playerChineseText(input)} / ${input.name??''}`;}

export const playerNameCreditHtml=`<details class="notice"><summary>中文姓名與資料來源</summary><p>既有常用譯名優先；以詞件組合的姓名標示「暫定音譯」，可能與球員慣用譯名不同。無法合理組合者保留英文並標示待確認。</p><p>Names data from <a href="https://onomaverse.com/datasets" target="_blank" rel="noopener noreferrer">Onomaverse (https://onomaverse.com/datasets)</a>, licensed <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. 英文姓名詞件以 OpenCC 1.4.2 由簡體轉繁體，並篩除歧義及部分不適當譯法。</p><p>另參考 <a href="https://github.com/ssb22/CedPane" target="_blank" rel="noopener noreferrer">CedPane 名字字典</a>及 <a href="https://www.wikidata.org/wiki/Wikidata:Licensing" target="_blank" rel="noopener noreferrer">Wikidata 人物資料</a>。</p></details>`;
