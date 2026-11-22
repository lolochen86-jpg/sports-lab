import {test} from 'node:test';
import assert from 'node:assert/strict';
import {percentile,bar,radar} from '../public/analysis-charts.js';
test('percentile preserves negative impacts, ties and missing values',()=>{assert.equal(percentile(-2,[-2,0,2]),0);assert.equal(percentile(2,[-2,0,2]),100);assert.equal(percentile(0,[0,0,0]),50);assert.equal(percentile(null,[0,1]),null);assert.equal(percentile(1,[1]),null);});
test('charts distinguish zero and missing and escape labels',()=>{assert.match(bar('勝率',0,'','rate'),/0.0%/);assert.match(bar('勝率',null),/資料不足/);assert.match(bar('<img>',50),/&lt;img&gt;/);assert.doesNotMatch(bar('x',101),/width:/);assert.match(radar([{label:'a',percentile:0},{label:'b',percentile:50},{label:'c',percentile:100}]),/<svg/);assert.doesNotMatch(radar([{percentile:0},{percentile:null},{percentile:100}]),/<svg/);});
