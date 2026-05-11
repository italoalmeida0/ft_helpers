/**
 * shared42.js — Common utilities shared between C Playground and Norminette Online
 *
 * Exports:
 *   - 42 Header generator (generate42Header)
 *   - Pyodide norminette + c_formatter_42 loader (initPyodide42)
 *   - Wasm formatter initializer
 *   - Style injector (injectShared42Styles)
 */

// ==========================================
// 42 HEADER GENERATOR
// ==========================================
export const HEADER_LENGTH = 80;
export const HEADER_MARGIN = 5;

const asciiArt = [
  "        :::      ::::::::",
  "      :+:      :+:    :+:",
  "    +:+ +:+         +:+  ",
  "  +#+  +:+       +#+     ",
  "+#+#+#+#+#+   +#+        ",
  "     #+#    #+#          ",
  "    ###   ########.fr    ",
];

function textLine(left, right) {
  left = left.substring(0, HEADER_LENGTH - HEADER_MARGIN * 2 - right.length);
  const spaces = Math.max(0, HEADER_LENGTH - HEADER_MARGIN * 2 - left.length - right.length);
  return "/*" + " ".repeat(HEADER_MARGIN - 2) + left + " ".repeat(spaces) + right + " ".repeat(HEADER_MARGIN - 2) + "*/";
}

function formatDate(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}/${mo}/${d} ${h}:${mi}:${s}`;
}

export function generate42Header(filename, user, email) {
  const now = new Date();
  const dateStr = formatDate(now);
  const fillLine = "/* " + "*".repeat(HEADER_LENGTH - HEADER_MARGIN - 1) + " */";
  const blankLine = textLine("", "");
  const lines = [
    fillLine,
    blankLine,
    textLine("", asciiArt[0]),
    textLine(filename, asciiArt[1]),
    textLine("", asciiArt[2]),
    textLine(`By: ${user} <${email}>`, asciiArt[3]),
    textLine("", asciiArt[4]),
    textLine(`Created: ${dateStr} by ${user}`, asciiArt[5]),
    textLine(`Updated: ${dateStr} by ${user}`, asciiArt[6]),
    blankLine,
    fillLine,
  ];
  return lines.join("\n") + "\n\n";
}

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// PYODIDE + NORMINETTE + C_FORMATTER_42 LOADER
// ==========================================

/**
 * Loads Pyodide and installs norminette + c_formatter_42.
 * Calls onStatus(state, text) for progress updates.
 * Returns { pyodide, runNorminette, runFormatter, isReady }
 */
export async function initPyodide42(onStatus) {
  const setStatus = (state, text) => {
    if (onStatus) onStatus(state, text);
  };

  setStatus("loading", "Loading Pyodide...");
  const pyodide = await loadPyodide();

  setStatus("loading", "Installing micropip...");
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");

  setStatus("loading", "Installing norminette...");
  await micropip.install("norminette");

  setStatus("loading", "Installing c_formatter_42...");
  await micropip.install("c_formatter_42");

  await pyodide.runPython(`
from norminette.context import Context
from norminette.errors import JSONErrorsFormatter
from norminette.exceptions import CParsingError
from norminette.file import File
from norminette.lexer import Lexer
from norminette.registry import Registry
import json

def run_norminette(source_code, filename="main.c"):
    file = File(filename, source_code)
    registry = Registry()
    try:
        lexer = Lexer(file)
        tokens = list(lexer)
        context = Context(file, tokens, debug=0)
        registry.run(context)
    except CParsingError as e:
        return json.dumps({
            "files": [{"path": filename, "status": "Error",
                "errors": [{"name": "PARSE_ERROR", "text": str(e.msg), "level": "Error",
                            "highlights": [{"lineno": 1, "column": 1, "length": 1, "hint": None}]}]
        }]})

    return str(JSONErrorsFormatter([file], use_colors=False))

from c_formatter_42.formatters.align import align
from c_formatter_42.formatters.hoist import hoist
from c_formatter_42.formatters.line_breaker import line_breaker
from c_formatter_42.formatters.misc import (
    insert_void,
    parenthesize_return,
    remove_multiline_condition_space,
    space_before_semi_colon,
)
from c_formatter_42.formatters.preprocessor_directive import preprocessor_directive
from c_formatter_42.formatters.return_type_single_tab import return_type_single_tab

def run_all(content):
    content = preprocessor_directive(content)
    content = remove_multiline_condition_space(content)
    content = parenthesize_return(content)
    content = space_before_semi_colon(content)
    content = hoist(content)
    content = align(content)
    content = return_type_single_tab(content)
    content = insert_void(content)
    content = line_breaker(content)
    return content
