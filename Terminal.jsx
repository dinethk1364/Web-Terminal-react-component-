import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './terminal.css';

/* ==========================================================================
   Terminal.jsx — dinethsilva.com popup terminal as a React component.

   Usage:
     import Terminal from './Terminal';
     <Terminal />

   Optional props:
     initialState     'docked' | 'maximized' | 'minimized' | 'closed'   (default 'docked')
     theme            'dark' | 'light'  — current site theme (used by the `theme` command)
     onToggleTheme    (nextTheme) => void  — called by the `theme` command.
                      If omitted, the component sets <body data-theme> + localStorage itself.
     onNavigate       (sectionId) => boolean | void — called by `goto` / `cd <section>`.
                      Return false if the section doesn't exist. If omitted, the component
                      scrolls to document.getElementById(sectionId).
     footerSelector   CSS selector of the footer; the docked terminal shrinks to a
                      button while the footer is visible (default '#siteFooter', null disables)
     hotkey           key that opens the terminal (default 't', null disables)
     triggerSelector  elements that open the terminal when clicked
                      (default '[data-action="open-terminal"]', null disables)
     quickCommands    array of command strings shown as buttons at the bottom
     className        extra class on the root element

   Imperative handle (ref): open(), close(), minimize(), dock(), run(command)
   ========================================================================== */

/* ---------- content (edit these to change what the commands print) ---------- */

const DEFAULT_QUICK_COMMANDS = ['help', 'skills', 'projects', 'experience', 'contact'];

const PROMPT_HTML =
  '<span class="prompt"><span class="prompt-user">dinethsilva</span><span class="prompt-user">@</span><span class="prompt-user">web</span><span class="prompt-sep">:</span><span class="prompt-dir">~</span><span class="prompt-sep">$</span></span>';
const PY_PROMPT_HTML = '<span class="prompt-py">&gt;&gt;&gt;</span>';
const PY_MORE_PROMPT_HTML = '<span class="prompt-py">...</span>';

const WELCOME_HTML = 'Welcome. Type <span class="cmd">help</span> to see available commands.';

const HELP_TEXT = `<span class="cmd">help</span> — show this list
<span class="cmd">whoami</span> — quick intro
<span class="cmd">about</span> — who I am
<span class="cmd">skills</span> — tech I work with
<span class="cmd">projects</span> — what I've built
<span class="cmd">experience</span> — where I've studied / worked
<span class="cmd">goto &lt;section&gt;</span> — jump to a page section
<span class="cmd">contact</span> — reach out
<span class="cmd">cv</span> — request my CV
<span class="cmd">social</span> — find me online
<span class="cmd">neofetch</span> — system info
<span class="cmd">theme</span> — toggle light / dark
<span class="cmd">ls</span> — list page sections
<span class="cmd">pwd</span> — print working "directory"
<span class="cmd">cat &lt;file&gt;</span> — print a section as a file
<span class="cmd">echo &lt;text&gt;</span> — repeat text back
<span class="cmd">date</span> — current date and time
<span class="cmd">uname -a</span> — system identification
<span class="cmd">hostname</span> — print the hostname
<span class="cmd">uptime</span> — how long this "session" has been up
<span class="cmd">top</span> — a very honest process list
<span class="cmd">cd &lt;section&gt;</span> — jump to a section, cd-style
<span class="cmd">history</span> — commands you've run this session
<span class="cmd">man &lt;command&gt;</span> — manual page for a command
<span class="cmd">sudo &lt;anything&gt;</span> — try it and see
<span class="cmd">mkdir &lt;dir&gt;</span> — create a folder (inside ~/code)
<span class="cmd">rm [-r] &lt;name&gt;</span> — remove a file, or a folder with -r (inside ~/code)
<span class="cmd">curl</span> — politely refuses
<span class="cmd">touch &lt;file&gt;</span> — create a file (inside ~/code)
<span class="cmd">cd code</span> — go into the code folder to write real programs
<span class="cmd">vim &lt;file&gt;</span> — edit a file (i: insert, Esc: normal, :w save, :wq save &amp; quit, :q quit)
<span class="cmd">gcc &lt;file.c&gt;</span> — compile &amp; run a simple C file (built-in mini-interpreter, no external API)
<span class="cmd">python</span> — open an interactive Python REPL (via Pyodide, in-browser)
<span class="cmd">python &lt;file.py&gt;</span> — run a Python file (via Pyodide, in-browser)
<span class="cmd">run &lt;file&gt;</span> — same as gcc/python, picked by extension
<span class="cmd">exit</span> / <span class="cmd">logout</span> — close the terminal
<span class="cmd">clear</span> — clear the screen`;

const MAN_PAGES = {
  help: 'help — lists every available command in this terminal.',
  goto: 'goto <section> — scrolls the page to the given section (about, skills, projects, articles, experience, contact).',
  ls: 'ls — lists the page sections as if they were files.',
  cat: 'cat <file> — prints the content of a section "file", e.g. cat about.txt',
  echo: 'echo <text> — prints the text you give it back to the terminal.',
  sudo: "sudo <command> — attempts to run a command as root. Almost certainly won't work here.",
  vim: 'vim <file> — opens the editor. i: insert mode, Esc: normal mode, :w save, :wq save & quit, :q quit.',
  gcc: 'gcc <file.c> — "compiles" and runs a C file with a small built-in interpreter (needs cd code first). Handles declarations, printf, if/for/while and basic arithmetic — not a real compiler, no arrays/pointers/multiple functions.',
  touch: 'touch <file> — creates an empty file (needs cd code first).',
  mkdir: 'mkdir <dir> — creates a folder inside ~/code.',
  rm: 'rm [-r] <name> — removes a file, or a folder (with its contents) using -r. Only works inside ~/code.',
  python: 'python — opens a real interactive Python REPL in-browser via Pyodide. python <file.py> — runs a Python file (needs cd code first).',
  cd: 'cd <target> — cd code to enter the code folder, cd .. to leave, or cd <section> to jump the page.',
};

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';

