# -*- coding: utf-8 -*-
"""Subscription-only chat bridge for the local RAY app.

The bridge intentionally avoids OpenAI and Anthropic API keys. Codex is invoked
through the local ChatGPT-authenticated CLI and Claude through the local
Claude.ai-authenticated Claude Code CLI. Both agents run without tools and
without persistent sessions; the browser sends the compact conversation history.
"""

from __future__ import annotations

import glob
import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from typing import Any, Iterator


HERE = os.path.dirname(os.path.abspath(__file__))
MAX_MESSAGES = 18
MAX_HISTORY_CHARS = 18_000
_STATUS_TTL = 90
_status_cache: tuple[float, dict[str, dict[str, Any]]] | None = None
_status_lock = threading.Lock()


class ChatBridgeError(RuntimeError):
    def __init__(self, message: str, provider: str, status_code: int = 502):
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code


class ChatCancelled(ChatBridgeError):
    def __init__(self, provider: str = "debate"):
        super().__init__("토론이 중지되었습니다.", provider, 499)


def _latest_binary(pattern: str) -> str | None:
    paths = [path for path in glob.glob(pattern) if os.path.isfile(path)]
    if not paths:
        return None
    return max(paths, key=os.path.getmtime)


def _codex_binary() -> str | None:
    return shutil.which("codex") or _latest_binary(
        os.path.expanduser(
            r"~\.vscode\extensions\openai.chatgpt-*-win32-x64\bin\windows-x86_64\codex.exe"
        )
    )


def _claude_binary() -> str | None:
    return shutil.which("claude") or _latest_binary(
        os.path.expanduser(
            r"~\.vscode\extensions\anthropic.claude-code-*-win32-x64\resources\native-binary\claude.exe"
        )
    )


def _subscription_env() -> dict[str, str]:
    env = os.environ.copy()
    # Never allow this bridge to fall through to metered API credentials.
    for key in (
        "OPENAI_API_KEY",
        "OPENAI_BASE_URL",
        "AZURE_OPENAI_API_KEY",
        "CODEX_API_KEY",
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN",
        "ANTHROPIC_BASE_URL",
        "CLAUDE_CODE_USE_BEDROCK",
        "CLAUDE_CODE_USE_VERTEX",
    ):
        env.pop(key, None)
    env.update(
        {
            "PYTHONUTF8": "1",
            "PYTHONIOENCODING": "utf-8",
            "NO_COLOR": "1",
            "RAY_ALLOW_PAID": "0",
        }
    )
    return env


def _stop_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        try:
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            return
        except Exception:
            pass
    try:
        process.terminate()
        process.wait(timeout=2)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass


