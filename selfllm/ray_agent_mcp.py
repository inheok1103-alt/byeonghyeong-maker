# -*- coding: utf-8 -*-
"""Minimal stdio MCP server for subscription-only agent consultation.

Examples:
  python ray_agent_mcp.py --expose claude
  python ray_agent_mcp.py --expose codex

The server exposes text-only tools. It does not grant file, shell, browser, or
editing access. Model calls are delegated to ray_chat_bridge, which strips
metered API credentials and uses the locally authenticated subscriptions.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

import ray_chat_bridge


SERVER_NAME = "ray-agent-bridge"
SERVER_VERSION = "1.0.0"


def _tool(provider: str) -> dict[str, Any]:
    label = "Claude" if provider == "claude" else "ChatGPT-authenticated Codex"
    return {
        "name": f"ask_{provider}",
        "description": (
            f"Ask {label} for an independent text-only opinion through the user's "
            "existing subscription. No metered API key, file access, or command access is used."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "The question or draft to review.",
                },
                "context": {
                    "type": "string",
                    "description": "Optional passage or compact supporting context.",
                },
            },
            "required": ["prompt"],
            "additionalProperties": False,
        },
    }


def _write(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def _result(request_id: Any, value: Any) -> None:
    _write({"jsonrpc": "2.0", "id": request_id, "result": value})


def _error(request_id: Any, code: int, message: str) -> None:
    _write({
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": str(message)[:600]},
    })


def _available_tools(expose: str) -> list[dict[str, Any]]:
    providers = ["claude", "codex"] if expose == "both" else [expose]
    return [_tool(provider) for provider in providers]


def _handle(message: dict[str, Any], expose: str) -> None:
    method = str(message.get("method") or "")
    request_id = message.get("id")
    params = message.get("params") if isinstance(message.get("params"), dict) else {}

    if method == "initialize":
        requested = str(params.get("protocolVersion") or "2024-11-05")
        _result(request_id, {
            "protocolVersion": requested,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            "instructions": (
                "Text consultation only. Calls use local ChatGPT/Claude subscriptions; "
                "never assume file or command access."
            ),
        })
        return
    if method in {"notifications/initialized", "notifications/cancelled"}:
        return
    if method == "ping":
        _result(request_id, {})
        return
    if method == "tools/list":
        _result(request_id, {"tools": _available_tools(expose)})
        return
    if method == "resources/list":
        _result(request_id, {"resources": []})
        return
    if method == "prompts/list":
        _result(request_id, {"prompts": []})
        return
    if method == "logging/setLevel":
        _result(request_id, {})
        return
    if method == "tools/call":
        name = str(params.get("name") or "")
        arguments = params.get("arguments") if isinstance(params.get("arguments"), dict) else {}
        provider = name.removeprefix("ask_")
        allowed = {tool["name"] for tool in _available_tools(expose)}
        if name not in allowed or provider not in {"claude", "codex"}:
            _result(request_id, {
                "content": [{"type": "text", "text": "허용되지 않은 조력자 호출입니다."}],
                "isError": True,
            })
            return
        prompt = str(arguments.get("prompt") or "").strip()
        context = str(arguments.get("context") or "").strip()
        if not prompt:
            _result(request_id, {
                "content": [{"type": "text", "text": "prompt가 비어 있습니다."}],
                "isError": True,
            })
            return
        try:
            answer, label = ray_chat_bridge.ask(
                provider,
                [{"role": "user", "content": prompt}],
                context=context,
                timeout=150,
            )
            _result(request_id, {
                "content": [{"type": "text", "text": answer}],
                "structuredContent": {
                    "provider": label,
                    "metered_api": False,
                    "answer": answer,
                },
                "isError": False,
            })
        except Exception as exc:
            _result(request_id, {
                "content": [{"type": "text", "text": str(exc)[:600]}],
                "structuredContent": {
                    "provider": provider,
                    "metered_api": False,
                },
                "isError": True,
            })
        return
    if request_id is not None:
        _error(request_id, -32601, f"Method not found: {method}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expose", choices=("claude", "codex", "both"), default="both")
    args = parser.parse_args()
    try:
        sys.stdin.reconfigure(encoding="utf-8", errors="replace")
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", newline="\n")
    except AttributeError:
        pass
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
            if isinstance(message, dict):
                _handle(message, args.expose)
        except json.JSONDecodeError:
            _error(None, -32700, "Parse error")
        except Exception as exc:
            _error(None, -32603, str(exc))


if __name__ == "__main__":
    main()