/* ---------- small helpers ---------- */

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function joinRel(base, name) {
  return base ? `${base}/${name}` : name;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/* ==========================================================================
   Tiny C interpreter (declarations, printf, if/for/while, basic arithmetic)
   ========================================================================== */

function splitTopLevelArgs(str) {
  const args = [];
  let depth = 0, cur = '', inStr = false, strCh = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      cur += c;
      if (c === '\\') { cur += str[++i] || ''; continue; }
      if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function unescapeCString(s) {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\0/g, '\0')
    .replace(/\\\\/g, '\\');
}

function isIntType(t) {
  return t === 'int' || t === 'long' || t === 'short' || t === 'unsigned' || t === 'char';
}

function evalCExpr(expr, vars) {
  let e = expr.trim();
  if (!e) throw new Error('expected an expression');
  // char literals -> their ASCII code, so arithmetic/comparisons on chars just work
  e = e.replace(/'(\\n|\\t|\\0|\\.|[^'\\])'/g, (m, ch) => {
    let real = ch;
    if (ch === '\\n') real = '\n';
    else if (ch === '\\t') real = '\t';
    else if (ch === '\\0') real = '\0';
    else if (ch.length === 2 && ch[0] === '\\') real = ch[1];
    return String(real.charCodeAt(0));
  });
  // substitute known variables (longest names first so prefixes don't clash)
  const names = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const name of names) {
    e = e.replace(new RegExp('\\b' + name + '\\b', 'g'), '(' + Number(vars[name].value) + ')');
  }
  if (/[a-zA-Z_]/.test(e.replace(/\b(true|false)\b/g, ''))) {
    throw new Error(`unknown identifier in expression: ${expr}`);
  }
  try {
    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + e + ');')();
  } catch (err) {
    throw new Error(`cannot evaluate expression: ${expr}`);
  }
}

function execPrintf(argsStr, vars, out) {
  const args = splitTopLevelArgs(argsStr);
  if (!args.length) return;
  let fmt = args[0].trim();
  if (!(fmt.startsWith('"') && fmt.endsWith('"'))) throw new Error('printf format must be a string literal');
  fmt = unescapeCString(fmt.slice(1, -1));
  const restArgs = args.slice(1);
  let argIdx = 0;
  const rendered = fmt.replace(/%[-+ 0#]*\d*(\.\d+)?(l{1,2}[du]|[diouxXeEfFgGcsp%])/g, (m, prec, conv) => {
    if (conv === '%') return '%';
    const argExpr = restArgs[argIdx++];
    if (argExpr === undefined) return m;
    if (conv === 's') {
      const v = argExpr.trim();
      if (v.startsWith('"') && v.endsWith('"')) return unescapeCString(v.slice(1, -1));
      return String(evalCExpr(argExpr, vars));
    }
    const val = evalCExpr(argExpr, vars);
    if (conv === 'c') return String.fromCharCode(Math.trunc(Number(val)));
    if (/^l{0,2}[diu]$/.test(conv)) return String(Math.trunc(Number(val)));
    if (/^[fFeEgG]$/.test(conv)) return Number(val).toFixed(prec ? parseInt(prec.slice(1), 10) : 6);
    if (conv === 'x') return Math.trunc(Number(val)).toString(16);
    if (conv === 'X') return Math.trunc(Number(val)).toString(16).toUpperCase();
    if (conv === 'o') return Math.trunc(Number(val)).toString(8);
    return String(val);
  });
  out.push(rendered);
}