def _run(
    args: list[str],
    timeout: int,
    cancel_event: threading.Event | None = None,
) -> subprocess.CompletedProcess[str]:
    if cancel_event is None:
        return subprocess.run(
            args,
            cwd=HERE,
            env=_subscription_env(),
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    if os.name == "nt":
        flags |= getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    process = subprocess.Popen(
        args,
        cwd=HERE,
        env=_subscription_env(),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=flags,
    )
    started = time.monotonic()
    try:
        while process.poll() is None:
            if cancel_event.is_set():
                _stop_process(process)
                raise ChatCancelled()
            if time.monotonic() - started > timeout:
                _stop_process(process)
                raise subprocess.TimeoutExpired(args, timeout)
            time.sleep(0.1)
        stdout, stderr = process.communicate(timeout=3)
        return subprocess.CompletedProcess(args, process.returncode, stdout, stderr)
    finally:
        if process.poll() is None:
            _stop_process(process)


def _extract_json(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            return {}
        try:
            value = json.loads(match.group(0))
            return value if isinstance(value, dict) else {}
        except json.JSONDecodeError:
            return {}


def provider_status(force: bool = False) -> dict[str, dict[str, Any]]:
    global _status_cache
    with _status_lock:
        now = time.monotonic()
        if not force and _status_cache and now - _status_cache[0] < _STATUS_TTL:
            return _status_cache[1]

        codex = _codex_binary()
        claude = _claude_binary()
        codex_logged_in = False
        claude_logged_in = False
        claude_plan = ""

        if codex:
            try:
                result = _run([codex, "login", "status"], timeout=12)
                status_text = f"{result.stdout}\n{result.stderr}".lower()
                codex_logged_in = result.returncode == 0 and "chatgpt" in status_text
            except Exception:
                pass

        if claude:
            try:
                result = _run([claude, "auth", "status"], timeout=12)
                auth = _extract_json(f"{result.stdout}\n{result.stderr}")
                claude_logged_in = bool(auth.get("loggedIn")) and auth.get("authMethod") == "claude.ai"
                claude_plan = str(auth.get("subscriptionType") or "").lower()
            except Exception:
                pass

        statuses = {
            "ray": {
                "id": "ray",
                "label": "RAY Free",
                "available": True,
                "mode": "무료 폴백",
                "billing": "API 키 미사용",
            },
            "codex": {
                "id": "codex",
                "label": "ChatGPT · Codex",
                "available": bool(codex and codex_logged_in),
                "mode": "ChatGPT 구독 로그인" if codex_logged_in else "로그인 필요",
                "billing": "별도 API 결제 차단",
            },
            "claude": {
                "id": "claude",
                "label": "Claude · Max" if claude_plan == "max" else "Claude",
                "available": bool(claude and claude_logged_in),
                "mode": f"Claude {claude_plan.title()} 구독 로그인" if claude_logged_in else "로그인 필요",
                "billing": "별도 API 결제 차단",
            },
        }
        statuses["collab"] = {
            "id": "collab",
            "label": "Claude ↔ Codex",
            "available": bool(
                statuses["claude"]["available"] and statuses["codex"]["available"]
            ),
            "mode": "Claude 의견 → Codex 합의본",
            "billing": "별도 API 결제 차단 · 구독 호출 2회",
        }
        _status_cache = (now, statuses)
        return statuses


def _clean_messages(messages: Any) -> list[dict[str, str]]:
    if not isinstance(messages, list):
        return []
    clean: list[dict[str, str]] = []
    remaining = MAX_HISTORY_CHARS
    for item in reversed(messages[-MAX_MESSAGES:]):
        if not isinstance(item, dict):
            continue
        role = "assistant" if item.get("role") == "assistant" else "user"
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        content = content[-remaining:]
        remaining -= len(content)
        clean.append({"role": role, "content": content})
        if remaining <= 0:
            break
    return list(reversed(clean))


def _prompt(messages: Any, context: str = "") -> str:
    clean = _clean_messages(messages)
    if not clean:
        raise ChatBridgeError("대화 내용이 없습니다.", "bridge", 400)
    lines = [
        "You are the assistant inside RAY English Production OS.",
        "Answer in Korean unless the user asks for another language.",
        "Be concise, student-friendly, and precise about English reading, grammar, and exam design.",
        "Do not inspect files, call tools, run commands, or edit anything. Return only the chat answer.",
    ]
    context = str(context or "").strip()
    if context:
        lines.extend(["", "[현재 작업 지문]", context[:12_000]])
    lines.extend(["", "[대화]"])
    for message in clean:
        name = "사용자" if message["role"] == "user" else "조력자"
        lines.append(f"{name}: {message['content']}")
    lines.append("조력자:")
    return "\n".join(lines)


def _friendly_error(text: str, provider: str) -> ChatBridgeError:
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    low = text.lower()
    if "session limit" in low or "usage limit" in low or "rate limit" in low or "429" in low:
        reset = re.search(r"resets?\s+([^\"}]+)", text, re.I)
        suffix = f" 재개 시각: {reset.group(1).strip()}." if reset else " 잠시 후 다시 시도해 주세요."
        label = "Claude" if provider == "claude" else "ChatGPT·Codex"
        return ChatBridgeError(f"{label} 구독 사용 한도에 도달했습니다.{suffix}", provider, 429)
    if "login" in low or "auth" in low:
        return ChatBridgeError(f"{provider} 구독 로그인을 다시 확인해 주세요.", provider, 401)
    return ChatBridgeError(text[-400:] or f"{provider} 응답을 받지 못했습니다.", provider, 502)


def _ask_codex(
    messages: Any,
    context: str,
    timeout: int,
    cancel_event: threading.Event | None = None,
    effort: str = "low",
) -> tuple[str, str]:
    if effort not in ("low", "medium", "high"): effort = "low"
    binary = _codex_binary()
    if not binary or not provider_status().get("codex", {}).get("available"):
        raise ChatBridgeError("ChatGPT·Codex 구독 로그인이 필요합니다.", "codex", 401)
    handle = tempfile.NamedTemporaryFile(prefix="ray_codex_", suffix=".txt", delete=False)
    output_path = handle.name
    handle.close()
    try:
        args = [
            binary,
            "exec",
            "--ignore-user-config",
            "--ignore-rules",
            "--ephemeral",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "-c",
            f'model_reasoning_effort="{effort}"',
            "-C",
            HERE,
            "--output-last-message",
            output_path,
            _prompt(messages, context),
        ]
        result = _run(args, timeout=timeout, cancel_event=cancel_event)
        reply = ""
        if os.path.isfile(output_path):
            with open(output_path, encoding="utf-8", errors="replace") as stream:
                reply = stream.read().strip()
        if result.returncode != 0 or not reply:
            raise _friendly_error(f"{result.stdout}\n{result.stderr}", "codex")
        return reply, "ChatGPT · Codex"
    except subprocess.TimeoutExpired:
        raise ChatBridgeError("ChatGPT·Codex 응답 시간이 초과되었습니다.", "codex", 504)
    finally:
        try:
            os.remove(output_path)
        except OSError:
            pass


def _ask_claude(
    messages: Any,
    context: str,
    timeout: int,
    cancel_event: threading.Event | None = None,
    model: str | None = None,
) -> tuple[str, str]:
    binary = _claude_binary()
    if not binary or not provider_status().get("claude", {}).get("available"):
        raise ChatBridgeError("Claude 구독 로그인이 필요합니다.", "claude", 401)
    model = model or os.environ.get("RAY_CLAUDE_MODEL", "fable")   # 페이블 기본. 라우터가 sonnet/opus 지정 가능
    args = [
        binary,
        "-p",
        _prompt(messages, context),
        "--output-format",
        "json",
        "--no-session-persistence",
        "--permission-mode",
        "bypassPermissions",          # (수정) dontAsk=무효값 → bypassPermissions
        "--model",
        model,
        "--fallback-model",
        "sonnet",                     # 페이블 미가용 시 자동 폴백
        "--disallowed-tools",         # (수정) --tools= 무효 → 채팅 도우미라 변경도구 차단
        "Bash", "Edit", "Write", "NotebookEdit",
    ]
    try:
        result = _run(args, timeout=timeout, cancel_event=cancel_event)
    except subprocess.TimeoutExpired:
        raise ChatBridgeError("Claude 응답 시간이 초과되었습니다.", "claude", 504)
    payload = _extract_json(f"{result.stdout}\n{result.stderr}")
    reply = str(payload.get("result") or "").strip()
    if result.returncode != 0 or payload.get("is_error") or not reply:
        raise _friendly_error(reply or f"{result.stdout}\n{result.stderr}", "claude")
    return reply, ("Claude · 페이블" if model.startswith("fable") else f"Claude · {model.title()}")


def ask(
    provider: str,
    messages: Any,
    context: str = "",
    timeout: int = 120,
    cancel_event: threading.Event | None = None,
) -> tuple[str, str]:
    provider = str(provider or "ray").strip().lower()
    if provider in ("auto", "smart", "라우터"):
        # ★ 지능형 라우팅: 마지막 사용자 메시지를 분석해 가장 적합한 실행자·티어 선택
        try:
            import ray_router
            last = ""
            for m in reversed(_clean_messages(messages)):
                if m.get("role") == "user": last = m.get("content", ""); break
            r = ray_router.route(last)
            try:
                import ray_hub; ray_hub.log("router", "route", f"{r['model']}/{r.get('effort') or ''} · {r['reason']}")
            except Exception: pass
            if r["executor"] == "claude":
                reply, _ = _ask_claude(messages, context, timeout, cancel_event, model=r["model"])
                return reply, f"자동→Claude·{'페이블' if r['model']=='fable' else r['model'].title()} ({r['tier']})"
            else:
                reply, _ = _ask_codex(messages, context, timeout, cancel_event, effort=r.get("effort") or "low")
                return reply, f"자동→GPT·{r.get('effort')} ({r['tier']})"
        except ChatBridgeError:
            raise
        except Exception:
            return _ask_claude(messages, context, timeout, cancel_event, model="sonnet")
    if provider == "codex":
        return _ask_codex(messages, context, timeout, cancel_event)
    if provider == "claude":
        return _ask_claude(messages, context, timeout, cancel_event)
    if provider == "collab":
        clean = _clean_messages(messages)
        if not clean:
            raise ChatBridgeError("협업할 대화 내용이 없습니다.", "collab", 400)
        leg_timeout = max(60, min(120, timeout))
        claude_messages = clean + [
            {
                "role": "user",
                "content": (
                    "위 요청에 대해 독립적으로 검토하라. 특히 영어 교육적 정확성, "
                    "학생 이해도, 시험 적용 가능성에서 놓친 점을 찾아 구체적인 의견을 제시하라."
                ),
            }
        ]
        claude_reply, _ = _ask_claude(claude_messages, context, leg_timeout, cancel_event)
        codex_messages = clean + [
            {
                "role": "assistant",
                "content": "[Claude 선행 의견]\n" + claude_reply,
            },
            {
                "role": "user",
                "content": (
                    "Claude의 선행 의견을 비판적으로 검토하고, 타당한 내용만 반영하여 "
                    "중복 없이 실행 가능한 최종 합의본을 작성하라."
                ),
            },
        ]
        try:
            codex_reply, _ = _ask_codex(codex_messages, context, leg_timeout, cancel_event)
        except ChatBridgeError as exc:
            return (
                "[Claude 선행 의견]\n"
                + claude_reply
                + "\n\n[협업 상태]\nCodex 합의본 생성 실패: "
                + str(exc),
                "Claude 단독 · Codex 연결 실패",
            )
        return (
            "[Claude 선행 의견]\n"
            + claude_reply
            + "\n\n[Codex 최종 합의본]\n"
            + codex_reply,
            "Claude ↔ Codex",
        )
    if provider != "ray":
        raise ChatBridgeError("지원하지 않는 조력자입니다.", provider, 400)

    import ray_llm

    clean = _clean_messages(messages)
    if context:
        clean.insert(
            0,
            {
                "role": "system",
                "content": "현재 작업 지문:\n" + str(context)[:12_000],
            },
        )
    try:
        reply, source = ray_llm.ask(clean, temperature=0.5, timeout=min(timeout, 75))
        return reply, f"RAY Free · {source}"
    except Exception as exc:
        raise ChatBridgeError(str(exc), "ray", 502)


def debate(
    messages: Any,
    context: str = "",
    rounds: int = 1,
    timeout: int = 120,
    cancel_event: threading.Event | None = None,
) -> Iterator[dict[str, Any]]:
    """Yield turn-level events for a bounded Claude/Codex debate."""
    clean = _clean_messages(messages)
    if not clean:
        raise ChatBridgeError("토론할 논제가 없습니다.", "debate", 400)
    rounds = max(1, min(3, int(rounds)))
    leg_timeout = max(60, min(150, int(timeout)))
    transcript = list(clean)
    calls = 0

    for round_no in range(1, rounds + 1):
        if cancel_event and cancel_event.is_set():
            raise ChatCancelled()
        yield {
            "type": "status",
            "speaker": "Claude",
            "round": round_no,
            "message": f"{round_no}라운드 · Claude 의견 작성 중",
        }
        claude_instruction = (
            "당신은 Claude이며 Codex와 공개 토론 중이다. 사용자의 논제에 대해 독립된 입장을 "
            "제시하라. 핵심 주장, 근거, 예상 반론을 구체적으로 쓰되 불필요한 인사말은 빼라."
            if round_no == 1
            else "직전 [Codex 발언]을 읽고 타당한 부분, 반박할 부분, 수정할 부분을 구분해 재반론하라. "
                 "새 근거가 없으면 억지로 반대하지 말고 합의 가능성을 명시하라."
        )
        claude_reply, claude_label = _ask_claude(
            transcript + [{"role": "user", "content": claude_instruction}],
            context,
            leg_timeout,
            cancel_event,
        )
        calls += 1
        transcript.append({
            "role": "assistant",
            "content": f"[Claude {round_no}라운드 발언]\n{claude_reply}",
        })
        yield {
            "type": "turn",
            "speaker": "Claude",
            "provider": claude_label,
            "round": round_no,
            "content": claude_reply,
            "model_calls": calls,
        }

        if cancel_event and cancel_event.is_set():
            raise ChatCancelled()
        yield {
            "type": "status",
            "speaker": "Codex",
            "round": round_no,
            "message": f"{round_no}라운드 · Codex 검토 중",
        }
        if round_no == rounds:
            codex_instruction = (
                "당신은 Codex이며 Claude의 발언을 검토하는 마지막 토론자다. 단순 요약하지 말고 "
                "논리적 허점을 지적한 뒤 ① 합의점 ② 남은 이견 ③ 최종 판단 ④ 실행안을 분명히 정리하라."
            )
        else:
            codex_instruction = (
                "당신은 Codex이며 Claude와 공개 토론 중이다. 직전 [Claude 발언]에서 동의할 부분과 "
                "반박할 부분을 근거로 구분하고, 다음 라운드에서 Claude가 답해야 할 핵심 질문을 남겨라."
            )
        codex_reply, codex_label = _ask_codex(
            transcript + [{"role": "user", "content": codex_instruction}],
            context,
            leg_timeout,
            cancel_event,
        )
        calls += 1
        transcript.append({
            "role": "assistant",
            "content": f"[Codex {round_no}라운드 발언]\n{codex_reply}",
        })
        yield {
            "type": "turn",
            "speaker": "Codex",
            "provider": codex_label,
            "round": round_no,
            "content": codex_reply,
            "model_calls": calls,
            "final": round_no == rounds,
        }

    yield {
        "type": "done",
        "rounds": rounds,
        "model_calls": calls,
        "metered_api": False,
    }


def _cli() -> int:
    parser = argparse.ArgumentParser(description="RAY subscription chat bridge")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("status", help="Show subscription provider status")
    ask_parser = sub.add_parser("ask", help="Ask a provider from a local Codex/Claude session")
    ask_parser.add_argument("provider", choices=("ray", "codex", "claude", "collab"))
    ask_parser.add_argument("--prompt", default="", help="Question. Reads stdin when omitted.")
    ask_parser.add_argument("--context", default="", help="Compact context to share with the provider.")
    ask_parser.add_argument("--timeout", type=int, default=150)
    debate_parser = sub.add_parser("debate", help="Stream a bounded Claude/Codex debate as JSONL")
    debate_parser.add_argument("--topic", default="", help="Debate topic. Reads stdin when omitted.")
    debate_parser.add_argument("--context", default="", help="Compact context shared with both agents.")
    debate_parser.add_argument("--rounds", type=int, choices=(1, 2, 3), default=1)
    debate_parser.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()

    if not args.command or args.command == "status":
        print(json.dumps(provider_status(force=True), ensure_ascii=False, indent=2))
        return 0

    if args.command == "debate":
        topic = str(args.topic or "").strip()
        if not topic and not sys.stdin.isatty():
            topic = sys.stdin.read().strip()
        if not topic:
            print(json.dumps({"type": "error", "error": "논제가 비어 있습니다."}, ensure_ascii=False))
            return 2
        try:
            for event in debate(
                [{"role": "user", "content": topic}],
                context=args.context,
                rounds=args.rounds,
                timeout=max(30, min(300, args.timeout)),
            ):
                print(json.dumps(event, ensure_ascii=False), flush=True)
            return 0
        except Exception as exc:
            print(json.dumps({
                "type": "error",
                "error": str(exc)[:600],
                "provider": getattr(exc, "provider", "debate"),
                "metered_api": False,
            }, ensure_ascii=False), flush=True)
            return 1

    prompt = str(args.prompt or "").strip()
    if not prompt and not sys.stdin.isatty():
        prompt = sys.stdin.read().strip()
    if not prompt:
        print(json.dumps({"error": "prompt가 비어 있습니다.", "metered_api": False}, ensure_ascii=False))
        return 2
    try:
        reply, label = ask(
            args.provider,
            [{"role": "user", "content": prompt}],
            context=args.context,
            timeout=max(30, min(300, args.timeout)),
        )
        print(json.dumps({
            "reply": reply,
            "provider": label,
            "metered_api": False,
        }, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({
            "error": str(exc)[:600],
            "provider": getattr(exc, "provider", args.provider),
            "metered_api": False,
        }, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(_cli())
