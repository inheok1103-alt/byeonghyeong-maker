# -*- coding: utf-8 -*-
"""RAY English one-click launcher for Windows.

This launcher intentionally sits above the active Claude/Codex project files.
It starts the local dashboard, monitors it, and can run a source file through
the existing pipeline without changing the pipeline implementation.
"""

from __future__ import annotations

import ctypes
import json
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog


def executable_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def resolve_engine_dir() -> Path:
    configured = os.environ.get("RAY_ENGINE_DIR", "").strip()
    base = executable_dir()
    candidates = [
        Path(configured) if configured else None,
        base / "selfllm",
        base / "engine" / "selfllm",
        base,
        Path.home() / "Desktop" / "변형문제생성기" / "web" / "selfllm",
        Path.home() / "바탕 화면" / "변형문제생성기" / "web" / "selfllm",
    ]
    for candidate in candidates:
        if candidate and (candidate / "ray_app.py").is_file() and (candidate / "ray.py").is_file():
            return candidate.resolve()
    return base


APP_DIR = resolve_engine_dir()
WEB_ROOT = APP_DIR.parent
RAY_APP = APP_DIR / "ray_app.py"
RAY_CLI = APP_DIR / "ray.py"
RAY_BRAIN = APP_DIR / "ray_local_brain.py"
OUTPUT_DIR = Path.home() / "Downloads" / "수능특강" / "_RAY수업보드"
LOG_DIR = APP_DIR / "_launcher"
LOG_FILE = LOG_DIR / "ray_launcher.log"
BRAIN_DATA_DIR = (
    Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    / "RAYEnglish"
    / "brain"
)
BRAIN_STATE_FILE = BRAIN_DATA_DIR / "state.json"
BRAIN_STOP_FILE = BRAIN_DATA_DIR / "stop.request"
BRAIN_REFRESH_FILE = BRAIN_DATA_DIR / "refresh.request"
BRAIN_LAUNCHER_LOG = BRAIN_DATA_DIR / "brain_launcher.log"
START_PORT = 8792
END_PORT = 8792

BG = "#0B0C10"
PANEL = "#15171E"
PANEL_2 = "#1D2029"
LINE = "#2A2E3A"
INK = "#F2F3F5"
MUTED = "#9AA3B0"
GOLD = "#D8B968"
GREEN = "#43C57A"
RED = "#E35D6A"


