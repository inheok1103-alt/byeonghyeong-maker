/* sheet.html clean() 안의 리터럴 제어바이트를 이스케이프 표기로 교체 */
var fs = require("fs");
var P = __dirname + "/../sheet.html";
var s = fs.readFileSync(P, "utf8");
var i = s.indexOf("function clean(o){");
var j = s.indexOf("/* 문장 분리", i);
if (i < 0 || j < 0) { console.log("clean() 블록 못 찾음"); process.exit(1); }
var fixed = 'function clean(o){ if(typeof o==="string") return o.replace(/[\\uFFFD\\u0400-\\u04FF]/g,"").replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]/g,"");\n  if(Array.isArray(o)) return o.map(clean); if(o&&typeof o==="object"){var r={};Object.keys(o).forEach(function(k){r[k]=clean(o[k]);});return r;} return o; }\n';
s = s.slice(0, i) + fixed + s.slice(j);
fs.writeFileSync(P, s);
var chk = fs.readFileSync(P, "utf8");
var hasCtrl = false; for (var c = 0; c < chk.length; c++) { var cc = chk.charCodeAt(c); if (cc < 32 && cc !== 9 && cc !== 10 && cc !== 13) { hasCtrl = true; break; } }
console.log("제어바이트:", hasCtrl ? "⚠잔존" : "✅제거", "| clean():", chk.indexOf("\\uFFFD") > 0 ? "이스케이프판 적용" : "확인 필요");
