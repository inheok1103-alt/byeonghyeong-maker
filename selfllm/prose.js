/* ===========================================================================
   Ray English 자체LLM — 산문 필터·정제 공유 모듈
   build_dataset.js의 isProse/cleanPassage와 동일 기준(evolve.js·벤치마크가 공유)
   =========================================================================== */
function isProse(t) {
  var w = (t.match(/[A-Za-z]+/g) || []).length; if (w < 70 || w > 220) return false;
  var sents = (t.match(/[.!?]/g) || []).length; if (sents < 4) return false;
  if (/_{3,}/.test(t)) return false;
  if (/\b(NEW WORDS|Sample Sentences|Definitions|Match the|Exercises?|Fill in|Chapter \d|Volume \d|Unit \d|WEEK \d|DAY \d|Table of Contents|Bibliography|References|Index|Copyright|ISBN|Figure \d|Table \d)\b/i.test(t)) return false;
  if (/\b(Preface|Foreword|Acknowledge?ments?|List of|typographical|conventions|invaluable|grateful|indebted|thank(s| you)|colleagues|this (book|volume|chapter|series)|the (author|editor|publisher)s?|cited|et al|ibid|op\. cit|footnote|abbreviations)\b/i.test(t)) return false;
  if (/\b(VII|VIII|IX|XI|XII|XIII|XIV|xvi|xvii)\b/i.test(t)) return false;
  if (/\b(ACKNOWLEDG|BIBLIOGRAPH|CONTENTS|PREFACE|FOREWORD|APPENDIX|GLOSSAR|INDEX|CHAPTER|COPYRIGHT)\w*/.test(t)) return false;
  if (/\b[A-Z][a-z]+ [A-Z][a-z]+(ed|ic|al|ous|ing), [a-z]+\./.test(t)) return false;
  if (/[a-z]´|[ˈˌː]|\b[a-z]{1,2}´\b/.test(t)) return false;
  if (!/^[A-Z"“']/.test(t.trim()) || !/[.!?]["'”]?\s*$/.test(t.trim())) return false;
  if ((t.match(/\(\s*\d{4}\s*\)/g) || []).length >= 2) return false;
  if ((t.match(/\b\d+\./g) || []).length >= 3) return false;
  if ((t.match(/\d/g) || []).length > w * 0.12) return false;
  var avg = w / Math.max(1, sents); if (avg < 7 || avg > 42) return false;
  var caps = (t.match(/\b[A-Z]{2,}\b/g) || []).length; if (caps > 6) return false;
  if (!/\b(the|a|an|is|are|was|were|has|have|that|which|because|however|therefore|although|while|when)\b/i.test(t)) return false;
  if (/\b(Conjunctive adverbs|Adverbs? of (Reason|Manner|Position|Direction)|Prepositional Expression|commonly used with|the following sentences?:|as in \(\d|see section|see [A-Z]-|Compare the following|Word\/)/i.test(t)) return false;
  if ((t.match(/\([\dA-Za-z]{1,3}\)\s/g) || []).length >= 2) return false;
  if (/\((modal|progressive|perfect|passive|simple|continuous|past|present|future|gerund|infinitive|subjunctive|auxiliary|participle|imperative|active|transitive|intransitive)\b/i.test(t)) return false;
  if (/\b(could've|couldn't have|would've|should've|might have|mustn't have)\b/i.test(t) && (t.match(/[.!?]/g) || []).length >= 5 && (t.match(/[A-Za-z]+/g) || []).length < 130) return false;
  if ((t.match(/(^|\s)[a-z]\.\s/g) || []).length >= 2) return false;
  var letters = (t.replace(/[^A-Za-z]/g, "").length), tot = t.length; if (letters / Math.max(1, tot) < 0.55) return false;
  return true;
}
function cleanPassage(t) {
  return String(t)
    .replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl").replace(/ﬀ/g, "ff").replace(/ﬃ/g, "ffi").replace(/ﬄ/g, "ffl")
    .replace(/[­​‌⁠﻿ ]/g, " ")
    .replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"').replace(/[–—]/g, "-")
    .replace(/[†‡✓↘∥∗]/g, " ").replace(/\(fict\S*\)/gi, " ").replace(/\b\d{1,3}\.\d(\.\d)*\b/g, " ")
    .replace(/([a-zA-Z])- ([A-Z])/g, "$1-$2").replace(/([a-z])- ([a-z])/g, "$1$2")
    .replace(/\s+/g, " ").trim();
}
// 결정론적 해시(홀드아웃 안정 선택용 — Math.random 대신)
function hstr(s) { var h = 5381; for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; } return h; }
function loadProse(root, fs) {
  var pdb = JSON.parse(fs.readFileSync(root + "/corpus/passage_db.json", "utf8"));
  return (pdb.passages || pdb).map(function (x) { var t = typeof x === "string" ? x : (x.text || ""); return cleanPassage(t); }).filter(isProse);
}
module.exports = { isProse: isProse, cleanPassage: cleanPassage, hstr: hstr, loadProse: loadProse };