`);

  // Wait for wasm formatter
  if (window.__ftWasmFormatInit) {
    await window.__ftWasmFormatInit().catch(e => {
      console.error("Wasm formatter init error:", e);
    });
  }

  return {
    pyodide,
    runNorminette: async (code, filename) => {
      pyodide.globals.set("source_code", code);
      pyodide.globals.set("file_name", filename || "main.c");
      const resultJson = await pyodide.runPython("run_norminette(source_code, file_name)");
      return JSON.parse(resultJson);
    },
    runFormatter: async (code) => {
      if (!window.__ftWasmFormat) throw new Error("Wasm formatter not available");
      const clangFormatted = window.__ftWasmFormat(code, "main.c");
      pyodide.globals.set("__ft_code", clangFormatted);
      return await pyodide.runPython("run_all(__ft_code)");
    },
  };
}

/**
 * Insert or replace a 42 header in the given code.
 * Returns the new code with the header.
 */
export function insert42HeaderIntoCode(currentCode, filename, user, email) {
  const header = generate42Header(filename, user, email);
  const lines = currentCode.trimStart().split("\n");
  let headerEndLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith("/")) {
      headerEndLine = i;
    } else {
      break;
    }
  }
  let codeStartLine = 0;
  if (headerEndLine >= 0) {
    codeStartLine = headerEndLine + 1;
    while (codeStartLine < lines.length && lines[codeStartLine].trim() === "") {
      codeStartLine++;
    }
  }
  const codeWithoutHeader = lines.slice(codeStartLine).join("\n");
  return header + codeWithoutHeader;
}

// ==========================================
// SHARED STYLES INJECTION
// ==========================================

const SHARED_42_STYLES = `
/* Lint gutter styling */
.cm-lint-marker {
  width: 8px !important;
  height: 8px !important;
}

/* Custom lint panel */
.lint-panel {
  background: #18181b;
  border-top: 1px solid #27272a;
  overflow-y: auto;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
}
.lint-panel-item {
  padding: 4px 12px;
  border-bottom: 1px solid #1e1e2e;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  transition: background-color 0.15s;
}
.lint-panel-item:hover {
  background-color: #27272a;
}
.lint-panel-item .lint-line {
  color: #52525b;
  min-width: 50px;
  flex-shrink: 0;
}
.lint-panel-item .lint-severity {
  font-weight: 600;
  min-width: 40px;
  flex-shrink: 0;
}
.lint-panel-item .lint-severity.error {
  color: #f38ba8;
}
.lint-panel-item .lint-severity.notice {
  color: #f9e2af;
}
.lint-panel-item .lint-name {
  color: #89b4fa;
  min-width: 140px;
  flex-shrink: 0;
}
.lint-panel-item .lint-text {
  color: #a6adc8;
}

/* Status bar */
.status-bar {
  background: #18181b;
  border-top: 1px solid #27272a;
  font-size: 11px;
  padding: 2px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.loading {
  background-color: #f9e2af;
  animation: pulse42 1s infinite;
}
.status-dot.ready {
  background-color: #a6e3a1;
}
.status-dot.error {
  background-color: #f38ba8;
}
.status-dot.ok {
  background-color: #a6e3a1;
}
.status-dot.has-errors {
  background-color: #f38ba8;
}
@keyframes pulse42 {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Modal overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  backdrop-filter: blur(4px);
}
.modal-box {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}
.modal-input {
  width: 100%;
  background: #09090b;
  color: #d4d4d8;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  font-family: 'Courier New', monospace;
}
.modal-input:focus {
  outline: none;
  border-color: #2563eb;
}
.modal-input::placeholder {
  color: #52525b;
}

/* Mode 42 toggle switch */
.mode42-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
}
.mode42-toggle-track {
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: #27272a;
  transition: background-color 0.2s;
  position: relative;
}
.mode42-toggle-track.active {
  background: #f97316;
}
.mode42-toggle-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #a1a1aa;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.2s, background-color 0.2s;
}
.mode42-toggle-track.active .mode42-toggle-thumb {
  transform: translateX(14px);
  background: #ffffff;
}

/* Inline editable filename */
.editable-filename {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.editable-filename .pencil-icon {
  opacity: 0;
  transition: opacity 0.15s;
}
.editable-filename:hover .pencil-icon {
  opacity: 1;
}
`;

let stylesInjected = false;

/**
 * Injects the shared 42 styles into the document head.
 * Safe to call multiple times — only injects once.
 */
export function injectShared42Styles() {
  if (stylesInjected) return;
  const style = document.createElement("style");
  style.textContent = SHARED_42_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}