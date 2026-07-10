/* 종합 검수 — 전 유형 세트(_final_set.json)를 모든 퀄 축으로 계량.
   사용: node selfllm/comprehensive_audit.js [세트.json] */
var fs = require("fs"), path = require("path");
var PSY = require("../addon_psychometric.js");
var SET = process.argv[2] || path.join(__dirname, "_final_set.json");
var s = JSON.parse(fs.readFileSync(SET, "utf8"));
var STOP = { the:1,a:1,an:1,of:1,to:1,in:1,on:1,for:1,and:1,or:1,is:1,are:1,be:1,that:1,this:1,it:1,as:1,by:1,with:1,we:1,our:1,they:1,their:1,not:1,its:1,can:1,through:1,which:1,such:1 };
function ctoks(x){ return String(x||"").toLowerCase().replace(/[^a-z가-힣0-9 ]/g," ").split(/\s+/).filter(function(w){return w.length>=3&&!STOP[w];}); }
function overlap(a,b){ var A=ctoks(a); if(!A.length)return 0; var B={}; ctoks(b).forEach(function(w){B[w]=1;}); return A.filter(function(w){return B[w];}).length/A.length; }
function verbatim(ans,pg){ var a=ctoks(ans); if(a.length<2)return false; var pl=" "+ctoks(pg).join(" ")+" "; if(pl.indexOf(" "+a.join(" ")+" ")>=0)return true; return a.filter(function(w){return pl.indexOf(" "+w+" ")>=0;}).length/a.length>=0.8; }
var CIRC=["①","②","③","④","⑤"], MARKS=["ⓐ","ⓑ","ⓒ","ⓓ","ⓔ"];

var rows=[], flags=[];
s.items.forEach(function(q){
  var r={ type:q.type, notes:[] }, isMarker=(q.choices||[]).every(function(c){return /^[ⓐ-ⓔ①-⑤]$/.test(String(c).trim());});
  // 라벨 정합(워크북 reveal vs answer)
  if(q._work&&q.choices&&q.choices.length){
    var st=(q._work.steps||[]).find(function(x){return x.input==="pick";});
    if(st){var m=String(st.reveal.answer).match(/[①②③④⑤ⓐ-ⓔ]/);var rev=m?(CIRC.indexOf(m[0])>=0?CIRC.indexOf(m[0]):MARKS.indexOf(m[0]))+1:0;if(rev&&rev!==q.answer)r.notes.push("라벨desync("+rev+"≠"+q.answer+")");}
  }
  if(q.choices&&q.choices.length>=4&&q.answer>=1){
    var f=PSY.formCue(q);
    if(!isMarker){
      r.cv=f.cv; r.rank=f.answerRank+"/5";
      if(f.cue)r.notes.push("형태단서(정답최장)");
      var ans=q.choices[q.answer-1], dis=q.choices.filter(function(_,i){return i!==q.answer-1;});
      var uniq=Math.max.apply(null,dis.map(function(d){return Math.min(overlap(ans,d),overlap(d,ans));}));
      var uT=/제목|주제|목적/.test(q.type)?0.74:0.6; r.uniq=+uniq.toFixed(2);
      if(uniq>=uT)r.notes.push("복수정답소지("+r.uniq+")");
      var kor=(String(ans).match(/[가-힣]/g)||[]).length>(String(ans).match(/[A-Za-z]/g)||[]).length;
      if(!kor&&/요지|함의|빈칸/.test(q.type)&&verbatim(ans,q.passage||s.passage))r.notes.push("verbatim");
    } else { r.mark="ⓐ~ⓔ/①~⑤"; }
    // 지문 존재(대조 필요 유형)
    if(/내용일치|어법|어휘|함의|순서|삽입|무관|배열|요약/.test(q.type)&&!(q.passage&&q.passage.length>50))r.notes.push("지문누락");
    // placeholder 잔존
    if(/원문 그대로|틀리게 바꾼 형태|판단지점/.test(q.explanation||""))r.notes.push("placeholder잔존");
    // 오답 진단·처방(Rx) 구성: 존재 + 오답 3~4개 각각 진단·처방 라인
    var rxm=String(q.explanation||"").match(/\[오답 진단·처방\]\n([\s\S]*?)(\n【|$)/);
    if(!rxm)r.notes.push("오답처방없음");
    else{var rlines=rxm[1].split("\n").filter(function(l){return /^[①②③④⑤] 진단:.*→ 처방:/.test(l.trim());});if(rlines.length<3)r.notes.push("오답처방불완전("+rlines.length+"/4)");r.rx=rlines.length;}
  } else {
    // 서술형
    var ex=String(q.explanation||"");
    if(!/채점 루브릭/.test(ex))r.notes.push("루브릭없음");
    if(/원문 그대로|틀리게 바꾼/.test(ex))r.notes.push("placeholder잔존");
    r.mark="서술형";
  }
  r.pass=r.notes.length===0;
  rows.push(r);
});
// 정답분포
var ans=s.items.filter(function(q){return q.choices&&q.choices.length>=4&&q.answer>=1;}).map(function(q){return q.answer;});
var dist={}; ans.forEach(function(a){dist[a]=(dist[a]||0)+1;});
var run=0,maxRun=1; for(var i=1;i<ans.length;i++){if(ans[i]===ans[i-1]){run++;maxRun=Math.max(maxRun,run+1);}else run=0;}

console.log("=== 종합 검수: "+s.items.length+"문항 (난이도 "+s.level+") ===\n");
rows.forEach(function(r){
  var line=(r.pass?"✅":"⚠ ")+r.type.padEnd(9);
  if(r.cv!==undefined)line+=" CV="+r.cv+" 순위="+r.rank+" 유일="+r.uniq;
  else if(r.mark)line+=" ["+r.mark+"]";
  if(r.notes.length)line+="  → "+r.notes.join(", ");
  console.log(line);
});
var pass=rows.filter(function(r){return r.pass;}).length;
console.log("\n합격 "+pass+"/"+rows.length);
console.log("정답분포 "+ans.join("")+" → "+JSON.stringify(dist)+" (최대연속 "+maxRun+")");
var cued=rows.filter(function(r){return (r.notes||[]).some(function(n){return /형태단서/.test(n);});}).length;
var vb=rows.filter(function(r){return (r.notes||[]).some(function(n){return /verbatim/.test(n);});}).length;
var multi=rows.filter(function(r){return (r.notes||[]).some(function(n){return /복수정답/.test(n);});}).length;
var desync=rows.filter(function(r){return (r.notes||[]).some(function(n){return /desync/.test(n);});}).length;
console.log("형태단서 "+cued+" · verbatim "+vb+" · 복수정답소지 "+multi+" · 라벨desync "+desync);