function execStmt(text, vars, out) {
  text = text.trim();
  if (!text) return;

  const declMatch = text.match(/^(int|float|double|char|long|short|unsigned)\s+(.+)$/);
  if (declMatch) {
    const baseType = declMatch[1];
    const rest = declMatch[2];
    if (/\[\s*\d*\s*\]/.test(rest)) throw new Error('arrays are not supported by this mini-interpreter');
    if (rest.includes('*')) throw new Error('pointers are not supported by this mini-interpreter');
    for (const d of splitTopLevelArgs(rest)) {
      const eq = d.indexOf('=');
      const name = (eq === -1 ? d : d.slice(0, eq)).trim();
      if (!/^[a-zA-Z_]\w*$/.test(name)) throw new Error(`bad declaration: ${d}`);
      let value = 0;
      if (eq !== -1) value = evalCExpr(d.slice(eq + 1), vars);
      if (isIntType(baseType)) value = Math.trunc(Number(value));
      vars[name] = { type: baseType, value };
    }
    return;
  }

  if (/^printf\s*\(/.test(text)) {
    execPrintf(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')), vars, out);
    return;
  }
  if (/^scanf\s*\(/.test(text) || /^return\b/.test(text)) return;

  let m = text.match(/^(\w+)\s*(\+\+|--)$/);
  if (m) {
    if (!vars[m[1]]) throw new Error(`unknown variable: ${m[1]}`);
    vars[m[1]].value += m[2] === '++' ? 1 : -1;
    return;
  }
  m = text.match(/^(\+\+|--)\s*(\w+)$/);
  if (m) {
    if (!vars[m[2]]) throw new Error(`unknown variable: ${m[2]}`);
    vars[m[2]].value += m[1] === '++' ? 1 : -1;
    return;
  }

  m = text.match(/^(\w+)\s*(\+=|-=|\*=|\/=|%=)\s*(.+)$/);
  if (m) {
    const v = vars[m[1]];
    if (!v) throw new Error(`unknown variable: ${m[1]}`);
    const rhs = evalCExpr(m[3], vars);
    const ops = {
      '+=': (a, b) => a + b,
      '-=': (a, b) => a - b,
      '*=': (a, b) => a * b,
      '/=': (a, b) => a / b,
      '%=': (a, b) => a % b,
    };
    let nv = ops[m[2]](v.value, rhs);
    if (isIntType(v.type)) nv = Math.trunc(nv);
    v.value = nv;
    return;
  }

  m = text.match(/^(\w+)\s*=\s*(.+)$/);
  if (m) {
    if (!vars[m[1]]) throw new Error(`unknown variable: ${m[1]}`);
    let nv = evalCExpr(m[2], vars);
    if (isIntType(vars[m[1]].type)) nv = Math.trunc(Number(nv));
    vars[m[1]].value = nv;
    return;
  }

  throw new Error(`this mini-interpreter doesn't understand: ${text}`);
}

function parseCBlock(code) {
  const stmts = [];
  let i = 0;
  const n = code.length;
  const skipWs = () => { while (i < n && /\s/.test(code[i])) i++; };
  const readBraceOrSingle = () => {
    skipWs();
    if (code[i] === '{') {
      let depth = 1;
      const start = ++i;
      while (depth > 0 && i < n) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') depth--;
        i++;
      }
      return code.slice(start, i - 1);
    }
    const start = i;
    let depth = 0;
    while (i < n && !(code[i] === ';' && depth === 0)) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
      i++;
    }
    i++;
    return code.slice(start, i);
  };

  while (i < n) {
    skipWs();
    if (i >= n) break;
    const kwMatch = code.slice(i).match(/^(if|for|while)\s*\(/);
    if (kwMatch) {
      const kw = kwMatch[1];
      i += kwMatch[0].length;
      let depth = 1;
      const start = i;
      while (depth > 0 && i < n) {
        if (code[i] === '(') depth++;
        else if (code[i] === ')') depth--;
        i++;
      }
      const cond = code.slice(start, i - 1);
      const body = readBraceOrSingle();
      let elseBody = null;
      if (kw === 'if') {
        const save = i;
        skipWs();
        if (code.slice(i, i + 4) === 'else' && /[\s{]/.test(code[i + 4] || ' ')) {
          i += 4;
          elseBody = readBraceOrSingle();
        } else {
          i = save;
        }
      }
      stmts.push({ type: kw, cond, body, elseBody });
    } else {
      const start = i;
      let depth = 0;
      while (i < n && !(code[i] === ';' && depth === 0)) {
        if (code[i] === '(') depth++;
        else if (code[i] === ')') depth--;
        i++;
      }
      const stmt = code.slice(start, i).trim();
      i++;
      if (stmt) stmts.push({ type: 'stmt', text: stmt });
    }
  }
  return stmts;
}

function execCBlock(stmts, vars, out) {
  const GUARD = 100000;
  for (const s of stmts) {
    if (s.type === 'stmt') {
      execStmt(s.text, vars, out);
    } else if (s.type === 'if') {
      if (evalCExpr(s.cond, vars)) execCBlock(parseCBlock(s.body), vars, out);
      else if (s.elseBody) execCBlock(parseCBlock(s.elseBody), vars, out);
    } else if (s.type === 'while') {
      let guard = 0;
      while (evalCExpr(s.cond, vars) && guard++ < GUARD) execCBlock(parseCBlock(s.body), vars, out);
      if (guard >= GUARD) throw new Error('while loop looked infinite — stopped it');
    } else if (s.type === 'for') {
      const [initPart, condPart, updPart] = s.cond.split(';').map((p) => p.trim());
      if (initPart) execStmt(initPart, vars, out);
      let guard = 0;
      while ((!condPart || evalCExpr(condPart, vars)) && guard++ < GUARD) {
        execCBlock(parseCBlock(s.body), vars, out);
        if (updPart) execStmt(updPart, vars, out);
      }
      if (guard >= GUARD) throw new Error('for loop looked infinite — stopped it');
    }
  }
}

function fakeCompileAndRunC(source) {
  try {
    let code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    const defines = {};
    code = code.replace(/^\s*#define\s+(\w+)\s+(.+)$/gm, (m, name, val) => {
      defines[name] = val.trim();
      return '';
    });
    for (const [name, val] of Object.entries(defines)) {
      code = code.replace(new RegExp('\\b' + name + '\\b', 'g'), val);
    }
    code = code.replace(/^\s*#include\s*[<"].*?[>"]\s*$/gm, '');

    const mainMatch = code.match(/\bmain\s*\([^)]*\)\s*\{/);
    if (!mainMatch) return { error: 'error: no main() function found' };
    const braceStart = mainMatch.index + mainMatch[0].length;
    let depth = 1, i = braceStart;
    while (depth > 0 && i < code.length) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') depth--;
      i++;
    }
    const body = code.slice(braceStart, i - 1);

    const vars = {};
    const out = [];
    execCBlock(parseCBlock(body), vars, out);
    return { output: out.join('') };
  } catch (err) {
    return {
      error: `${err.message} (this is a small built-in interpreter, not a real compiler — it handles declarations, printf, if/for/while and basic arithmetic)`,
    };
  }
}

/* ==========================================================================
   vim syntax highlighter
   ========================================================================== */

function vimLangFor(filename) {
  if (/\.(c|h)$/i.test(filename)) return 'c';
  if (/\.py$/i.test(filename)) return 'python';
  return null;
}

const VIM_TOKEN_PATTERNS = {
  c: /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(^\s*#\s*\w+.*$)|\b(int|char|float|double|void|if|else|for|while|return|struct|typedef|const|static|unsigned|signed|long|short|break|continue|switch|case|default|sizeof|do|enum|union|extern|volatile|goto|auto|register|NULL)\b|\b(\d+\.?\d*f?)\b|\b([a-zA-Z_]\w*)(?=\s*\()/gm,
  python: /(#.*$)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(^\s*@\w+.*$)|\b(def|return|if|elif|else|for|while|import|from|as|class|try|except|finally|with|pass|break|continue|in|is|not|and|or|None|True|False|lambda|yield|global|nonlocal|raise|assert|del|async|await|print)\b|\b(\d+\.?\d*)\b|\b([a-zA-Z_]\w*)(?=\s*\()/gm,
};

function highlightVimCode(code, lang) {
  const pattern = VIM_TOKEN_PATTERNS[lang];
  if (!pattern) return escapeHtml(code);
  let result = '';
  let lastIndex = 0;
  pattern.lastIndex = 0;
  let m;
  while ((m = pattern.exec(code)) !== null) {
    const [full, comment, string, preproc, keyword, number, fname] = m;
    result += escapeHtml(code.slice(lastIndex, m.index));
    if (comment) result += `<span class="tok-com">${escapeHtml(comment)}</span>`;
    else if (string) result += `<span class="tok-str">${escapeHtml(string)}</span>`;
    else if (preproc) result += `<span class="tok-pre">${escapeHtml(preproc)}</span>`;
    else if (keyword) result += `<span class="tok-kw">${escapeHtml(keyword)}</span>`;
    else if (number) result += `<span class="tok-num">${escapeHtml(number)}</span>`;
    else if (fname) result += `<span class="tok-fn">${escapeHtml(fname)}</span>`;
    lastIndex = m.index + full.length;
    if (full.length === 0) pattern.lastIndex++; // guard against zero-width matches
  }
  result += escapeHtml(code.slice(lastIndex));
  return result;
}

/* keys that should keep working natively in vim normal mode (caret/scroll movement, copy, ...) */
const VIM_PASSTHROUGH_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown',
]);

/* ==========================================================================
   Component
   ========================================================================== */

const Terminal = forwardRef(function Terminal(
  {
    initialState = 'docked',
    theme,
    onToggleTheme,
    onNavigate,
    footerSelector = '#siteFooter',
    hotkey = 't',
    triggerSelector = '[data-action="open-terminal"]',
    quickCommands = DEFAULT_QUICK_COMMANDS,
    className = '',
  },
  ref,
) {
  /* ---------- window state ---------- */
  const [mode, setModeState] = useState(initialState); // docked | maximized | minimized | closed
  const [nearFooter, setNearFooter] = useState(false);

  /* ---------- screen content ---------- */
  const lineId = useRef(0);
  const [lines, setLines] = useState(() => [{ id: 0, html: WELCOME_HTML }]);
  const [input, setInput] = useState('');
  const [promptKind, setPromptKind] = useState('shell'); // shell | py | pymore

  /* ---------- session state that doesn't need to trigger renders ---------- */
  const historyRef = useRef({ list: [], index: -1 });
  const cwdRef = useRef('~');
  const vfsRef = useRef({});
  const vdirsRef = useRef(new Set());
  const pyodideRef = useRef(null);
  const pyReplRef = useRef(null); // { pyodide, more } while an interactive Python session is open

  /* ---------- vim ---------- */
  const [vim, setVim] = useState(null); // { filename, mode, cmdBuffer, cmdline, label } | null
  const [vimText, setVimText] = useState('');
  const vimOpenRef = useRef(false);
  const caretRef = useRef(null);
  vimOpenRef.current = !!vim;

  /* ---------- DOM refs ---------- */
  const modalRef = useRef(null);
  const windowRef = useRef(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const vimTextareaRef = useRef(null);
  const vimHighlightRef = useRef(null);

  // latest mode, for document-level listeners
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /* ---------- window controls ---------- */

  const setMode = useCallback((next) => {
    setModeState(next);
    const el = windowRef.current;
    if (el) {
      // forget any position the user dragged the window to
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
      el.style.transform = '';
    }
  }, []);

  const openTerminal = useCallback(() => setMode('maximized'), [setMode]);
  const closeTerminal = useCallback(() => setMode('closed'), [setMode]);
  const minimizeTerminal = useCallback(() => setMode('minimized'), [setMode]);
  const restoreDocked = useCallback(() => setMode('docked'), [setMode]);
  const toggleMaximize = () => setMode(mode === 'maximized' ? 'docked' : 'maximized');

  useEffect(() => {
    if (mode !== 'maximized') return undefined;
    const t = setTimeout(() => {
      if (!vimOpenRef.current) inputRef.current?.focus();
    }, 260);
    return () => clearTimeout(t);
  }, [mode]);

  /* ---------- output helpers ---------- */

  const appendLine = useCallback((html) => {
    setLines((prev) => [...prev, { id: ++lineId.current, html }]);
  }, []);

  // keep the newest output in view
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, promptKind, input]);

  /* ---------- drag to move ---------- */
  const dragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });

  const onTitlePointerDown = (e) => {
    if (e.target.closest('.win-btn')) return; // don't start a drag from the min/max/close buttons
    if (mode !== 'docked' && mode !== 'maximized') return;
    const win = windowRef.current;
    if (!win) return;
    const rect = win.getBoundingClientRect();
    dragRef.current = { dragging: true, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    win.classList.add('dragging');
    win.style.left = `${rect.left}px`;
    win.style.top = `${rect.top}px`;
    win.style.right = 'auto';
    win.style.bottom = 'auto';
    win.style.transform = 'none';
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  };

  const onTitlePointerMove = (e) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    const win = windowRef.current;
    const rect = win.getBoundingClientRect();
    const newLeft = Math.max(4, Math.min(window.innerWidth - rect.width - 4, e.clientX - d.offsetX));
    const newTop = Math.max(4, Math.min(window.innerHeight - rect.height - 4, e.clientY - d.offsetY));
    win.style.left = `${newLeft}px`;
    win.style.top = `${newTop}px`;
  };

  const endDrag = (e) => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    windowRef.current?.classList.remove('dragging');
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
  };

  /* ---------- page integration: footer, hotkey, external trigger buttons ---------- */

  useEffect(() => {
    if (!footerSelector || typeof IntersectionObserver === 'undefined') return undefined;
    const footer = document.querySelector(footerSelector);
    if (!footer) return undefined;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => setNearFooter(entry.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [footerSelector]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (vimOpenRef.current) return;
      if (e.target && e.target.closest && e.target.closest('.vim-textarea')) return;
      if (e.key === 'Escape' && modeRef.current === 'maximized') {
        restoreDocked();
        return;
      }
      if (hotkey && e.key.toLowerCase() === hotkey.toLowerCase() && modeRef.current !== 'maximized') {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const active = document.activeElement;
        const typing =
          active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (!typing) openTerminal();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [hotkey, openTerminal, restoreDocked]);

  useEffect(() => {
    if (!triggerSelector) return undefined;
    const onClick = (e) => {
      if (e.target && e.target.closest && e.target.closest(triggerSelector)) openTerminal();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [triggerSelector, openTerminal]);

  /* ---------- virtual filesystem helpers ---------- */

  const isInsideCode = () => cwdRef.current === '~/code' || cwdRef.current.startsWith('~/code/');
  const codeRelDir = () => (cwdRef.current === '~/code' ? '' : cwdRef.current.slice('~/code/'.length));

  /* ---------- theme / navigation ---------- */

  const currentTheme = () => {
    if (theme) return theme;
    return (typeof document !== 'undefined' && document.body.getAttribute('data-theme')) || 'dark';
  };

  const toggleTheme = () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    if (onToggleTheme) {
      onToggleTheme(next);
    } else {
      document.body.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (_) { /* storage unavailable */ }
    }
    return next;
  };

  // returns true if the section exists (and the page is scrolling to it)
  const goToSection = (target) => {
    if (onNavigate) {
      if (onNavigate(target) === false) return false;
      minimizeTerminal();
      return true;
    }
    const el = target ? document.getElementById(target) : null;
    if (!el) return false;
    minimizeTerminal();
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 150);
    return true;
  };

  /* ---------- Python ---------- */

  const scrollSoon = () => {
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  async function getPyodide() {
    if (pyodideRef.current) return pyodideRef.current;
    appendLine('Loading Python runtime (first run only, a few seconds)...');
    if (!window.loadPyodide) await loadScript(PYODIDE_URL);
    pyodideRef.current = await window.loadPyodide();
    return pyodideRef.current;
  }

  async function runPython(filename) {
    try {
      const pyodide = await getPyodide();
      let output = '';
      pyodide.setStdout({ batched: (s) => { output += s + '\n'; } });
      pyodide.setStderr({ batched: (s) => { output += s + '\n'; } });
      try {
        await pyodide.runPythonAsync(vfsRef.current[filename]);
      } catch (pyErr) {
        output += String(pyErr);
      }
      appendLine(escapeHtml(output.replace(/\n$/, '') || '(no output)'));
    } catch (err) {
      appendLine('run: could not load the Python runtime — check your connection.');
    }
    scrollSoon();
  }

  async function enterPythonRepl() {
    let pyodide;
    try {
      pyodide = await getPyodide();
    } catch (err) {
      appendLine('python: could not load the Python runtime — check your connection.');
      return;
    }

    await pyodide.runPythonAsync(
      'import sys\n' +
      'from code import InteractiveConsole\n' +
      '\n' +
      'class _WebRecorder:\n' +
      '    def __init__(self):\n' +
      "        self.data = ''\n" +
      '    def write(self, s):\n' +
      '        self.data += s\n' +
      '    def flush(self):\n' +
      '        pass\n' +
      '\n' +
      'class _WebQuitter:\n' +
      '    def __init__(self, name):\n' +
      '        self._name = name\n' +
      '    def __call__(self, code=None):\n' +
      '        raise SystemExit(code)\n' +
      '    def __repr__(self):\n' +
      "        return f'Use {self._name}() or Ctrl-D (i.e. EOF) to exit'\n" +
      '\n' +
      "_web_console_ns = {'__name__': '__console__', '__doc__': None}\n" +
      "_web_console_ns['exit'] = _WebQuitter('exit')\n" +
      "_web_console_ns['quit'] = _WebQuitter('quit')\n" +
      '_web_console = InteractiveConsole(_web_console_ns)\n' +
      '_web_rec = _WebRecorder()\n' +
      '\n' +
      'def _web_repl_feed(line):\n' +
      "    _web_rec.data = ''\n" +
      '    _old_out, _old_err = sys.stdout, sys.stderr\n' +
      '    sys.stdout = sys.stderr = _web_rec\n' +
      '    exited = False\n' +
      '    try:\n' +
      '        more = _web_console.push(line)\n' +
      '    except SystemExit:\n' +
      '        more = False\n' +
      '        exited = True\n' +
      '    finally:\n' +
      '        sys.stdout, sys.stderr = _old_out, _old_err\n' +
      '    return [more, _web_rec.data, exited]\n' +
      '\n' +
      'def _web_repl_reset():\n' +
      '    _web_console.resetbuffer()\n',
    );

    const version = pyodide.runPython('import sys; sys.version.split()[0]');
    appendLine(`Python ${version} (Pyodide, in-browser) on web\nType "exit()" or "quit()" to leave the REPL.`);
    pyReplRef.current = { pyodide, more: false };
    setPromptKind('py');
    scrollSoon();
  }

  function pythonReplSubmit(line) {
    const repl = pyReplRef.current;
    const promptHtml = repl.more ? PY_MORE_PROMPT_HTML : PY_PROMPT_HTML;
    appendLine(`${promptHtml} <span class="echo-cmd-valid">${escapeHtml(line)}</span>`);

    historyRef.current.list.push(line);
    historyRef.current.index = historyRef.current.list.length;

    const feed = repl.pyodide.globals.get('_web_repl_feed');
    const resultProxy = feed(line);
    const [more, output, exited] = resultProxy.toJs ? resultProxy.toJs() : resultProxy;
    if (resultProxy.destroy) resultProxy.destroy();
    if (feed.destroy) feed.destroy();

    if (exited) {
      pyReplRef.current = null;
      setPromptKind('shell');
      appendLine('(exited Python REPL)');
    } else {
      repl.more = more;
      if (output) appendLine(escapeHtml(output));
      setPromptKind(more ? 'pymore' : 'py');
    }
  }

  function abortPythonReplLine() {
    const repl = pyReplRef.current;
    if (!repl) return;
    repl.pyodide.runPython('_web_repl_reset()');
    repl.more = false;
    appendLine('KeyboardInterrupt');
    setPromptKind('py');
  }

  function runC(filename) {
    appendLine(`gcc ${escapeHtml(filename)} -o a.out &amp;&amp; ./a.out`);
    const { output, error } = fakeCompileAndRunC(vfsRef.current[filename] || '');
    if (error) appendLine(`gcc: ${escapeHtml(error)}`);
    else appendLine(escapeHtml(output || '(no output)'));
  }

  /* ---------- vim ---------- */

  const patchVim = (patch) => setVim((v) => (v ? { ...v, ...patch } : v));

  function openVimEditor(filename) {
    const vfs = vfsRef.current;
    const exists = hasOwn(vfs, filename);
    setVimText(exists ? vfs[filename] : '');
    caretRef.current = exists ? vfs[filename].length : 0;
    setVim({
      filename,
      mode: 'normal',
      cmdBuffer: '',
      cmdline: '',
      label: `"${filename}"${exists ? '' : ' [New]'}`,
    });
  }

  function closeVimEditor() {
    setVim(null);
  }

  // focus + caret when vim opens, and give focus back to the shell when it closes
  const wasVimOpen = useRef(false);
  const vimFilename = vim ? vim.filename : null;
  useLayoutEffect(() => {
    if (vim && !wasVimOpen.current) {
      const ta = vimTextareaRef.current;
      if (ta) {
        ta.focus();
        const end = caretRef.current ?? ta.value.length;
        ta.setSelectionRange(end, end);
        caretRef.current = null;
      }
    } else if (!vim && wasVimOpen.current) {
      inputRef.current?.focus();
    }
    wasVimOpen.current = !!vim;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vimFilename]);

  // restore the caret after programmatic edits (Tab key in insert mode)
  useLayoutEffect(() => {
    if (caretRef.current != null && vimTextareaRef.current && vim) {
      vimTextareaRef.current.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  }, [vimText, vim]);

  function executeVimCommand(cmd) {
    const c = cmd.trim();
    const name = vim.filename;
    if (c === 'w' || c === 'wq' || c === 'x') vfsRef.current[name] = vimText;

    if (c === 'w') {
      patchVim({ mode: 'normal', cmdBuffer: '', cmdline: `"${name}" written`, label: `"${name}"` });
    } else if (c === 'wq' || c === 'x') {
      closeVimEditor();
      appendLine(`"${escapeHtml(name)}" written`);
    } else if (c === 'q' || c === 'q!') {
      closeVimEditor();
    } else {
      patchVim({ mode: 'normal', cmdBuffer: '', cmdline: `E: not an editor command: ${cmd}` });
    }
  }

  const onVimKeyDown = (e) => {
    if (!vim) return;

    if (vim.mode === 'insert') {
      if (e.key === 'Escape') {
        e.preventDefault();
        patchVim({ mode: 'normal' });
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        caretRef.current = start + 4;
        setVimText(vimText.slice(0, start) + '    ' + vimText.slice(end));
      }
      return;
    }

    if (vim.mode === 'command') {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeVimCommand(vim.cmdBuffer);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        patchVim({ mode: 'normal', cmdBuffer: '', cmdline: '' });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        const buf = vim.cmdBuffer.slice(0, -1);
        patchVim({ cmdBuffer: buf, cmdline: ':' + buf });
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const buf = vim.cmdBuffer + e.key;
        patchVim({ cmdBuffer: buf, cmdline: ':' + buf });
      }
      return;
    }

    // normal mode
    if (VIM_PASSTHROUGH_KEYS.has(e.key) || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    if (e.key === 'i') {
      patchVim({ mode: 'insert' });
    } else if (e.key === ':') {
      patchVim({ mode: 'command', cmdBuffer: '', cmdline: ':' });
    }
  };

  const vimHighlightHtml = useMemo(
    () => (vim ? highlightVimCode(vimText, vimLangFor(vim.filename)) + '\n' : ''),
    [vim, vimText],
  );

  const onVimScroll = (e) => {
    const hl = vimHighlightRef.current;
    if (!hl) return;
    hl.scrollTop = e.currentTarget.scrollTop;
    hl.scrollLeft = e.currentTarget.scrollLeft;
  };

  /* ---------- commands ---------- */

  const commands = {
    help: () => HELP_TEXT,
    whoami: () => "visitor — but you're here to learn about Dineth, a Computer Science student.",
    about: () =>
      'First-year Computer Science undergraduate at the University of Colombo School of Computing (UCSC). Exploring Full-Stack Development, Linux environments, Cloud Engineering, and modern software workflows.',
    skills: () =>
      'Languages: C, JavaScript, Python, HTML/CSS\nFrameworks & Libraries: React, Node Js, Spring Boot\nDevOps Tools, Databases, Cloud & Version Control, Linux Environments.',
    projects: () =>
      '1. Web GNU Terminal\n2. PulseWave — Web Synthesizer\n3. E-commerce site\n4. DirectDrop — P2P File Tunnel\nType "goto projects" to see the full section.',
    experience: () =>
      'BSc in Computer Science, University of Colombo School of Computing (2026 — present).\nType "goto experience" for the full timeline.',
    contact: () => 'Email: contact@dinethsilva.com\nType "goto contact" to use the contact form.',
    cv: () => 'CV requests: email contact@dinethsilva.com with the subject "CV request".',
    social: () =>
      'GitHub: github.com/dinethk1364\nLinkedIn: linkedin.com/in/dineth-kaveeshwara-16a0a11b2',
    blog: () => 'No articles published yet — check back soon.',
    articles: () => 'No articles published yet — check back soon.\nType "goto articles" to see the section.',
    neofetch: () => `dinethsilva@web
-------------------------
OS: DinethOS (student build)
Languages: C, JavaScript, Python
Currently: BSc Computer Science
Uptime: still learning
Shell: this terminal`,

    theme: () => `theme set to ${toggleTheme()}`,

    clear: () => {
      setLines([]);
      return null;
    },

    pwd: () => {
      if (!isInsideCode()) return '/home/dinethsilva/portfolio';
      const rel = codeRelDir();
      return `/home/dinethsilva/portfolio/code${rel ? '/' + rel : ''}`;
    },

    ls: () => {
      if (isInsideCode()) {
        const prefix = codeRelDir() ? codeRelDir() + '/' : '';
        const dirNames = new Set();
        vdirsRef.current.forEach((d) => {
          if (d.startsWith(prefix)) {
            const remainder = d.slice(prefix.length);
            if (remainder && !remainder.includes('/')) dirNames.add(remainder);
          }
        });
        const fileNames = [];
        Object.keys(vfsRef.current).forEach((f) => {
          if (f.startsWith(prefix)) {
            const remainder = f.slice(prefix.length);
            if (remainder && !remainder.includes('/')) fileNames.push(remainder);
          }
        });
        const entries = [...dirNames].sort().map((d) => `${d}/`).concat(fileNames.sort());
        return entries.length ? entries.join('  ') : '(empty — try: touch hello.c or mkdir sub)';
      }
      return 'about.txt  skills.txt  projects.txt  articles.txt  experience.txt  contact.txt  code/';
    },

    cat: (args) => {
      const file = args[0] || '';
      if (!file) return 'usage: cat <file>';
      if (isInsideCode()) {
        const rel = joinRel(codeRelDir(), file);
        if (vdirsRef.current.has(rel)) return `cat: ${escapeHtml(file)}: Is a directory`;
        if (hasOwn(vfsRef.current, rel)) return escapeHtml(vfsRef.current[rel]) || '(empty file)';
        return `cat: ${escapeHtml(file)}: No such file or directory`;
      }
      const fileMap = ['about', 'skills', 'projects', 'articles', 'experience', 'contact'];
      const key = file.toLowerCase().replace(/\.txt$/, '');
      if (fileMap.includes(key)) return commands[key]();
      return `cat: ${escapeHtml(file)}: No such file or directory`;
    },

    echo: (args) => escapeHtml(args.join(' ')),

    date: () => new Date().toString(),

    uname: () => 'DinethOS 1.0 portfolio-terminal x86_64',

    history: () => {
      const list = historyRef.current.list;
      return list.length ? list.map((h, i) => `${i + 1}  ${escapeHtml(h)}`).join('\n') : 'no commands yet';
    },

    man: (args) => {
      const key = (args[0] || '').toLowerCase();
      if (!key) return 'usage: man <command>';
      return hasOwn(MAN_PAGES, key) ? escapeHtml(MAN_PAGES[key]) : `No manual entry for ${escapeHtml(key)}`;
    },

    sudo: () => 'dinethsilva is not in the sudoers file. This incident will be reported. (not really.)',

    hostname: () => 'web',

    uptime: () => 'up since you opened this page — still learning, 0 crashes today',

    top: () => 'PID   COMMAND\n1     studying\n2     debugging\n3     drinking coffee\n4     this terminal',

    cd: (args) => {
      const raw = args[0] || '';
      if (!raw || raw === '~') { cwdRef.current = '~'; return commands.pwd(); }
      if (raw === '..') {
        if (cwdRef.current === '~') return commands.pwd();
        if (cwdRef.current === '~/code') { cwdRef.current = '~'; return commands.pwd(); }
        const parts = cwdRef.current.split('/');
        parts.pop();
        cwdRef.current = parts.join('/');
        return commands.pwd();
      }
      if (!isInsideCode()) {
        const target = raw.toLowerCase().replace(/^~\/?/, '');
        if (target === 'code') { cwdRef.current = '~/code'; return commands.pwd(); }
        if (goToSection(target)) return `cd: moved to ${escapeHtml(target)}`;
        return `cd: no such file or directory: ${escapeHtml(raw)}`;
      }
      if (raw.includes('/')) return 'cd: nested paths not supported — cd one folder at a time';
      const rel = joinRel(codeRelDir(), raw);
      if (vdirsRef.current.has(rel)) { cwdRef.current = `~/code/${rel}`; return commands.pwd(); }
      if (hasOwn(vfsRef.current, rel)) return `cd: ${escapeHtml(raw)}: Not a directory`;
      return `cd: no such file or directory: ${escapeHtml(raw)}`;
    },

    mkdir: (args) => {
      if (!isInsideCode()) return 'mkdir: cannot create directory — try: cd code';
      const name = args[0];
      if (!name) return 'usage: mkdir <dirname>';
      if (name.includes('/') || name === '.' || name === '..') return 'mkdir: invalid directory name';
      const rel = joinRel(codeRelDir(), name);
      if (vdirsRef.current.has(rel) || hasOwn(vfsRef.current, rel)) {
        return `mkdir: cannot create directory '${escapeHtml(name)}': File exists`;
      }
      vdirsRef.current.add(rel);
      return null;
    },

    touch: (args) => {
      if (!isInsideCode()) return 'touch: cannot touch — read-only filesystem. (works inside ~/code — try: cd code)';
      const name = args[0];
      if (!name) return 'usage: touch <filename>';
      if (name.includes('/')) return 'touch: nested paths not supported — cd into the folder first';
      const rel = joinRel(codeRelDir(), name);
      if (vdirsRef.current.has(rel)) return `touch: cannot touch '${escapeHtml(name)}': Is a directory`;
      if (!hasOwn(vfsRef.current, rel)) vfsRef.current[rel] = '';
      return null;
    },

    rm: (args) => {
      if (!isInsideCode()) {
        return args.join(' ').includes('-rf')
          ? "nice try — this isn't a real filesystem."
          : 'rm: read-only filesystem. (works inside ~/code — try: cd code)';
      }
      const flags = args.filter((a) => a.startsWith('-'));
      const targets = args.filter((a) => !a.startsWith('-'));
      const recursive = flags.some((f) => f.includes('r'));
      const name = targets[0];
      if (!name) return 'usage: rm [-r] <name>';
      if (name.includes('/')) return 'rm: nested paths not supported — cd into the folder first';
      const rel = joinRel(codeRelDir(), name);
      const vdirs = vdirsRef.current;
      const vfs = vfsRef.current;
      if (vdirs.has(rel)) {
        if (!recursive) return `rm: cannot remove '${escapeHtml(name)}': Is a directory (use rm -r)`;
        const prefix = rel + '/';
        vdirs.delete(rel);
        [...vdirs].forEach((d) => { if (d.startsWith(prefix)) vdirs.delete(d); });
        Object.keys(vfs).forEach((f) => { if (f.startsWith(prefix)) delete vfs[f]; });
        return null;
      }
      if (hasOwn(vfs, rel)) {
        delete vfs[rel];
        return null;
      }
      return `rm: cannot remove '${escapeHtml(name)}': No such file or directory`;
    },

    curl: () => 'curl: (6) could not resolve host — no real network access from this terminal.',

    vim: (args) => {
      if (!isInsideCode()) return 'vim: you can only edit files in ~/code — try: cd code';
      const file = args[0];
      if (!file) return 'usage: vim <filename>';
      if (file.includes('/')) return 'vim: nested paths not supported — cd into the folder first';
      const rel = joinRel(codeRelDir(), file);
      if (vdirsRef.current.has(rel)) return `vim: ${escapeHtml(file)}: Is a directory`;
      openVimEditor(rel);
      return null;
    },

    run: (args) => {
      if (!isInsideCode()) return 'run: only files in ~/code can be executed — try: cd code';
      const file = args[0];
      if (!file) return 'usage: run <file.c|file.py>';
      const rel = joinRel(codeRelDir(), file);
      if (!hasOwn(vfsRef.current, rel)) return `run: ${escapeHtml(file)}: No such file`;
      if (rel.endsWith('.c')) { runC(rel); return null; }
      if (rel.endsWith('.py')) { runPython(rel); return null; }
      return 'run: unsupported file type — use .c or .py';
    },

    gcc: (args) => {
      if (!isInsideCode()) return 'gcc: only files in ~/code can be compiled — try: cd code';
      const file = args[0];
      if (!file) return 'usage: gcc <file.c>';
      if (!file.endsWith('.c')) return 'gcc: expected a .c file';
      const rel = joinRel(codeRelDir(), file);
      if (!hasOwn(vfsRef.current, rel)) return `gcc: ${escapeHtml(file)}: No such file`;
      runC(rel);
      return null;
    },

    python: (args) => {
      const file = args[0];
      if (!file) { enterPythonRepl(); return null; }
      if (!isInsideCode()) return 'python: only files in ~/code can be run — try: cd code';
      if (!file.endsWith('.py')) return 'python: expected a .py file';
      const rel = joinRel(codeRelDir(), file);
      if (!hasOwn(vfsRef.current, rel)) return `python: ${escapeHtml(file)}: No such file`;
      runPython(rel);
      return null;
    },

    exit: () => { minimizeTerminal(); return 'logging out...'; },
    logout: () => { minimizeTerminal(); return 'logging out...'; },
  };

  const isKnownCommand = (key) => !!key && (key === 'goto' || hasOwn(commands, key));

  function runCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    historyRef.current.list.push(trimmed);
    historyRef.current.index = historyRef.current.list.length;

    const [cmd, ...args] = trimmed.split(/\s+/);
    const key = cmd.toLowerCase();
    const known = isKnownCommand(key);
    appendLine(
      `${PROMPT_HTML} <span class="${known ? 'echo-cmd-valid' : 'echo-cmd-invalid'}">${escapeHtml(trimmed)}</span>`,
    );

    if (key === 'goto') {
      const target = (args[0] || '').toLowerCase();
      if (goToSection(target)) {
        appendLine(`jumping to "${escapeHtml(target)}"...`);
      } else {
        appendLine(
          `no section named "${escapeHtml(target)}". try: about, skills, projects, experience, contact`,
        );
      }
    } else if (known) {
      const output = commands[key](args);
      if (output) appendLine(output);
    } else {
      appendLine(`command not found: ${escapeHtml(cmd)}. Type "help" for available commands.`);
    }
  }

  useImperativeHandle(ref, () => ({
    open: openTerminal,
    close: closeTerminal,
    minimize: minimizeTerminal,
    dock: restoreDocked,
    run: (command) => runCommand(command),
  }));

  /* ---------- input handling ---------- */

  const firstWord = input.trim().split(/\s+/)[0] || '';
  const inputClass =
    promptKind !== 'shell'
      ? 'terminal-input'
      : `terminal-input${firstWord ? (isKnownCommand(firstWord.toLowerCase()) ? ' cmd-valid' : ' cmd-invalid') : ''}`;

  const onInputKeyDown = (e) => {
    const h = historyRef.current;
    if (pyReplRef.current && e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      abortPythonReplLine();
      setInput('');
      return;
    }
    if (e.key === 'Enter') {
      if (pyReplRef.current) pythonReplSubmit(input);
      else runCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (h.index > 0) {
        h.index--;
        setInput(h.list[h.index] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (h.index < h.list.length - 1) {
        h.index++;
        setInput(h.list[h.index] || '');
      } else {
        h.index = h.list.length;
        setInput('');
      }
    }
  };

  const onQuickCommand = (cmd) => {
    if (pyReplRef.current) return;
    runCommand(cmd);
    setInput('');
  };

  const onBodyClick = () => {
    const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection().toString() : '';
    if (!sel) inputRef.current?.focus(); // don't steal focus while the user is selecting output
  };

  const promptNode =
    promptKind === 'py' ? (
      <span className="prompt-py">&gt;&gt;&gt;</span>
    ) : promptKind === 'pymore' ? (
      <span className="prompt-py">...</span>
    ) : (
      <span className="prompt">
        <span className="prompt-user">dinethsilva</span>
        <span className="prompt-user">@</span>
        <span className="prompt-user">web</span>
        <span className="prompt-sep">:</span>
        <span className="prompt-dir">~</span>
        <span className="prompt-sep">$</span>
      </span>
    );

  const modalClass = [
    'terminal-modal',
    `state-${mode}`,
    nearFooter ? 'near-footer' : '',
    className,
  ].filter(Boolean).join(' ');

  const vimModeLabel = vim && vim.mode === 'insert' ? '-- INSERT --' : '-- NORMAL --';

  return (
    <div ref={modalRef} className={modalClass} aria-hidden={mode === 'closed'}>
      <div className="terminal-modal-backdrop" onClick={restoreDocked} />
      <div
        ref={windowRef}
        className={`terminal-window${vim ? ' vim-active' : ''}`}
        role="dialog"
        aria-label="Interactive terminal"
      >
        <button type="button" className="terminal-fab-icon" onClick={openTerminal} aria-label="Open terminal">
          &gt;_
        </button>

        <div
          className="terminal-titlebar"
          onPointerDown={onTitlePointerDown}
          onPointerMove={onTitlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="terminal-title">~:zsh-Terminal</span>
          <div className="win-controls">
            <button type="button" className="win-btn win-min" onClick={minimizeTerminal} title="Minimize" aria-label="Minimize terminal">
              &#8211;
            </button>
            <button type="button" className="win-btn win-max" onClick={toggleMaximize} title="Maximize" aria-label="Maximize terminal">
              &#9633;
            </button>
            <button type="button" className="win-btn win-close" onClick={closeTerminal} title="Close" aria-label="Close terminal">
              &times;
            </button>
          </div>
        </div>

        <div className="terminal-body" ref={bodyRef} tabIndex={0} onClick={onBodyClick}>
          {lines.map((line) => (
            <div key={line.id} className="terminal-line" dangerouslySetInnerHTML={{ __html: line.html }} />
          ))}
          <div className="terminal-inputrow">
            {promptNode}
            <input
              ref={inputRef}
              type="text"
              className={inputClass}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKeyDown}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Terminal command input"
            />
          </div>
        </div>

        <div className="vim-overlay">
          <div className="vim-status-top">
            {vim && `~/code/${vim.filename} — vim  (i: insert, Esc: normal, :w save, :wq save & quit, :q quit)`}
          </div>
          <div className={`vim-editor-wrap${vim && vim.mode === 'insert' ? ' is-typing' : ''}`}>
            <pre className="vim-highlight" ref={vimHighlightRef} aria-hidden="true">
              <code dangerouslySetInnerHTML={{ __html: vimHighlightHtml }} />
            </pre>
            <textarea
              ref={vimTextareaRef}
              className="vim-textarea"
              spellCheck={false}
              readOnly={!vim || vim.mode !== 'insert'}
              value={vimText}
              onChange={(e) => setVimText(e.target.value)}
              onKeyDown={onVimKeyDown}
              onScroll={onVimScroll}
            />
          </div>
          <div className="vim-status-bottom">
            <span className="vim-mode">{vimModeLabel}</span>
            <span className="vim-filename">{vim ? vim.label : ''}</span>
            <span className="vim-cmdline">{vim ? vim.cmdline : ''}</span>
          </div>
        </div>

        <div className="terminal-quickrow">
          {quickCommands.map((cmd) => (
            <button type="button" key={cmd} onClick={() => onQuickCommand(cmd)}>
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default Terminal;
