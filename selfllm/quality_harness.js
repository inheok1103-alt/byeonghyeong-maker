/* 문항 퀄리티 검수 하네스 — 선지우선/답안우선 파이프라인 산출물을 계량 검수.
   측정: ①형태단서(길이CV·정답최장) ②정답 유일성(오답 중복) ③추상도(정답 verbatim) ④오답 소재앵커 ⑤서술형 답안정합.
   사용: node selfllm/quality_harness.js [지문파일] [반복수]  (기본 pg_arg.txt, 각 유형 2회) */
var fs = require("fs"), path = require("path");
global.window = {};
var rf = global.fetch;
global.fetch = function (u, o) { u = String(u);
  if (u.indexOf("types_v2.json") >= 0) { var d = JSON.parse(fs.readFileSync(path.join(__dirname, "../knowledge/types_v2.json"), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d); } }); }
  if (u.indexOf("intent_db.json") >= 0) { try { var d2 = JSON.parse(fs.readFileSync(path.join(__dirname, "../knowledge/intent_db.json"), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d2); } }); } catch (e) {} }
  return rf(u, o); };
eval(fs.readFileSync(path.join(__dirname, "../api_team.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "../addon_key_guard.js"), "utf8"));
var PSY = require("../addon_psychometric.js");
var T = global.window.APITEAM;

var STOP = { the:1,a:1,an:1,of:1,to:1,in:1,on:1,for:1,and:1,or:1,is:1,are:1,be:1,that:1,this:1,it:1,as:1,by:1,with:1,we:1,our:1,they:1,their:1,not:1,its:1,can:1,through:1,which:1,such:1 };
function ctoks(s){ return String(s||"").toLowerCase().replace(/[^a-z가-힣0-9 ]/g," ").split(/\s+/).filter(function(w){return w.length>=3&&!STOP[w];}); }
function overlap(a,b){ var A=ctoks(a); if(!A.length)return 0; var B={}; ctoks(b).forEach(function(w){B[w]=1;}); return A.filter(function(w){return B[w];}).length/A.length; }
function verbatim(ans, pg){ var a=ctoks(ans); if(a.length<2)return false; var pl=" "+ctoks(pg).join(" ")+" "; if(pl.indexOf(" "+a.join(" ")+" ")>=0)return true; return a.filter(function(w){return pl.indexOf(" "+w+" ")>=0;}).length/a.length>=0.8; }

function auditMCQ(q, pg, type){
  var f = PSY.formCue(q);
  if (f.summary && f.summary.indexOf("위치표식") >= 0) return { skip: true };
  var ans = q.choices[q.answer-1], dis = q.choices.filter(function(_,i){return i!==q.answer-1;});
  var uniq = Math.max.apply(null, dis.map(function(d){return Math.min(overlap(ans,d),overlap(d,ans));}));
  var korCh = (String(ans).match(/[가-힣]/g)||[]).length > (String(ans).match(/[A-Za-z]/g)||[]).length;  // 한국어 선지→영어지문 어휘비교 불가
  var vbStrict = /요지|함의|빈칸/.test(String(type||""));  // 제목·주제(명사구)는 핵심명사 재사용 정상 → 엄격 verbatim 제외
  var vb = vbStrict ? verbatim(ans, pg) : false;
  var anchored = korCh ? -1 : dis.filter(function(d){return overlap(d, pg) > 0;}).length;
  var anchorOk = korCh ? true : anchored >= dis.length-1;
  var uniqT = /제목|주제|목적/.test(String(type||"")) ? 0.74 : 0.6;   // 짧은 명사구형은 핵심어 공유 정상 → 임계 완화
  // DNA 커버리지: 오답 4개가 서로 다른 논리 오류인가(선지 우선 설계의 핵심)
  var dn = (q._choiceNotes||[]).filter(function(nt){return !nt.correct && nt.dna;});
  var dset = {}; dn.forEach(function(nt){dset[String(nt.dna).replace(/[\s·]/g,"")]=1;});
  var dnaCov = dn.length ? Object.keys(dset).length : null;   // 서로 다른 DNA 수(4 이상적)
  var dnaOk = (dnaCov===null) || dnaCov >= 3;
  return {
    cue: f.cue, cv: f.cv, rank: f.answerRank,
    uniq: +uniq.toFixed(2), verbatim: vb, anchored: korCh ? "n/a" : (anchored+"/"+dis.length),
    dnaCov: dnaCov===null ? "-" : (dnaCov+"/4"),
    pass: (!f.cue) && uniq < uniqT && !vb && anchorOk && dnaOk
  };
}
function auditEssay(q){
  var ex = String(q.explanation||""), ans=(ex.split("\n")[0]||"").replace("[모범답안] ","");
  var isEng = (ans.match(/[A-Za-z]/g)||[]).length > (ans.match(/[가-힣]/g)||[]).length;
  var wc = ans.split(/\s+/).filter(Boolean).length;
  var reqs = (q.instruction.match(/'[A-Za-z][^']*'/g)||[]).map(function(r){return r.replace(/'/g,"");});
  var reqIn = reqs.length ? reqs.every(function(r){return ans.toLowerCase().indexOf(r.toLowerCase())>=0;}) : true;
  var band = q.instruction.match(/(\d+)~(\d+)단어/);
  var wcOk = band ? (wc>=+band[1]-1 && wc<=+band[2]+1) : true;
  var rubric = /채점 루브릭/.test(ex);
  return { lang:isEng?"EN":"KO", wc:wc, reqIn:reqIn, wcOk:wcOk, rubric:rubric, pass:reqIn&&wcOk&&rubric };
}

(async function(){
  T.configure({ proxyUrl: "https://ray-proxy.gen1103.workers.dev" });
  await T.loadTypeDB("knowledge/types_v2.json").catch(function(){});
  var pg = fs.readFileSync(process.argv[2] || path.join(__dirname,"pg_arg.txt"), "utf8").trim();
  var reps = +(process.argv[3]||2);
  var DEEP = process.argv.indexOf("--deep") >= 0;   // 오답 매력도(측정하네스 능력계층 솔버 패널) — 비쌈
  var MCQ = ["요지","주제","제목","함의"], ESSAY = ["서술형","주제문완성"];
  var mres=[], eres=[];
  console.error("■ 선지우선 MCQ 검수" + (DEEP ? " (--deep: 오답 매력도 패널 포함)" : ""));
  for (var r=0;r<reps;r++) for (var mi=0;mi<MCQ.length;mi++){
    var q=await T.generateOne(pg, MCQ[mi], {level:"상"}).catch(function(){return null;});
    if(!q){console.error("  "+MCQ[mi]+" null");continue;}
    var a=auditMCQ(q, q.passage||pg, MCQ[mi]); if(a.skip){continue;}
    var deepS="";
    if(DEEP){ try{ var pan=await PSY.panel(q, q.passage||pg, T); if(pan.ok) deepS=" | 오답효율="+pan.distractorEff+"% P̂="+pan.P+" D̂="+pan.D+(pan.dead&&pan.dead.length?(" 死"+pan.dead.join("")):""); }catch(_){} }
    mres.push(a);
    console.error("  "+(a.pass?"✅":"⚠ ")+MCQ[mi].padEnd(4)+" CV="+a.cv+" 정답순위="+a.rank+"/5 유일성="+a.uniq+" verbatim="+(a.verbatim?"Y":"n")+" 오답앵커="+a.anchored+" DNA="+a.dnaCov+deepS);
  }
  console.error("\n■ 답안우선 서술형 검수");
  for (var r2=0;r2<reps;r2++) for (var ei=0;ei<ESSAY.length;ei++){
    var q2=await T.generateOne(pg, ESSAY[ei], {level:"중"}).catch(function(){return null;});
    if(!q2){console.error("  "+ESSAY[ei]+" null");continue;}
    var e=auditEssay(q2); eres.push(e);
    console.error("  "+(e.pass?"✅":"⚠ ")+ESSAY[ei].padEnd(6)+e.lang+" "+e.wc+"단어 필수어정합="+(e.reqIn?"Y":"N")+" 단어수정합="+(e.wcOk?"Y":"N")+" 루브릭="+(e.rubric?"Y":"N"));
  }
  var mp=mres.filter(function(x){return x.pass;}).length, ep=eres.filter(function(x){return x.pass;}).length;
  console.error("\n=== 검수 스코어카드 ===");
  console.error("MCQ 합격 "+mp+"/"+mres.length+" (형태단서없음·유일·비verbatim·오답앵커)");
  console.error("서술형 합격 "+ep+"/"+eres.length+" (답안정합·단어수·루브릭)");
  var cued=mres.filter(function(x){return x.cue;}).length, vb=mres.filter(function(x){return x.verbatim;}).length;
  var dnaVals=mres.map(function(x){return x.dnaCov;}).filter(function(v){return v&&v!=="-";}).map(function(v){return +String(v).split("/")[0];});
  var dnaFull=dnaVals.filter(function(v){return v>=4;}).length;
  console.error("형태단서(정답최장) "+cued+"/"+mres.length+" · verbatim "+vb+"/"+mres.length+" · 평균 길이CV "+(mres.reduce(function(s,x){return s+x.cv;},0)/(mres.length||1)).toFixed(2));
  console.error("DNA 4종 완전분산 "+dnaFull+"/"+dnaVals.length+" · 평균 DNA "+(dnaVals.reduce(function(s,x){return s+x;},0)/(dnaVals.length||1)).toFixed(1)+"/4");
})().catch(function(e){console.error("HARNESS_ERR", (e&&e.stack||e).toString().slice(0,400));});
