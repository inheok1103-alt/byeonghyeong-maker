#!/bin/bash
cd "/c/Users/이인혁/Desktop/변형문제생성기/web"
declare -A M=( ["빈칸(문장)"]=expl ["무관문장"]=expl ["글의순서"]=expl ["문장삽입"]=expl ["전체문장배열"]=expl ["네모어법ABC"]=expl ["어휘(밑줄)"]=expl ["조건영작"]=arg ["배열영작"]=arg ["안내문불일치"]=letter ["심경변화"]=narr ["밑줄함의"]=arg )
for t in "${!M[@]}"; do
  pg="selfllm/pg_${M[$t]}.txt"
  out=$(timeout 165 node selfllm/engine_harness.js "$t" "$pg" 2>&1)
  echo "$out" | node -e 'var s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{var T=process.argv[1];try{var o=JSON.parse(s);var q=o.q;if(!q){console.log("["+T+"] NULL");return;}var pw=(q.passage||"").split(/\s+/).filter(Boolean).length;var ch=(q.choices||[]).length;var slots=((q.passage||"").match(/ⓐ|ⓑ|ⓒ|ⓓ|ⓔ|①|②|③|④|⑤|\(\s*[①-⑤]\s*\)/g)||[]).length;var cjk=/[぀-ヿ㐀-䶿一-鿿]/.test(JSON.stringify(q));var tag=/<u>[^<]*<\/u>/.test(q.passage||"")?false:/&lt;u&gt;|&lt;\//.test(JSON.stringify(q));var kMix=(q.choices||[]).some(c=>{var a=(String(c).match(/[A-Za-z]/g)||[]).length,k=(String(c).match(/[가-힣]/g)||[]).length;return a>6&&k>0&&a>k&&/[가-힣]/.test(String(c));});var flags=[];if(ch&&![0,5].includes(ch))flags.push("선지"+ch);if(ch===5&&slots&&slots!==5&&/삽입|순서|배열|밑줄|네모|어법|어휘/.test(T))flags.push("슬롯"+slots);if(cjk)flags.push("CJK");if(tag)flags.push("태그노출");if(kMix)flags.push("언어혼입");if(pw<25&&!/영작|서술/.test(T))flags.push("축약"+pw);console.log("["+T+"] OK pw="+pw+" ch="+ch+" ans="+q.answer+(flags.length?" ⚠ "+flags.join(","):" ✓"));}catch(e){console.log("["+T+"] 파싱실패 "+s.slice(-80));}})' "$t"
done
