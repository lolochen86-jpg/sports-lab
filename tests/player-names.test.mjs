import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePlayerChinese,playerChineseText,playerBilingualText,composeTentativeName,playerNameCreditHtml} from '../public/player-names.js';
import {externalPredictionCard} from '../public/prediction-provider.js';
test('keeps known NBA names before Wikidata and retains English',()=>{
 const a=resolvePlayerChinese({name:'LeBron James',id:'1966',league:'NBA'});
 assert.equal(a.kind,'curated');assert.ok(a.zh);assert.match(playerBilingualText({name:'LeBron James',id:'1966',league:'NBA'}),/LeBron James/);
 assert.notEqual(resolvePlayerChinese({name:'LeBron James',id:'1966',league:'MLB'}).kind,'curated');
});
test('combines only wholly known tokens and marks a guess',()=>{
 const a=resolvePlayerChinese({name:'John Smith',league:'MLB'});
 assert.equal(a.kind,'provisional');assert.match(playerChineseText({name:'John Smith',league:'MLB'}),/暫定音譯/);
 assert.equal(composeTentativeName('Qqzzyy Zzx'),null);assert.equal(playerBilingualText({name:'Qqzzyy Zzx',league:'MLB'}),'中文譯名待確認 / Qqzzyy Zzx');
});
test('uses Onomaverse only as a labelled fallback and displays its attribution',()=>{
 assert.deepEqual(resolvePlayerChinese({name:'Juan Burgos',league:'MLB'}),{zh:'胡安·布爾戈斯',kind:'provisional'});
 assert.match(playerChineseText({name:'Juan Burgos',league:'MLB'}),/暫定音譯/);
 assert.match(playerNameCreditHtml,/Names data from/);assert.match(playerNameCreditHtml,/https:\/\/onomaverse\.com\/datasets/);assert.match(playerNameCreditHtml,/CC BY 4\.0/);assert.match(playerNameCreditHtml,/簡體轉繁體/);
});
test('handles suffix and rejects untrusted markup',()=>{
 assert.equal(composeTentativeName('Michael Brown Jr.'),'小麥可·布朗');assert.equal(composeTentativeName('<script>Michael Brown</script>'),null);
});
test('external injury names remain escaped and English remains',()=>{
 const forecast={league:'NBA',awayOut:['<script>'],homeOut:['John Smith']};
 const html=externalPredictionCard(forecast,null,{playerName:x=>playerChineseText({...x,league:'NBA'})});
 assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/John Smith/);assert.match(html,/暫定音譯/);
});

test('uses a verified MLB ID and name without marking Ohtani provisional',()=>{
 assert.deepEqual(resolvePlayerChinese({name:'Shohei Ohtani',id:'660271',league:'MLB'}),{zh:'大谷翔平',kind:'curated'});
 assert.deepEqual(resolvePlayerChinese({name:'Aaron Judge',id:'592450',league:'MLB'}),{zh:'亞倫·賈吉',kind:'curated'});
 assert.notEqual(resolvePlayerChinese({name:'Another Player',id:'592450',league:'MLB'}).zh,'亞倫·賈吉');
});
