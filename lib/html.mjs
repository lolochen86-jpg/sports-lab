const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',rsquo:'’'};
export const decode=s=>String(s??'').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,k)=>k[0]==='#'?String.fromCodePoint(Math.min(1114111,parseInt(k.slice(k[1]?.toLowerCase()==='x'?2:1),k[1]?.toLowerCase()==='x'?16:10)||32)):(entities[k]??m));
export function htmlTree(input){
 const root={tag:'root',attrs:{},children:[]};let stack=[root];
 const html=String(input).replace(/<!--[^]*?-->/g,'').replace(/<(script|style)\b[^>]*>[^]*?<\/\1>/gi,'');
 for(const token of html.match(/<[^>]+>|[^<]+/g)??[]){
  if(token.startsWith('</')){const tag=token.match(/^<\/\s*([^\s>]+)/)?.[1]?.toLowerCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tag===tag){stack.length=i;break;}continue;}
  if(token.startsWith('<!')||token.startsWith('<?'))continue;
  if(token.startsWith('<')){const tag=token.match(/^<\s*([^\s/>]+)/)?.[1]?.toLowerCase();if(!tag)continue;const attrs={};for(const m of token.slice(tag.length+1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]??'');const node={tag,attrs,children:[]};Object.defineProperty(node,'parent',{value:stack.at(-1)});stack.at(-1).children.push(node);if(!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag)&&!token.endsWith('/>'))stack.push(node);
  }else stack.at(-1).children.push(decode(token));
 }
 return root;
}
export const text=node=>typeof node==='string'?node:(node?.children??[]).map(text).join(' ').replace(/\s+/g,' ').trim();
export const hasClass=(node,name)=>(node?.attrs?.class??'').split(/\s+/).includes(name);
export function findAll(node,predicate){const out=[];for(const child of node?.children??[])if(typeof child!=='string'){if(predicate(child))out.push(child);out.push(...findAll(child,predicate));}return out;}
export const tag=(node,name)=>findAll(node,n=>n.tag===name);
export const cls=(node,name)=>findAll(node,n=>hasClass(n,name));
