'use strict';
// NETWORK LAB：教材の課題は MISSIONS / TROUBLES、通信モデルは simulate() で変更できます。
const $ = id => document.getElementById(id);
const TYPES = {pc:'PC',switch:'スイッチ',router:'ルータ',server:'Webサーバ',internet:'インターネット'};
const ICONS = {
 pc:'<rect x="4" y="4" width="24" height="17" rx="2"/><path d="M12 27h8M16 21v6"/>',
 switch:'<rect x="3" y="10" width="26" height="14" rx="3"/><path d="M8 16h2m4 0h2m4 0h2M8 20h2m4 0h2m4 0h2M10 6h12"/>',
 router:'<rect x="3" y="14" width="26" height="12" rx="3"/><path d="M8 14V6m16 8V6M8 20h2m4 0h2m4 0h2M12 9l4-4 4 4m-4-4v7"/>',
 server:'<rect x="7" y="3" width="18" height="26" rx="3"/><path d="M7 12h18M7 21h18M11 8h1m-1 9h1m-1 8h1m5-17h4m-4 9h4m-4 8h4"/>',
 internet:'<path d="M9 25h15a6 6 0 0 0 1-12 9 9 0 0 0-17-2 7 7 0 0 0 1 14Z"/>'
};
const icon = type => `<span class="device-icon"><svg viewBox="0 0 32 32" aria-hidden="true">${ICONS[type]}</svg></span>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MASK = '255.255.255.0';
let sequence=0;
function device(type,name,x,y,ip='',gateway=''){
 return {id:`n${++sequence}`,type,name,x,y,ip,mask:MASK,gateway,lan:'192.168.1.1',wan:'192.168.2.1',wanMask:MASK,nat:true};
}
const MISSIONS = [
 {title:'同じネットワークをつくろう',description:'PC-AとPC-Bをスイッチにつなぎ、PC-Bのアドレスを設定して通信を成功させよう。',hints:['同じネットワークでは、ルータを使わず通信できます。まず配線とPC-Bの設定を確認しましょう。','PC-Aは192.168.1.10 /24。同じネットワークで、重ならないIPを選びます。','PC-Bを192.168.1.20、マスクを255.255.255.0に設定し、スイッチと接続します。ゲートウェイは空欄で構いません。'],kind:'lan'},
 {title:'別のネットワークへ届けよう',description:'192.168.1.0/24から192.168.2.0/24へ。PC-Aに適切な出口を設定し、ルータを通して通信しよう。',hints:['宛先が自分と異なるネットワークなら、デフォルトゲートウェイへ渡します。','PC-Aから見たルータのLAN側アドレスを調べましょう。応答にも戻りの経路が必要です。','PC-Aのデフォルトゲートウェイを192.168.1.1に設定します。PC-Bの出口は192.168.2.1です。'],kind:'route'},
 {title:'NATでインターネットへ',description:'プライベートIPのPCからWebサーバへ。ルータのNATを有効にし、送信元IPの変化を観察しよう。',hints:['インターネットへプライベートIPのまま送ることはできません。','ルータを選択し、NATの設定とWAN側IPを確認しましょう。','ルータの「NATを有効にする」にチェックして保存。192.168.1.10が203.0.113.10へ変換されます。'],kind:'nat'},
 {title:'マスクでネットワークを見分けよう',description:'同じスイッチにつながる192.168.1.10と192.168.1.150。両方のマスクを見直し、ルータなしで通信させよう。',hints:['物理的に同じスイッチでも、同じIPネットワークとは限りません。','/25（255.255.255.128）は、末尾が0〜127と128〜255でネットワークが分かれます。','両方のPCのサブネットマスクを255.255.255.0に変更します。片方だけでは応答が戻りません。'],kind:'mask'},
 {title:'自分のネットワークを完成させよう',description:'PC、スイッチ、ルータ、インターネット、Webサーバを接続。PCを設定して、NATを使う往復通信を完成させよう。',hints:['PC → スイッチ → ルータLAN、ルータWAN → インターネット → Webサーバの順につなぎます。','PCのIP・マスク・出口を設定し、ルータのNATを有効にしましょう。','PCは192.168.1.10 /24、出口192.168.1.1。ルータLANは192.168.1.1、WANは203.0.113.10。サーバは198.51.100.20です。'],kind:'build'}
];
const TROUBLES = [
 {title:'出口はどこ？',description:'PCからWebサーバに届きません。デフォルトゲートウェイの設定を調べて修正しよう。',hints:['PCのIPとゲートウェイは、同じネットワークにありますか？','PCの出口をルータのLAN側IP、192.168.1.1に合わせます。'],kind:'gateway'},
 {title:'同じ住所が2つある',description:'PC-AからPC-Bへの通信が不安定です。ネットワーク内のIPアドレスを確認しよう。',hints:['同じLANに同じIPアドレスの機器はありませんか？','PC-BのIPを192.168.1.20に変更しましょう。'],kind:'duplicate'},
 {title:'行けるのに、戻れない',description:'送信側の設定は正しそうです。応答を返すPC-Bの設定も確認してみよう。',hints:['通信の成功には、相手から応答が戻る必要があります。','PC-Bのゲートウェイを192.168.2.1に設定しましょう。'],kind:'return'},
 {title:'インターネットに出られない',description:'配線もPCの設定も正しいのに、外部のサーバに届きません。ルータで必要な処理を探そう。',hints:['インターネットへ出るパケットの送信元は、どのIPですか？','ルータのNATを有効にして、プライベートIPをWAN側IPへ変換します。'],kind:'nat'}
];
let state={mode:'learn',index:0,nodes:[],links:[],selected:null,connecting:false,first:null,hint:0};
let completed=new Set(),pendingConnection=null,animation=null,toastTimer=null;
function link(a,b,ap='',bp=''){return {id:`l${++sequence}`,a:a.id,b:b.id,ap,bp};}
function currentTask(){return state.mode==='trouble'?TROUBLES[state.index]:MISSIONS[state.index];}
function initial(kind){
 const a=device('pc','PC-A',.16,.36,'192.168.1.10');
 const b=device('pc','PC-B',.82,.36,'192.168.1.20');
 const sw=device('switch','スイッチ',.49,.58);
 const r=device('router','ルータ',.48,.36);
 const cloud=device('internet','インターネット',.72,.36);
 const web=device('server','Webサーバ',.84,.75,'198.51.100.20');
 if(['lan','mask','duplicate'].includes(kind)){
  if(kind==='lan')b.ip='';
  if(kind==='mask'){a.mask=b.mask='255.255.255.128';b.ip='192.168.1.150';}
  if(kind==='duplicate')b.ip=a.ip;
  return {nodes:[a,sw,b],links:kind==='lan'?[link(a,sw)]:[link(a,sw),link(sw,b)],source:a.id,destination:b.id};
 }
 if(['route','return'].includes(kind)){
  b.ip='192.168.2.10';b.gateway=kind==='return'?'':'192.168.2.1';a.gateway=kind==='return'?'192.168.1.1':'';r.nat=false;
  return {nodes:[a,r,b],links:[link(a,r,'','lan'),link(r,b,'wan','')],source:a.id,destination:b.id};
 }
 a.x=.14;a.y=.36;sw.x=.29;sw.y=.72;r.x=.48;r.y=.36;
 a.gateway=kind==='gateway'?'192.168.2.1':'192.168.1.1';r.wan='203.0.113.10';r.nat=kind==='gateway';
 if(kind==='build'){a.ip='';a.gateway='';}
 return {nodes:[a,sw,r,cloud,web],links:kind==='build'?[]:[link(a,sw),link(sw,r,'','lan'),link(r,cloud,'wan',''),link(cloud,web)],source:a.id,destination:web.id};
}
function loadTask(mode=state.mode,index=state.index){
 cancelAnimation();state={...state,mode,index,selected:null,connecting:false,first:null,hint:0};
 const setup=mode==='free'?{nodes:[],links:[],source:'',destination:''}:initial(currentTask().kind);
 Object.assign(state,setup);state.taskSource=state.source;state.taskDestination=state.destination;state.taskDevices=state.nodes.map(n=>n.id);state.selected=state.nodes.find(n=>n.type==='pc')?.id??null;
 renderAll();clearResult();
}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function renderAll(){
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',b.dataset.mode===state.mode);});
 const free=state.mode==='free',list=state.mode==='trouble'?TROUBLES:MISSIONS;
 $('missionLabel').textContent=free?'SANDBOX':`${state.mode==='trouble'?'TROUBLE':'MISSION'} ${String(state.index+1).padStart(2,'0')}`;
 $('missionTitle').textContent=free?'アイデアを、ネットワークに。':currentTask().title;
 $('missionDescription').textContent=free?'機器を追加して自由に構築。ルータのLAN／WANを使い分け、通信できる条件を探してみよう。':currentTask().description;
 $('missionSteps').innerHTML=free?'':list.map((_,i)=>`<button data-step="${i}" title="${esc(list[i].title)}" aria-label="${state.mode==='trouble'?'トラブル':'MISSION'} ${i+1}" ${i===state.index?'aria-current="step"':''} class="${i===state.index?'current ':''}${completed.has(`${state.mode}:${i}`)?'done':''}">${completed.has(`${state.mode}:${i}`)?'✓':i+1}</button>`).join('');
 $('previous').disabled=free||state.index===0;$('next').disabled=free||state.index===list.length-1;
 $('hint').hidden=true;$('progress').textContent=`${[...completed].filter(s=>s.startsWith('learn:')).length} / 5 MISSION CLEAR`;
 renderNodes();renderSettings();renderSelectors();renderConnect();
}
function renderNodes(){
 $('nodes').innerHTML=state.nodes.map(n=>`<button class="node type-${n.type} ${n.id===state.selected?'selected':''} ${n.id===state.first?'connecting':''}" data-node="${n.id}" style="left:${n.x*100}%;top:${n.y*100}%" aria-label="${esc(n.name)}の設定">${icon(n.type)}<strong>${esc(n.name)}</strong><span class="address">${esc(n.type==='router'?n.lan:n.ip||(['pc','server'].includes(n.type)?'IP 未設定':'—'))}</span><span class="type-badge">${n.type==='router'?'LAN / WAN':n.type.toUpperCase()}</span></button>`).join('');
 $('deviceCount').textContent=`${state.nodes.length} デバイス / ${state.links.length} 接続`;$('emptyCanvas').hidden=state.nodes.length>0;renderWires();
}
function renderWires(){
 const w=$('canvas').clientWidth,h=$('canvas').clientHeight;
 $('wires').innerHTML=state.links.map(l=>{
 const a=state.nodes.find(n=>n.id===l.a),b=state.nodes.find(n=>n.id===l.b);if(!a||!b)return '';
 const x1=a.x*w,y1=a.y*h,x2=b.x*w,y2=b.y*h;
 const label=[l.ap&&`${a.name} ${l.ap.toUpperCase()}`,l.bp&&`${b.name} ${l.bp.toUpperCase()}`].filter(Boolean).join(' / ');
 return `<g class="wire-group" data-link="${l.id}" tabindex="0" role="button" aria-label="${esc(a.name)}と${esc(b.name)}の接続を削除"><title>クリックして接続を削除</title><line class="wire" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="wire-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="wire-label" x="${(x1+x2)/2}" y="${(y1+y2)/2-8}" text-anchor="middle">${esc(label)}</text></g>`;
 }).join('');
}
function field(label,key,value,placeholder=''){return `<label>${label}<input name="${key}" class="${key==='name'?'':'address-input'}" value="${esc(value)}" placeholder="${placeholder}" ${key==='name'?'maxlength="30" required':'inputmode="decimal" maxlength="15"'} autocomplete="off" spellcheck="false"></label>`;}
function renderSettings(){
 const n=state.nodes.find(n=>n.id===state.selected);
 if(!n){$('settings').innerHTML='<p class="helper">キャンバスの機器を選ぶと、設定を編集できます。</p>';return;}
 let fields=field('デバイス名','name',n.name);
 if(n.type==='router')fields+=field('LAN側 IPv4アドレス','lan',n.lan)+field('LAN側 サブネットマスク','mask',n.mask)+field('WAN側 IPv4アドレス','wan',n.wan)+field('WAN側 サブネットマスク','wanMask',n.wanMask)+`<label class="check-label"><input type="checkbox" name="nat" ${n.nat?'checked':''}>NATを有効にする</label>`;
 if(['pc','server'].includes(n.type))fields+=field('IPv4アドレス','ip',n.ip,'例：192.168.1.20')+field('サブネットマスク','mask',n.mask,MASK)+field('デフォルトゲートウェイ','gateway',n.gateway,'同じLAN内だけなら不要');
 const ip=n.type==='router'?n.lan:n.ip;
 let info=ip&&ipv4(ip)!==null&&maskBits(n.mask)!==null?`ネットワーク：${network(ip,n.mask)}/${maskBits(n.mask)}<br>${privateIP(ip)?'プライベートIP':documentationIP(ip)?'説明用IP（グローバルIP役）':'プライベートIP以外'}`:'';
 if(n.type==='switch')info='スイッチは同じLAN内の機器を中継します。この教材では管理用IPを設定しません。';
 if(n.type==='internet')info='事業者側の経路をまとめたモデルです。ルータWANとWebサーバを接続してください。';
 $('settings').innerHTML=`<form id="configForm"><div class="selected-summary">${icon(n.type)}<div><strong>${esc(n.name)}</strong><small>${TYPES[n.type]}</small></div></div>${fields}${info?`<div class="network-info">${info}</div>`:''}<p id="formError" class="form-error" role="alert" hidden></p><div class="form-buttons"><button type="submit" class="primary">設定を保存</button><button type="button" id="deleteDevice" class="danger">削除</button></div></form>`;
 $('configForm').addEventListener('submit',saveConfig);$('deleteDevice').onclick=()=>{invalidate();state.nodes=state.nodes.filter(d=>d.id!==n.id);state.links=state.links.filter(l=>l.a!==n.id&&l.b!==n.id);state.selected=null;state.first=null;state.connecting=false;renderConnect();renderNodes();renderSettings();renderSelectors();};
}
function saveConfig(e){
 e.preventDefault();const n=state.nodes.find(n=>n.id===state.selected),data=new FormData(e.target),next={...n};
 for(const [k,v]of data)next[k]=v.trim();next.name=next.name.trim();if(n.type==='router')next.nat=data.has('nat');
 let error='';if(!next.name)error='デバイス名を入力してください。';
 for(const key of ['ip','lan','wan','gateway'])if(data.has(key)&&next[key]&&ipv4(next[key])===null)error='IPv4アドレスは0〜255の整数4つを「.」で区切って入力してください。';
 for(const key of ['ip','lan','wan','gateway'])if(data.has(key)&&next[key]&&ipv4(next[key])!==null)next[key]=dotted(ipv4(next[key]));
 for(const key of ['mask','wanMask'])if(data.has(key)&&maskBits(next[key])===null)error='マスクは連続した1と0で表す /1〜/30 を指定してください（例：255.255.255.0）。';
 if(error){$('formError').textContent=error;$('formError').hidden=false;return;}
 invalidate();Object.assign(n,next);renderNodes();renderSettings();renderSelectors();toast('設定を保存しました。通信テストで確認しましょう。');
}
function renderSelectors(){
 const endpoints=state.nodes.filter(n=>['pc','server'].includes(n.type));
 for(const id of ['source','destination']){
 let chosen=state[id];if(!endpoints.some(n=>n.id===chosen))chosen=(id==='source'?endpoints[0]:endpoints[1]||endpoints[0])?.id||'';
 $(id).innerHTML=endpoints.length?endpoints.map(n=>`<option value="${n.id}" ${n.id===chosen?'selected':''}>${esc(n.name)}</option>`).join(''):'<option value="">機器を追加</option>';state[id]=chosen;
 }
 $('testButton').disabled=endpoints.length<2;
}
function renderConnect(){
 $('connectButton').setAttribute('aria-pressed',state.connecting);$('connectHelp').hidden=!state.connecting;
 $('connectHelp').textContent=state.first?'続いて、接続先の機器を選んでください。':'接続する機器を2台選んでください。';
}
function selectNode(id){
 if(state.connecting){if(!state.first){state.first=id;renderNodes();renderConnect();return;}if(id===state.first){toast('別の機器を選んでください。');return;}pendingConnection=[state.first,id];
 const nodes=pendingConnection.map(key=>state.nodes.find(n=>n.id===key));
 $('portFields').innerHTML=nodes.map((n,i)=>`<label>${esc(n.name)}<select name="port${i}">${n.type==='router'?'<option value="lan">LAN</option><option value="wan">WAN</option>':'<option value="">ネットワークポート</option>'}</select></label>`).join('');$('connectDialog').showModal();return;}
 state.selected=id;renderNodes();renderSettings();document.querySelector(`[data-node="${id}"]`)?.focus({preventScroll:true});
}
function addDevice(type,x,y){
 if(state.nodes.length>=24){toast('このキャンバスは24台まで配置できます。');return;}
 invalidate();const count=state.nodes.filter(n=>n.type===type).length+1;
 const n=device(type,`${TYPES[type]}-${count}`,x??(.16+((state.nodes.length%4)*.21)),y??(.22+(Math.floor(state.nodes.length/4)%3)*.27));
 if(type==='router'){n.lan='';n.wan='';}state.nodes.push(n);state.selected=n.id;renderNodes();renderSettings();renderSelectors();
}
// IPv4は符号なし32ビットで比較。末尾1バイトの比較だけで判定しないことが重要です。
function ipv4(s){if(typeof s!=='string'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(s))return null;const a=s.split('.').map(Number);return a.some(x=>x>255)?null:a.reduce((v,x)=>(v*256+x)>>>0,0);}
function maskBits(s){const n=ipv4(s);if(n===null)return null;const b=n.toString(2).padStart(32,'0');if(!/^1+0+$/.test(b))return null;const p=b.indexOf('0');return p>=1&&p<=30?p:null;}
function dotted(n){return [24,16,8,0].map(s=>(n>>>s)&255).join('.');}
function sameNetwork(a,b,m){return ipv4(a)!==null&&ipv4(b)!==null&&maskBits(m)!==null&&((ipv4(a)&ipv4(m))>>>0)===((ipv4(b)&ipv4(m))>>>0);}
function network(a,m){return dotted((ipv4(a)&ipv4(m))>>>0);}
function privateIP(s){const n=ipv4(s);return n!==null&&((n>>>24)===10||(n>>>20)===0xac1||(n>>>16)===0xc0a8);}
function documentationIP(s){return ['192.0.2.','198.51.100.','203.0.113.'].some(p=>s.startsWith(p));}
function usable(ip,mask){const n=ipv4(ip),m=ipv4(mask);if(n===null)return 'IPアドレスが未設定、または形式が正しくありません。';if(maskBits(mask)===null)return 'サブネットマスクは /1〜/30 の連続した値を設定してください。';if((n>>>24)===0||(n>>>24)===127||(n>>>24)>=224||((n>>>16)===0xa9fe))return 'この教材では通常のユニキャストIPv4アドレスを使用してください。';const host=(n&(~m))>>>0;if(host===0||host===((~m)>>>0))return 'ネットワークアドレスまたはブロードキャストアドレスは機器に設定できません。';return '';}
// 接続グラフではルータのLANとWANを別頂点にする。スイッチだけが同一LANを中継します。
function buildGraph(nodes,links){
 const graph=new Map(),interfaces=[];const byId=new Map(nodes.map(n=>[n.id,n]));
 const key=(n,p='')=>n.type==='router'?`${n.id}:${p}`:n.id;
 for(const n of nodes){if(n.type==='router'){for(const p of ['lan','wan']){const k=key(n,p);graph.set(k,[]);interfaces.push({key:k,node:n,port:p,ip:n[p],mask:p==='lan'?n.mask:n.wanMask});}}else{graph.set(n.id,[]);if(['pc','server'].includes(n.type))interfaces.push({key:n.id,node:n,port:'',ip:n.ip,mask:n.mask});}}
 for(const l of links){const a=byId.get(l.a),b=byId.get(l.b);if(!a||!b)continue;const ak=key(a,l.ap),bk=key(b,l.bp);if(graph.has(ak)&&graph.has(bk)){graph.get(ak).push(bk);graph.get(bk).push(ak);}}
 function path(start,end,allowCloud=false){const queue=[[start]],seen=new Set([start]);while(queue.length){const p=queue.shift(),last=p[p.length-1];if(last===end)return p;const node=byId.get(last.split(':')[0]);if(last!==start&&node.type!=='switch'&&!(allowCloud&&node.type==='internet'))continue;for(const next of graph.get(last)||[])if(!seen.has(next)){seen.add(next);queue.push([...p,next]);}}return null;}
 function cloudAttached(k){return nodes.some(n=>n.type==='internet'&&path(k,n.id));}
 return {graph,interfaces,byId,path,cloudAttached};
}
function simulate(nodes,links,sourceId,destinationId){
 const g=buildGraph(nodes,links),src=g.interfaces.find(i=>i.key===sourceId),dst=g.interfaces.find(i=>i.key===destinationId),steps=[],natSessions=[];
 let phase='往路',usedRouter=false,usedNAT=false,usedCloud=false;
 const fail=message=>{throw new Error(message);};
 function verify(i){const error=usable(i.ip,i.mask);if(error)fail(`${i.node.name}${i.port?' '+i.port.toUpperCase():''}：${error}`);const duplicate=g.interfaces.find(j=>j.key!==i.key&&ipv4(j.ip)===ipv4(i.ip)&&g.path(i.key,j.key,true));if(duplicate)fail(`IPアドレス重複：${i.node.name}と${duplicate.node.name}が同じ ${i.ip} を使用しています。`);}
 function record(text,path,packet){steps.push({text:`${phase} · ${text}`,path:path.map(k=>k.split(':')[0]),src:packet.src,dst:packet.dst,phase});}
 function transfer(from,to,packet,allowCloud=false){
 verify(from);verify(to);const p=g.path(from.key,to.key,allowCloud);if(!p)fail(`${from.node.name}から${to.node.name}へ接続がありません。配線とルータのLAN／WANポートを確認してください。`);
 const cloud=p.some(k=>g.byId.get(k.split(':')[0]).type==='internet');
 if(cloud){usedCloud=true;if(privateIP(packet.src)||privateIP(packet.dst))fail('プライベートIPのままインターネットへ転送できません。ルータのNATとWAN側IPを確認してください。');}
 record(`${from.node.name} → ${to.node.name}${cloud?'（インターネット）':''}`,p,packet);return to;
 }
 function publicTarget(from,ip){return g.interfaces.find(i=>i.ip===ip&&g.path(from.key,i.key,true)&&g.cloudAttached(i.key));}
 function route(start,target,packet){
 let current=start;const seen=new Set();
 for(let ttl=0;ttl<16;ttl++){
 verify(current);const mark=`${current.key}/${packet.dst}`;if(seen.has(mark))fail('経路が循環しています。ルータのアドレスと配線を確認してください。');seen.add(mark);
 if(current.key===target.key&&packet.dst===target.ip){record(`${target.node.name}に到着`,[target.key],packet);return;}
 if(current.node.type!=='router'){
  // インターネットに直結したサーバは、事業者ゲートウェイをモデル内で補います。
  if(g.cloudAttached(current.key)){
   const to=publicTarget(current,packet.dst);if(!to)fail('インターネット側に宛先への経路がありません。配線とWAN側IPを確認してください。');
   current=transfer(current,to,packet,true);continue;
  }
  if(sameNetwork(current.ip,packet.dst,current.mask)){
   record(`${network(current.ip,current.mask)}/${maskBits(current.mask)} 内と判断。ゲートウェイを使わず直接送信`,[current.key],packet);
   const to=g.interfaces.find(i=>i.ip===packet.dst&&g.path(current.key,i.key));
   if(!to)fail(`${current.node.name}は宛先を同じネットワークと判断しましたが、同じLAN内に届きません。マスクと配線を確認してください。`);
   current=transfer(current,to,packet);continue;
  }
  const gw=current.node.gateway;if(!gw)fail(`${current.node.name}：宛先は異なるネットワークですが、デフォルトゲートウェイが未設定です。`);
  if(!sameNetwork(current.ip,gw,current.mask))fail(`${current.node.name}：ゲートウェイ ${gw} は自分のネットワーク内にありません。`);
  const to=g.interfaces.find(i=>i.node.type==='router'&&i.ip===gw&&g.path(current.key,i.key));if(!to)fail(`${current.node.name}：ゲートウェイ ${gw} のルータに届きません。アドレス・配線・ポートを確認してください。`);
  record(`宛先は別ネットワーク。出口 ${gw} へ`,[current.key],packet);current=transfer(current,to,packet);continue;
 }
 usedRouter=true;const r=current.node,lan=g.interfaces.find(i=>i.key===`${r.id}:lan`),wan=g.interfaces.find(i=>i.key===`${r.id}:wan`);verify(lan);verify(wan);
 if(sameNetwork(lan.ip,wan.ip,lan.mask)||sameNetwork(lan.ip,wan.ip,wan.mask))fail(`${r.name}：LAN側とWAN側のネットワークが重複しています。`);
 const reverse=phase==='復路'&&natSessions.find(n=>n.router===r.id&&n.public===packet.dst);
 if(reverse){packet.dst=reverse.private;record(`NAT 逆変換：宛先 ${reverse.public} → ${reverse.private}`,[current.key],packet);}
 const exits=[lan,wan].filter(i=>sameNetwork(i.ip,packet.dst,i.mask)).sort((a,b)=>maskBits(b.mask)-maskBits(a.mask));
 let out=exits[0],to=null,viaCloud=false;
 if(out){to=g.interfaces.find(i=>i.ip===packet.dst&&g.path(out.key,i.key));if(!to&&g.cloudAttached(out.key)){to=publicTarget(out,packet.dst);viaCloud=true;}}
 else if(g.cloudAttached(wan.key)){out=wan;to=publicTarget(out,packet.dst);viaCloud=true;}
 if(!out)fail(`${r.name}：宛先 ${packet.dst} への経路がありません。この教材のルータは直結ネットワークとインターネットへの経路を扱います。`);
 if(!to)fail(`${r.name}：${out.port.toUpperCase()}側から宛先へ届きません。接続先のアドレス・配線を確認してください。`);
 if(current.port==='lan'&&out.port==='wan'&&r.nat&&phase==='往路'){
  const old=packet.src;packet.src=wan.ip;natSessions.push({router:r.id,private:old,public:wan.ip});usedNAT=true;record(`NAT：送信元 ${old} → ${wan.ip}`,[r.id],packet);
 }
 current=transfer(out,to,packet,viaCloud);
 }
 fail('中継回数の上限に達しました。構成を簡単にして確認してください。');
 }
 try{
 if(!src||!dst)fail('送信元と宛先にPCまたはWebサーバを選んでください。');if(sourceId===destinationId)fail('異なる2台の機器を選んでください。');verify(src);verify(dst);
 const packet={src:src.ip,dst:dst.ip};route(src,dst,packet);
 phase='復路';const response={src:dst.ip,dst:packet.src};record('応答パケットを返します',[dst.key],response);route(dst,src,response);
 return {ok:true,message:'応答が送信元まで戻りました。往路・復路ともに通信成功です。',steps,usedRouter,usedNAT,usedCloud};
 }catch(error){steps.push({text:`${phase} · 停止：${error.message}`,path:[],phase});return {ok:false,message:`${phase}：${error.message}`,steps,usedRouter,usedNAT,usedCloud};}
}
function clearResult(){
 $('result').className='result';$('result').innerHTML='<span class="result-icon">↗</span><div><strong>準備ができたら、通信テスト。</strong><p>設定を保存してからテストしましょう。往路と復路の両方を確認します。</p></div>';$('trace').innerHTML='';$('packetInfo').hidden=true;
}
function invalidate(){cancelAnimation();clearResult();}
function cancelAnimation(){if(animation)cancelAnimationFrame(animation.frame);animation=null;$('packet').hidden=true;$('pauseButton').disabled=true;$('pauseButton').textContent='一時停止';$('testButton').textContent='▷ 通信テスト';}
function missionClear(result){
 if(state.mode==='free'||!result.ok)return false;
 // 初期課題の機器IDで判定するため、名前を変更してもクリア条件は変わりません。
 const pair=state.source===state.taskSource&&state.destination===state.taskDestination;
 if(!pair)return false;const kind=currentTask().kind;
 if(kind==='build')return result.usedNAT&&result.usedCloud&&state.taskDevices.every(id=>result.steps.some(s=>s.path.includes(id)));
 if(['nat','gateway'].includes(kind))return result.usedNAT&&result.usedCloud;
 if(['route','return'].includes(kind))return result.usedRouter;
 if(['lan','mask','duplicate'].includes(kind))return !result.usedRouter&&result.steps.some(s=>s.path.some(id=>state.nodes.find(n=>n.id===id)?.type==='switch'));
 return true;
}
function finishTest(result){
 const clear=missionClear(result);if(clear){completed.add(`${state.mode}:${state.index}`);$('progress').textContent=`${[...completed].filter(s=>s.startsWith('learn:')).length} / 5 MISSION CLEAR`;const step=document.querySelector(`[data-step="${state.index}"]`);if(step){step.classList.add('done');step.textContent='✓';}}
 const title=result.ok?(clear?(state.mode==='trouble'?'解決！ · 通信成功！':'MISSION CLEAR · 通信成功！'):'通信成功！'):'通信できませんでした';
 let explanation=result.message;if(result.ok&&state.mode!=='free'&&!clear)explanation+=' 課題クリアには、最初に指定された2台と課題の条件でテストしてください。';
 $('result').className=`result ${result.ok?'success':'failure'}`;$('result').innerHTML=`<span class="result-icon">${result.ok?'✓':'!'}</span><div><strong>${title}</strong><p>${esc(explanation)}</p></div>`;
 $('pauseButton').disabled=true;$('testButton').textContent='▷ もう一度テスト';$('packet').hidden=true;animation=null;
}
function startTest(){
 cancelAnimation();const result=simulate(state.nodes,state.links,state.source,state.destination);
 $('result').className='result';$('result').innerHTML='<span class="result-icon">↗</span><div><strong>通信経路を確認しています…</strong><p>各ステップの送信元・宛先IPと、判断の理由を観察しましょう。</p></div>';
 $('trace').innerHTML=result.steps.map((s,i)=>`<li data-trace="${i}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(s.text)}</span></li>`).join('');
 const segments=[];result.steps.forEach((s,i)=>{if(s.path.length<2)segments.push({step:i,a:s.path[0],b:s.path[0]});else for(let j=0;j<s.path.length-1;j++)segments.push({step:i,a:s.path[j],b:s.path[j+1]});});
 animation={result,segments,pos:0,elapsed:0,last:0,paused:false,frame:0};$('pauseButton').disabled=false;$('testButton').textContent='↻ 最初から再生';animation.frame=requestAnimationFrame(tick);
}
function tick(now){
 if(!animation)return;const a=animation;if(a.last&&!a.paused)a.elapsed+=Math.min(now-a.last,100);a.last=now;
 if(!a.paused){
 const segment=a.segments[a.pos];if(!segment){finishTest(a.result);return;}
 const duration=Number($('speed').value),t=Math.min(a.elapsed/duration,1),s=a.result.steps[segment.step];
 document.querySelectorAll('[data-trace]').forEach(el=>el.classList.toggle('active',Number(el.dataset.trace)===segment.step));
 $('packetInfo').hidden=false;$('packetInfo').textContent=s.src?`${s.phase}　送信元：${s.src}　 →　宛先：${s.dst}　｜　${s.text}`:s.text;
 const from=state.nodes.find(n=>n.id===segment.a),to=state.nodes.find(n=>n.id===segment.b);
 $('packet').hidden=!from||!to;if(from&&to){$('packet').style.left=`${(from.x+(to.x-from.x)*t)*100}%`;$('packet').style.top=`${(from.y+(to.y-from.y)*t)*100}%`;}
 if(t>=1){a.pos++;a.elapsed=0;}
 }
 a.frame=requestAnimationFrame(tick);
}
// UIイベント：ユーザーの入力はHTMLへ挿入する前に必ずエスケープします。
$('palette').innerHTML=Object.entries(TYPES).map(([type,name])=>`<div class="palette-device" draggable="true" data-type="${type}">${icon(type)}<strong>${name}</strong><button data-add="${type}" aria-label="${name}を追加">追加</button></div>`).join('');
$('palette').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(b)addDevice(b.dataset.add);});
$('palette').addEventListener('dragstart',e=>{const d=e.target.closest('[data-type]');if(d)e.dataTransfer.setData('text/plain',d.dataset.type);});
$('canvas').addEventListener('dragover',e=>e.preventDefault());$('canvas').addEventListener('drop',e=>{e.preventDefault();const type=e.dataTransfer.getData('text/plain');if(!TYPES[type])return;const r=$('canvas').getBoundingClientRect();addDevice(type,Math.max(.13,Math.min(.87,(e.clientX-r.left)/r.width)),Math.max(.15,Math.min(.85,(e.clientY-r.top)/r.height)));});
let drag=null,suppressClick=false;
$('nodes').addEventListener('pointerdown',e=>{const el=e.target.closest('[data-node]');if(!el||state.connecting||e.button!==0)return;const n=state.nodes.find(n=>n.id===el.dataset.node);drag={id:n.id,el,startX:e.clientX,startY:e.clientY,x:n.x,y:n.y,moved:false};el.setPointerCapture(e.pointerId);});
$('nodes').addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.abs(dx)+Math.abs(dy)<5&&!drag.moved)return;drag.moved=true;const n=state.nodes.find(n=>n.id===drag.id),w=$('canvas').clientWidth,h=$('canvas').clientHeight;n.x=Math.max(70/w,Math.min(1-70/w,drag.x+dx/w));n.y=Math.max(65/h,Math.min(1-65/h,drag.y+dy/h));drag.el.style.left=`${n.x*100}%`;drag.el.style.top=`${n.y*100}%`;renderWires();});
$('nodes').addEventListener('pointerup',()=>{if(drag?.moved){suppressClick=true;setTimeout(()=>suppressClick=false,0);}drag=null;});$('nodes').addEventListener('pointercancel',()=>drag=null);
$('nodes').addEventListener('click',e=>{if(suppressClick)return;const el=e.target.closest('[data-node]');if(el)selectNode(el.dataset.node);});
$('nodes').addEventListener('keydown',e=>{const el=e.target.closest('[data-node]');if(!el||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const n=state.nodes.find(n=>n.id===el.dataset.node);n.x=Math.max(.13,Math.min(.87,n.x+(e.key==='ArrowRight'?.025:e.key==='ArrowLeft'?-.025:0)));n.y=Math.max(.15,Math.min(.85,n.y+(e.key==='ArrowDown'?.025:e.key==='ArrowUp'?-.025:0)));renderNodes();document.querySelector(`[data-node="${n.id}"]`).focus();});
function removeWire(e){const el=e.target.closest('[data-link]');if(!el)return;invalidate();state.links=state.links.filter(l=>l.id!==el.dataset.link);renderNodes();toast('接続を削除しました。');}
$('wires').addEventListener('click',removeWire);$('wires').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();removeWire(e);}});
$('connectButton').onclick=()=>{state.connecting=!state.connecting;state.first=null;renderConnect();renderNodes();};
$('connectForm').onsubmit=e=>{e.preventDefault();if(!pendingConnection)return;const data=new FormData(e.target),[a,b]=pendingConnection.map(id=>state.nodes.find(n=>n.id===id)),ap=data.get('port0'),bp=data.get('port1');
 if(state.links.some(l=>(l.a===a.id&&l.b===b.id&&l.ap===ap&&l.bp===bp)||(l.a===b.id&&l.b===a.id&&l.ap===bp&&l.bp===ap))){toast('すでに接続されています。');return;}
 const occupied=(n,p)=>n.type!=='switch'&&n.type!=='internet'&&state.links.some(l=>(l.a===n.id&&l.ap===p)||(l.b===n.id&&l.bp===p));
 if(occupied(a,ap)||occupied(b,bp)){toast('そのポートは使用中です。接続を削除するか、スイッチで分岐してください。');return;}
 if((a.type==='router'&&ap==='lan'&&b.type==='internet')||(b.type==='router'&&bp==='lan'&&a.type==='internet')){toast('インターネットはルータのWAN側へ接続してください。');return;}
 invalidate();state.links.push(link(a,b,ap,bp));$('connectDialog').close();state.first=null;state.connecting=false;pendingConnection=null;renderNodes();renderConnect();};
