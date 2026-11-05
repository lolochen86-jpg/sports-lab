import test from 'node:test';
import assert from 'node:assert/strict';
import {movements} from '../public/movements.js';
test('交易清單有日期及官方來源，並保留多次轉隊紀錄',()=>{
 assert.ok(movements.length>50);
 for(const row of movements){assert.match(row.date,/^2026-\d{2}-\d{2}$/);assert.ok(row.name&&row.from&&row.to&&row.from!==row.to);assert.match(row.source,/^https:\/\/(www\.)?(nba|mlb)\.com\//);}
 const green=movements.filter(x=>x.name==='Josh Green');assert.equal(green.length,2);assert.equal(green.find(x=>x.date==='2026-08-29').from,'MIN');
 assert.ok(movements.some(x=>x.name==='LeBron James'&&x.type.includes('自由球員')));
 assert.ok(movements.some(x=>x.league==='MLB'&&x.name==='Nate Eaton'));
});