def python_console() -> str:
    configured = os.environ.get("RAY_PYTHON", "").strip()
    if configured and Path(configured).is_file():
        return configured

    exe = Path(sys.executable).resolve()
    if not getattr(sys, "frozen", False) and exe.name.lower() in {"python.exe", "pythonw.exe"}:
        console = exe.with_name("python.exe")
        if console.exists():
            return str(console)

    candidates = [
        Path.home() / "AppData" / "Local" / "Programs" / "Python" / "Python311" / "python.exe",
        Path.home() / "AppData" / "Local" / "Programs" / "Python" / "Python312" / "python.exe",
        Path.home() / "AppData" / "Local" / "Programs" / "Python" / "Python313" / "python.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    for command in ("python.exe", "python", "py.exe", "py"):
        found = shutil.which(command)
        if found:
            return found
    raise RuntimeError("Python 실행 환경을 찾지 못했습니다. RAY_PYTHON을 지정해 주세요.")


def protected_environment(port: int | None = None) -> dict[str, str]:
    """Return a child environment with direct paid API routes disabled."""
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["RAY_ALLOW_PAID"] = "0"
    env["RAY_ZERO_COST"] = "1"
    if port is not None:
        env["RAY_PORT"] = str(port)
    for key in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY"):
        env.pop(key, None)
    return env


def request_status(port: int, timeout: float = 0.6) -> dict | None:
    try:
        with urllib.request.urlopen(
            f"http://127.0.0.1:{port}/status", timeout=timeout
        ) as response:
            if response.status != 200:
                return None
            data = json.loads(response.read().decode("utf-8", "replace"))
            if not isinstance(data, dict) or "paid" not in data:
                return None
            return data
    except (OSError, ValueError, urllib.error.URLError):
        return None


def find_existing_server() -> tuple[int, dict] | None:
    for port in range(START_PORT, END_PORT + 1):
        status = request_status(port, timeout=0.16)
        if status:
            return port, status
    return None


def choose_port() -> int:
    for port in range(START_PORT, END_PORT + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"사용 가능한 포트가 없습니다 ({START_PORT}-{END_PORT}).")


def process_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        exit_code = ctypes.c_ulong()
        ok = ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
        ctypes.windll.kernel32.CloseHandle(handle)
        return bool(ok and exit_code.value == 259)
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def read_brain_state() -> dict:
    for _ in range(4):
        try:
            data = json.loads(BRAIN_STATE_FILE.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except Exception:
            time.sleep(0.02)
    return {}


def activate_existing_launcher() -> None:
    if os.name == "nt":
        hwnd = ctypes.windll.user32.FindWindowW(None, "RAY English · 올인원 제작기")
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 9)
            ctypes.windll.user32.BringWindowToTop(hwnd)
            ctypes.windll.user32.SetForegroundWindow(hwnd)
    existing = find_existing_server()
    if existing:
        webbrowser.open(f"http://127.0.0.1:{existing[0]}")


def create_mutex() -> int | None:
    if os.name != "nt":
        return None
    handle = ctypes.windll.kernel32.CreateMutexW(
        None, False, "Local\\RAYEnglishOneClickLauncher"
    )
    if ctypes.windll.kernel32.GetLastError() == 183:
        activate_existing_launcher()
        ctypes.windll.kernel32.CloseHandle(handle)
        return 0
    return handle


class RayLauncher(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("RAY English · 올인원 제작기")
        self.geometry("690x700")
        self.minsize(660, 660)
        self.configure(bg=BG)
        self.protocol("WM_DELETE_WINDOW", self.on_close)

        self.server_process: subprocess.Popen | None = None
        self.server_log_handle = None
        self.server_port: int | None = None
        self.server_owned = False
        self.starting = False
        self.job_running = False
        self.brain_process: subprocess.Popen | None = None
        self.brain_log_handle = None
        self.brain_manual_stop = False
        self.brain_restart_attempts = 0
        self.brain_restart_pending = False
        self.kind = tk.StringVar(value="reading")
        self.status_text = tk.StringVar(value="준비 중")
        self.status_detail = tk.StringVar(value="로컬 서버를 확인하고 있습니다.")
        self.task_text = tk.StringVar(value="대기")
        self.brain_status_text = tk.StringVar(value="준비 중")
        self.brain_detail_text = tk.StringVar(value="PC 안의 사용자 문서를 로컬에서 정리합니다.")

        self._build_ui()
        self.after(60, self._bring_to_front)
        self.after(120, self.start_or_attach)
        self.after(700, self.start_brain)
        self.after(1500, self.monitor_server)
        self.after(1800, self.monitor_brain)

    def _bring_to_front(self) -> None:
        self.deiconify()
        self.lift()
        self.attributes("-topmost", True)
        self.focus_force()
        self.after(900, lambda: self.attributes("-topmost", False))

    def _build_ui(self) -> None:
        header = tk.Frame(self, bg=BG)
        header.pack(fill="x", padx=26, pady=(24, 12))

        tk.Label(
            header,
            text="RAY ENGLISH",
            bg=GOLD,
            fg=BG,
            font=("Segoe UI", 9, "bold"),
            padx=9,
            pady=3,
        ).pack(anchor="w")
        tk.Label(
            header,
            text="올인원 제작기",
            bg=BG,
            fg=INK,
            font=("Malgun Gothic", 24, "bold"),
        ).pack(anchor="w", pady=(8, 0))
        tk.Label(
            header,
            text="로컬 대시보드 · 파일 분석 · 제작 상태",
            bg=BG,
            fg=MUTED,
            font=("Malgun Gothic", 10),
        ).pack(anchor="w", pady=(2, 0))

        status_panel = tk.Frame(self, bg=PANEL, highlightthickness=1, highlightbackground=LINE)
        status_panel.pack(fill="x", padx=26, pady=(0, 12))
        left = tk.Frame(status_panel, bg=PANEL)
        left.pack(side="left", fill="x", expand=True, padx=16, pady=13)
        self.status_dot = tk.Label(
            left, text="●", bg=PANEL, fg=GOLD, font=("Segoe UI Symbol", 12)
        )
        self.status_dot.pack(side="left", padx=(0, 8))
        text_box = tk.Frame(left, bg=PANEL)
        text_box.pack(side="left", fill="x", expand=True)
        tk.Label(
            text_box,
            textvariable=self.status_text,
            bg=PANEL,
            fg=INK,
            font=("Malgun Gothic", 11, "bold"),
        ).pack(anchor="w")
        tk.Label(
            text_box,
            textvariable=self.status_detail,
            bg=PANEL,
            fg=MUTED,
            font=("Malgun Gothic", 9),
        ).pack(anchor="w")
        self.guard_label = tk.Label(
            status_panel,
            text="비용 보호 ON",
            bg=PANEL_2,
            fg=GREEN,
            font=("Malgun Gothic", 9, "bold"),
            padx=10,
            pady=6,
        )
        self.guard_label.pack(side="right", padx=14)

        actions = tk.Frame(self, bg=BG)
        actions.pack(fill="x", padx=26)
        self._button(actions, "대시보드 열기", self.open_dashboard, primary=True).pack(
            side="left", fill="x", expand=True, padx=(0, 6)
        )
        self._button(actions, "서버 다시 시작", self.restart_server).pack(
            side="left", fill="x", expand=True, padx=6
        )
        self._button(actions, "결과 폴더", lambda: self.open_folder(OUTPUT_DIR)).pack(
            side="left", fill="x", expand=True, padx=(6, 0)
        )

        source_panel = tk.Frame(self, bg=PANEL, highlightthickness=1, highlightbackground=LINE)
        source_panel.pack(fill="x", padx=26, pady=12)
        tk.Label(
            source_panel,
            text="파일에서 바로 제작",
            bg=PANEL,
            fg=INK,
            font=("Malgun Gothic", 11, "bold"),
        ).grid(row=0, column=0, sticky="w", padx=16, pady=(13, 2))
        tk.Label(
            source_panel,
            text="PDF · Office · HWP/HWPX · 이미지 로컬 OCR",
            bg=PANEL,
            fg=MUTED,
            font=("Malgun Gothic", 9),
        ).grid(row=1, column=0, sticky="w", padx=16, pady=(0, 12))

        mode_box = tk.Frame(source_panel, bg=PANEL)
        mode_box.grid(row=0, column=1, rowspan=2, padx=8, pady=10)
        self.mode_buttons = {}
        for value, label in (("reading", "독해"), ("grammar", "어법")):
            button = tk.Button(
                mode_box,
                text=label,
                command=lambda v=value: self.set_kind(v),
                relief="flat",
                bd=0,
                padx=12,
                pady=7,
                cursor="hand2",
                font=("Malgun Gothic", 9, "bold"),
            )
            button.pack(side="left", padx=(0, 2) if value == "reading" else (2, 0))
            self.mode_buttons[value] = button
        self.set_kind("reading")

        self.file_button = self._button(
            source_panel, "파일 선택", self.run_file_pipeline, primary=True
        )
        self.file_button.grid(row=0, column=2, rowspan=2, padx=(6, 14), pady=11, sticky="e")
        source_panel.grid_columnconfigure(0, weight=1)

        brain_panel = tk.Frame(self, bg=PANEL, highlightthickness=1, highlightbackground=LINE)
        brain_panel.pack(fill="x", padx=26, pady=(0, 12))
        brain_header = tk.Frame(brain_panel, bg=PANEL)
        brain_header.pack(fill="x", padx=15, pady=(11, 4))
        tk.Label(
            brain_header,
            text="컴퓨터 기억 뇌",
            bg=PANEL,
            fg=INK,
            font=("Malgun Gothic", 11, "bold"),
        ).pack(side="left")
        tk.Label(
            brain_header,
            text="로컬 전용 · 추가비용 0원",
            bg=PANEL_2,
            fg=GREEN,
            font=("Malgun Gothic", 8, "bold"),
            padx=8,
            pady=3,
        ).pack(side="right")

        brain_status = tk.Frame(brain_panel, bg=PANEL)
        brain_status.pack(fill="x", padx=15)
        self.brain_dot = tk.Label(
            brain_status, text="●", bg=PANEL, fg=GOLD, font=("Segoe UI Symbol", 10)
        )
        self.brain_dot.pack(side="left", padx=(0, 8))
        brain_status_text = tk.Frame(brain_status, bg=PANEL)
        brain_status_text.pack(side="left", fill="x", expand=True)
        tk.Label(
            brain_status_text,
            textvariable=self.brain_status_text,
            bg=PANEL,
            fg=INK,
            font=("Malgun Gothic", 9, "bold"),
        ).pack(anchor="w")
        tk.Label(
            brain_status_text,
            textvariable=self.brain_detail_text,
            bg=PANEL,
            fg=MUTED,
            font=("Malgun Gothic", 8),
            wraplength=600,
            justify="left",
        ).pack(anchor="w")

        brain_actions = tk.Frame(brain_panel, bg=PANEL)
        brain_actions.pack(fill="x", padx=15, pady=(8, 11))
        self._button(brain_actions, "기억 검색", self.search_brain, primary=True).pack(
            side="left", fill="x", expand=True, padx=(0, 4)
        )
        self._button(brain_actions, "지금 갱신", self.refresh_brain).pack(
            side="left", fill="x", expand=True, padx=4
        )
        self._button(brain_actions, "기억 폴더", lambda: self.open_folder(BRAIN_DATA_DIR)).pack(
            side="left", fill="x", expand=True, padx=4
        )
        self._button(brain_actions, "중지", self.stop_brain).pack(
            side="left", fill="x", expand=True, padx=(4, 0)
        )

        activity = tk.Frame(self, bg=PANEL_2, highlightthickness=1, highlightbackground=LINE)
        activity.pack(fill="both", expand=True, padx=26, pady=(0, 12))
        tk.Label(
            activity,
            text="현재 작업",
            bg=PANEL_2,
            fg=MUTED,
            font=("Malgun Gothic", 9, "bold"),
        ).pack(anchor="w", padx=14, pady=(10, 2))
        tk.Label(
            activity,
            textvariable=self.task_text,
            bg=PANEL_2,
            fg=INK,
            justify="left",
            wraplength=570,
            font=("Malgun Gothic", 10),
        ).pack(anchor="w", padx=14, pady=(0, 10))

        footer = tk.Frame(self, bg=BG)
        footer.pack(fill="x", padx=26, pady=(0, 18))
        self._button(footer, "프로젝트 폴더", lambda: self.open_folder(WEB_ROOT)).pack(
            side="left"
        )
        self._button(footer, "로그", lambda: self.open_folder(LOG_DIR)).pack(
            side="left", padx=8
        )
        self._button(footer, "종료", self.on_close, danger=True).pack(side="right")

    def _button(
        self,
        parent: tk.Misc,
        text: str,
        command,
        *,
        primary: bool = False,
        danger: bool = False,
    ) -> tk.Button:
        bg = GOLD if primary else PANEL_2
        fg = BG if primary else (RED if danger else INK)
        return tk.Button(
            parent,
            text=text,
            command=command,
            bg=bg,
            fg=fg,
            activebackground="#E5CA83" if primary else "#282C37",
            activeforeground=BG if primary else fg,
            relief="flat",
            bd=0,
            padx=13,
            pady=10,
            cursor="hand2",
            font=("Malgun Gothic", 10, "bold" if primary else "normal"),
        )

    def set_server_status(self, state: str, detail: str, color: str) -> None:
        self.status_text.set(state)
        self.status_detail.set(detail)
        self.status_dot.configure(fg=color)

    def set_kind(self, value: str) -> None:
        self.kind.set(value)
        for key, button in self.mode_buttons.items():
            selected = key == value
            button.configure(
                bg=GOLD if selected else PANEL_2,
                fg=BG if selected else INK,
                activebackground="#E5CA83" if selected else "#282C37",
                activeforeground=BG if selected else INK,
            )

    def append_log(self, message: str) -> None:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with LOG_FILE.open("a", encoding="utf-8") as handle:
            handle.write(f"[{stamp}] {message}\n")

    def start_or_attach(self) -> None:
        if self.starting:
            return
        self.starting = True
        self.set_server_status("시작 중", "RAY 로컬 서버를 준비하고 있습니다.", GOLD)
        threading.Thread(target=self._start_worker, daemon=True).start()

    def _start_worker(self) -> None:
        existing = find_existing_server()
        if existing:
            port, data = existing
            self.server_port = port
            self.server_owned = False
            self.append_log(f"기존 서버 연결: {port}")
            self.after(0, lambda: self._server_ready(data, attached=True, open_now=True))
            return

        if not RAY_APP.exists():
            self.after(0, lambda: self._start_failed(f"파일 없음: {RAY_APP}"))
            return

        try:
            port = choose_port()
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            self.server_log_handle = LOG_FILE.open("a", encoding="utf-8")
            creation_flags = 0
            if os.name == "nt":
                creation_flags = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
            self.server_process = subprocess.Popen(
                [python_console(), str(RAY_APP)],
                cwd=str(APP_DIR),
                env=protected_environment(port),
                stdout=self.server_log_handle,
                stderr=subprocess.STDOUT,
                creationflags=creation_flags,
            )
            self.server_port = port
            self.server_owned = True
            self.append_log(f"서버 시작 요청: pid={self.server_process.pid}, port={port}")
            for _ in range(40):
                if self.server_process.poll() is not None:
                    raise RuntimeError(f"서버가 종료되었습니다 (code={self.server_process.returncode}).")
                status = request_status(port)
                if status:
                    self.after(0, lambda d=status: self._server_ready(d, attached=False, open_now=True))
                    return
                time.sleep(0.2)
            raise RuntimeError("서버 응답 시간이 초과되었습니다.")
        except Exception as exc:
            self.after(0, lambda e=str(exc): self._start_failed(e))

    def _server_ready(self, data: dict, *, attached: bool, open_now: bool) -> None:
        self.starting = False
        mode = "기존 서버 연결" if attached else "로컬 서버 실행"
        detail = (
            f"{mode} · http://127.0.0.1:{self.server_port} · "
            f"검수 대기 {data.get('review', 0)}건"
        )
        self.set_server_status("실행 중", detail, GREEN)
        self.task_text.set("대시보드에서 지문을 붙여넣거나 파일을 선택하세요.")
        if open_now:
            self.open_dashboard()

    def _start_failed(self, error: str) -> None:
        self.starting = False
        self.set_server_status("시작 실패", error, RED)
        self.task_text.set("로그를 확인한 뒤 서버 다시 시작을 눌러 주세요.")
        self.append_log(f"서버 시작 실패: {error}")

    def monitor_server(self) -> None:
        if self.server_port:
            status = request_status(self.server_port)
            if status:
                paid = str(status.get("paid", "OFF"))
                detail = (
                    f"http://127.0.0.1:{self.server_port} · 지식 {status.get('vocab', 0)}개 · "
                    f"검수 대기 {status.get('review', 0)}건 · 유료 {paid}"
                )
                self.set_server_status("실행 중", detail, GREEN)
            elif not self.starting:
                self.set_server_status("연결 끊김", "서버 응답이 없습니다.", RED)
        self.after(2000, self.monitor_server)

    def set_brain_status(self, state: str, detail: str, color: str) -> None:
        self.brain_status_text.set(state)
        self.brain_detail_text.set(detail)
        self.brain_dot.configure(fg=color)

    def start_brain(self) -> None:
        self.brain_restart_pending = False
        self.brain_manual_stop = False
        if not RAY_BRAIN.exists():
            self.set_brain_status("사용 불가", f"기억 모듈이 없습니다: {RAY_BRAIN}", RED)
            return
        state = read_brain_state()
        if process_alive(int(state.get("pid") or 0)):
            self.set_brain_status("연결됨", "기존 로컬 기억 뇌를 사용합니다.", GREEN)
            return
        if self.brain_process and self.brain_process.poll() is None:
            return
        try:
            BRAIN_DATA_DIR.mkdir(parents=True, exist_ok=True)
            BRAIN_STOP_FILE.unlink(missing_ok=True)
            if self.brain_log_handle:
                self.brain_log_handle.close()
            self.brain_log_handle = BRAIN_LAUNCHER_LOG.open("a", encoding="utf-8")
            creation_flags = 0
            if os.name == "nt":
                creation_flags = (
                    subprocess.CREATE_NO_WINDOW
                    | subprocess.CREATE_NEW_PROCESS_GROUP
                    | subprocess.BELOW_NORMAL_PRIORITY_CLASS
                )
            env = protected_environment()
            env["RAY_BRAIN_DATA_DIR"] = str(BRAIN_DATA_DIR)
            self.brain_process = subprocess.Popen(
                [python_console(), str(RAY_BRAIN), "watch"],
                cwd=str(APP_DIR),
                env=env,
                stdout=self.brain_log_handle,
                stderr=subprocess.STDOUT,
                creationflags=creation_flags,
            )
            self.set_brain_status(
                "기억 정리 시작",
                "사용자 문서를 외부 전송 없이 낮은 우선순위로 색인합니다.",
                GOLD,
            )
            self.append_log(f"로컬 기억 뇌 시작: pid={self.brain_process.pid}")
        except Exception as exc:
            self.set_brain_status("시작 실패", str(exc), RED)
            self.append_log(f"로컬 기억 뇌 시작 실패: {exc}")

    def _schedule_brain_restart(self) -> None:
        if self.brain_manual_stop or self.brain_restart_pending or self.brain_restart_attempts >= 2:
            return
        self.brain_restart_pending = True
        self.brain_restart_attempts += 1
        self.after(1500, self.start_brain)

    def monitor_brain(self) -> None:
        state = read_brain_state()
        status = str(state.get("status", ""))
        pid = int(state.get("pid") or 0)
        alive = process_alive(pid)
        if status == "indexing":
            if not alive:
                self.set_brain_status("기억 복구 중", "문서 파서 중단을 감지해 자동 재시작합니다.", RED)
                self._schedule_brain_restart()
            else:
                current = Path(str(state.get("current", ""))).name
                detail = (
                    f"확인 {int(state.get('scanned', 0)):,} · 새로 정리 {int(state.get('indexed', 0)):,}"
                    + (f" · {current}" if current else "")
                )
                self.set_brain_status("PC 기억 정리 중", detail, GOLD)
        elif status in {"watching", "ready"}:
            self.brain_restart_attempts = 0
            total = int(state.get("total_files", 0))
            db_mb = state.get("db_mb", 0)
            suffix = "자동 갱신 대기" if alive or status == "watching" else "검색 준비 완료"
            self.set_brain_status(
                "기억 준비 완료",
                f"문서·자료 {total:,}개 · 기억 DB {db_mb}MB · {suffix}",
                GREEN,
            )
        elif status == "error":
            self.set_brain_status("기억 오류", str(state.get("message", "알 수 없는 오류")), RED)
        elif status == "stopped" or self.brain_manual_stop:
            self.set_brain_status("중지됨", "기존 기억 검색은 가능하며 자동 갱신만 멈췄습니다.", MUTED)
        elif self.brain_process and self.brain_process.poll() is None:
            self.set_brain_status("시작 중", "로컬 기억 DB를 준비하고 있습니다.", GOLD)
        elif self.brain_process and self.brain_process.poll() is not None and not self.brain_manual_stop:
            self.set_brain_status("기억 복구 중", "초기화 중단을 감지해 자동 재시작합니다.", RED)
            self._schedule_brain_restart()
        self.after(2000, self.monitor_brain)

    def refresh_brain(self) -> None:
        state = read_brain_state()
        if not process_alive(int(state.get("pid") or 0)):
            self.start_brain()
            return
        BRAIN_DATA_DIR.mkdir(parents=True, exist_ok=True)
        BRAIN_REFRESH_FILE.touch()
        self.set_brain_status("갱신 예약", "현재 작업 직후 새 파일을 다시 확인합니다.", GOLD)

    def stop_brain(self) -> None:
        self.brain_manual_stop = True
        BRAIN_DATA_DIR.mkdir(parents=True, exist_ok=True)
        BRAIN_STOP_FILE.touch()
        self.set_brain_status("중지 요청", "안전하게 현재 파일 처리를 마친 뒤 멈춥니다.", MUTED)

    def search_brain(self) -> None:
        query = simpledialog.askstring(
            "컴퓨터 기억 검색",
            "찾을 지문·학교·주제·파일명을 입력하세요.",
            parent=self,
        )
        if not query or not query.strip():
            return
        self.set_brain_status("기억 검색 중", query.strip(), GOLD)
        threading.Thread(target=self._brain_search_worker, args=(query.strip(),), daemon=True).start()

    def _brain_search_worker(self, query: str) -> None:
        try:
            creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            env = protected_environment()
            env["RAY_BRAIN_DATA_DIR"] = str(BRAIN_DATA_DIR)
            result = subprocess.run(
                [python_console(), str(RAY_BRAIN), "search", query, "--limit", "40", "--json"],
                cwd=str(APP_DIR),
                env=env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=45,
                creationflags=creation_flags,
            )
            if result.returncode != 0:
                raise RuntimeError((result.stderr or result.stdout or "검색 실패").strip())
            rows = json.loads(result.stdout or "[]")
            self.after(0, lambda: self._show_brain_results(query, rows))
        except Exception as exc:
            self.after(0, lambda e=str(exc): messagebox.showerror("컴퓨터 기억 검색", e))

    def _show_brain_results(self, query: str, rows: list[dict]) -> None:
        state = read_brain_state()
        self.set_brain_status(
            "기억 준비 완료",
            f"문서·자료 {int(state.get('total_files', 0)):,}개 · '{query}' 검색 {len(rows)}건",
            GREEN,
        )
        window = tk.Toplevel(self)
        window.title(f"컴퓨터 기억 검색 · {query}")
        window.geometry("820x500")
        window.minsize(700, 420)
        window.configure(bg=BG)
        window.transient(self)

        tk.Label(
            window,
            text=f"'{query}' 검색 결과 {len(rows)}건",
            bg=BG,
            fg=INK,
            font=("Malgun Gothic", 14, "bold"),
        ).pack(anchor="w", padx=18, pady=(16, 8))

        body = tk.Frame(window, bg=BG)
        body.pack(fill="both", expand=True, padx=18)
        result_list = tk.Listbox(
            body,
            bg=PANEL,
            fg=INK,
            selectbackground=GOLD,
            selectforeground=BG,
            relief="flat",
            bd=0,
            font=("Malgun Gothic", 9),
            activestyle="none",
        )
        result_list.pack(side="left", fill="both", expand=True)
        scroll = tk.Scrollbar(body, command=result_list.yview)
        scroll.pack(side="right", fill="y")
        result_list.configure(yscrollcommand=scroll.set)
        for row in rows:
            result_list.insert("end", f"{row.get('name', '')}   |   {row.get('path', '')}")

        detail = tk.Text(
            window,
            height=5,
            bg=PANEL_2,
            fg=INK,
            relief="flat",
            bd=0,
            wrap="word",
            font=("Malgun Gothic", 9),
            padx=10,
            pady=8,
        )
        detail.pack(fill="x", padx=18, pady=8)

        def selected_path() -> Path | None:
            selection = result_list.curselection()
            if not selection:
                return None
            return Path(str(rows[selection[0]].get("path", "")))

        def update_detail(_event=None) -> None:
            selection = result_list.curselection()
            detail.configure(state="normal")
            detail.delete("1.0", "end")
            if selection:
                row = rows[selection[0]]
                detail.insert("end", f"{row.get('path', '')}\n\n{row.get('excerpt', '')}")
            detail.configure(state="disabled")

        def open_selected(_event=None) -> None:
            path = selected_path()
            if path and path.exists():
                os.startfile(str(path))

        def open_parent() -> None:
            path = selected_path()
            if path and path.exists():
                os.startfile(str(path.parent))

        def build_selected() -> None:
            path = selected_path()
            if path and path.exists():
                window.destroy()
                self._start_file_pipeline(str(path))

        result_list.bind("<<ListboxSelect>>", update_detail)
        result_list.bind("<Double-Button-1>", open_selected)
        if rows:
            result_list.selection_set(0)
            update_detail()

        actions = tk.Frame(window, bg=BG)
        actions.pack(fill="x", padx=18, pady=(0, 14))
        self._button(actions, "선택 파일 열기", open_selected, primary=True).pack(side="left")
        self._button(actions, "위치 열기", open_parent).pack(side="left", padx=8)
        self._button(actions, "이 파일로 제작", build_selected).pack(side="left")
        self._button(actions, "닫기", window.destroy).pack(side="right")

    def open_dashboard(self) -> None:
        if not self.server_port or not request_status(self.server_port):
            self.start_or_attach()
            return
        webbrowser.open(f"http://127.0.0.1:{self.server_port}")

    def stop_server(self) -> None:
        process = self.server_process
        if process and process.poll() is None:
            try:
                process.terminate()
                process.wait(timeout=4)
            except Exception:
                process.kill()
            self.append_log(f"서버 종료: pid={process.pid}")
        self.server_process = None
        self.server_port = None
        self.server_owned = False
        if self.server_log_handle:
            self.server_log_handle.close()
            self.server_log_handle = None

    def restart_server(self) -> None:
        if self.server_owned:
            self.stop_server()
        else:
            self.server_port = None
        self.start_or_attach()

    def run_file_pipeline(self) -> None:
        if self.job_running:
            messagebox.showinfo("RAY English", "이미 파일 제작이 진행 중입니다.")
            return
        path = filedialog.askopenfilename(
            title="분석할 파일 선택",
            filetypes=[
                ("지원 파일", "*.pdf *.docx *.pptx *.hwp *.hwpx *.xlsx *.png *.jpg *.jpeg *.webp *.bmp *.tif *.tiff *.txt *.md *.csv *.json"),
                ("모든 파일", "*.*"),
            ],
        )
        if not path:
            return
        self._start_file_pipeline(path)

    def _start_file_pipeline(self, path: str) -> None:
        if self.job_running:
            messagebox.showinfo("RAY English", "이미 파일 제작이 진행 중입니다.")
            return
        if not RAY_CLI.exists():
            messagebox.showerror("RAY English", f"실행 파일이 없습니다.\n{RAY_CLI}")
            return
        self.job_running = True
        self.file_button.configure(state="disabled")
        name = Path(path).name
        self.task_text.set(f"{name} · {self.kind.get()} 제작 중")
        self.append_log(f"파일 제작 시작: {path} ({self.kind.get()})")
        threading.Thread(
            target=self._file_worker,
            args=(path, self.kind.get()),
            daemon=True,
        ).start()

    def _file_worker(self, path: str, kind: str) -> None:
        try:
            creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            result = subprocess.run(
                [python_console(), str(RAY_CLI), "file", path, kind],
                cwd=str(APP_DIR),
                env=protected_environment(),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=420,
                creationflags=creation_flags,
            )
            output = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()
            tail = "\n".join(output.splitlines()[-5:])
            self.append_log(f"파일 제작 종료 code={result.returncode}\n{tail}")
            if result.returncode == 0:
                self._remember_file(path)
                self.after(0, lambda: self._file_done(True, "제작 완료 · 결과 폴더에서 확인하세요."))
            else:
                self.after(0, lambda: self._file_done(False, tail or "제작에 실패했습니다."))
        except Exception as exc:
            self.append_log(f"파일 제작 오류: {exc}")
            self.after(0, lambda e=str(exc): self._file_done(False, e))

    def _remember_file(self, path: str) -> None:
        if not RAY_BRAIN.exists():
            return
        try:
            creation_flags = 0
            if os.name == "nt":
                creation_flags = (
                    subprocess.CREATE_NO_WINDOW
                    | subprocess.CREATE_NEW_PROCESS_GROUP
                    | subprocess.BELOW_NORMAL_PRIORITY_CLASS
                )
            env = protected_environment()
            env["RAY_BRAIN_DATA_DIR"] = str(BRAIN_DATA_DIR)
            process = subprocess.Popen(
                [python_console(), str(RAY_BRAIN), "ingest", path],
                cwd=str(APP_DIR),
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=creation_flags,
            )
            self.append_log(f"선택 파일 기억 등록: pid={process.pid}, path={path}")
        except Exception as exc:
            self.append_log(f"선택 파일 기억 등록 실패: {exc}")

    def _file_done(self, ok: bool, message: str) -> None:
        self.job_running = False
        self.file_button.configure(state="normal")
        self.task_text.set(message)
        if ok:
            self.open_folder(OUTPUT_DIR)
        else:
            messagebox.showerror("RAY English", message)

    def open_folder(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        os.startfile(str(path))

    def on_close(self) -> None:
        if self.job_running:
            if not messagebox.askyesno(
                "RAY English", "파일 제작이 진행 중입니다. 그래도 종료할까요?"
            ):
                return
        if self.server_owned:
            self.stop_server()
        if self.brain_log_handle:
            self.brain_log_handle.close()
            self.brain_log_handle = None
        self.destroy()


def main() -> int:
    mutex = create_mutex()
    if mutex == 0:
        return 0
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        app = RayLauncher()
        app.mainloop()
        return 0
    finally:
        if mutex and os.name == "nt":
            ctypes.windll.kernel32.CloseHandle(mutex)


if __name__ == "__main__":
    raise SystemExit(main())