$('connectDialog').addEventListener('close',()=>{state.first=null;pendingConnection=null;renderNodes();renderConnect();});
$('hintButton').onclick=()=>{const hints=state.mode==='free'?['まずPC2台とスイッチで同じLANをつくってみましょう。異なるネットワークをつなぐ場合は、ルータの各ポートを別のネットワークに設定します。']:currentTask().hints;const i=Math.min(state.hint,hints.length-1);$('hint').textContent=`ヒント ${i+1}/${hints.length}：${hints[i]}`;$('hint').hidden=false;state.hint++;};
// 課題のクリア対象はIDで固定。機器名やテスト対象を変更しても別のペアで誤クリアしません。
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>loadTask(b.dataset.mode,0));
$('missionSteps').onclick=e=>{const b=e.target.closest('[data-step]');if(b)loadTask(state.mode,Number(b.dataset.step));};
$('previous').onclick=()=>loadTask(state.mode,state.index-1);$('next').onclick=()=>loadTask(state.mode,state.index+1);
$('resetButton').onclick=()=>$('resetDialog').showModal();$('confirmReset').onclick=()=>{$('resetDialog').close();loadTask();};
$('helpButton').onclick=()=>$('helpDialog').showModal();$('modelButton').onclick=()=>$('modelDialog').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
for(const id of ['source','destination'])$(id).onchange=()=>{invalidate();state[id]=$(id).value;};
$('testButton').onclick=startTest;$('pauseButton').onclick=()=>{if(animation){animation.paused=!animation.paused;$('pauseButton').textContent=animation.paused?'再開':'一時停止';}};
new ResizeObserver(renderWires).observe($('canvas'));
loadTask();
