# Web Terminal

> An interactive, floating terminal for your website, built as a single React component.

Visitors can type commands like `help`, `skills` and `projects`, and even write and run small C and Python programs. It runs fully in the browser, with **no backend**.

```
dinethsilva@web:~$ cd code
dinethsilva@web:~$ vim hello.c
dinethsilva@web:~$ gcc hello.c
n=2
n=4
n=6
```

## Table of contents

- [Features](#features)
- [Files](#files)
- [Install](#install)
- [Open it from a button](#open-it-from-a-button)
- [Make it yours](#make-it-yours)
- [Commands](#commands)
- [Working with code](#working-with-code)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [How it works](#how-it-works)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Credits](#credits)

## Features

- 30+ commands, including a fun shell-style set (`neofetch`, `top`, `man`, `sudo`)
- Jump around your page with `goto <section>` and toggle the theme with `theme`
- Virtual file system with `mkdir`, `touch`, `rm`, `cat`, `ls`, `cd`
- Built-in **vim-style editor** with syntax highlighting
- **C interpreter** (`gcc`) and a real **Python REPL** (via Pyodide)
- Draggable, minimizable, maximizable window that collapses to a button on phones
- No dependencies besides React

## Files

| File | Purpose |
|---|---|
| `Terminal.jsx` | The component |
| `terminal.css` | Its styles |
| `LICENSE` | MIT license |

Keep `Terminal.jsx` and `terminal.css` in the same folder.

## Install

1. Copy `Terminal.jsx` and `terminal.css` into your React project (for example `src/components/`).
2. Add the component once, anywhere in your app:

```jsx
import Terminal from './components/Terminal';

export default function App() {
  return (
    <>
      {/* your site */}
      <Terminal />
    </>
  );
}
```

Needs **React 17 or later**. If you use Next.js, add `'use client';` as the first line of `Terminal.jsx`.

## Open it from a button

Give any button this attribute and it will open the terminal when clicked:

```jsx
<button data-action="open-terminal">Terminal</button>
```

You can also press the **`t`** key on the page.

## Make it yours

Open `Terminal.jsx` and edit the text near the top and inside the `commands` object (`about`, `skills`, `projects`, `contact`, `social`, and so on). Change the name in the prompt (`dinethsilva@web`) too.

Colours and sizes are in `terminal.css`.

## Commands

Type `help` in the terminal for the live list.

### About me

| Command | Description |
|---|---|
| `whoami` | Quick intro |
| `about` | Who I am |
| `skills` | Tech I work with |
| `projects` | What I've built |
| `experience` | Where I've studied / worked |
| `contact` | How to reach me |
| `cv` | How to request my CV |
| `social` | GitHub and LinkedIn |
| `articles` / `blog` | Articles status |
| `neofetch` | System-info style summary |

### Page control

| Command | Description |
|---|---|
| `goto <section>` | Scroll the page to an element with that `id` (`about`, `skills`, `projects`, `experience`, `contact`, ...) |
| `cd <section>` | Same as `goto`, written like a shell |
| `theme` | Toggle light / dark |
| `exit` / `logout` | Minimize the terminal |

### Shell basics

| Command | Description |
|---|---|
| `help` | List all commands |
| `ls` | List page sections (or files, inside `~/code`) |
| `pwd` | Print working "directory" |
| `cat <file>` | Print a section (`cat about.txt`) or a file in `~/code` |
| `echo <text>` | Print text back |
| `date` | Current date and time |
| `uname`, `hostname`, `uptime`, `top` | Fun system-style output |
| `history` | Commands run this session |
| `man <command>` | Manual page for a command |
| `sudo ...` | Try it and see |
| `curl` | Politely refuses |
| `clear` | Clear the screen |

### Coding (inside `~/code`)

| Command | Description |
|---|---|
| `cd code` | Enter the writable code folder |
| `mkdir <dir>` | Create a folder |
| `touch <file>` | Create an empty file |
| `rm <file>` / `rm -r <dir>` | Remove a file / a folder with contents |
| `vim <file>` | Edit a file |
| `gcc <file.c>` | Compile and run a C file (built-in interpreter) |
| `python` | Open an interactive Python REPL |
| `python <file.py>` | Run a Python file |
| `run <file>` | Run a `.c` or `.py` file, chosen by extension |

## Working with code

Outside `~/code` the file system is read-only. To write real programs:

```
cd code
touch hello.c
vim hello.c
```

### vim

| Key / command | Action |
|---|---|
| `i` | Enter **INSERT** mode (type normally) |
| `Esc` | Back to **NORMAL** mode |
| `:w` + Enter | Save |
| `:wq` or `:x` + Enter | Save and quit |
| `:q` or `:q!` + Enter | Quit (without saving) |
| `Tab` (insert mode) | Inserts 4 spaces |
| Arrow keys, Home, End, Page Up/Down | Move around in NORMAL mode |

`.c`, `.h` and `.py` files get syntax highlighting.

### Example C program

```c
#include <stdio.h>

int main() {
    int i = 0;
    for (i = 1; i <= 3; i++) {
        printf("n=%d\n", i * 2);
    }
    printf("pi is about %.2f\n", 3.14159);
    return 0;
}
```

Then run it:

```
gcc hello.c
```

### The C interpreter

`gcc` is **not** a real compiler. It's a small interpreter written in JavaScript.

| Supported | Not supported |
|---|---|
| `int`, `long`, `short`, `char`, `unsigned`, `float`, `double` variables | Arrays |
| `+ - * / %`, comparisons, `&&`, `\|\|` | Pointers |
| `++`, `--`, `+=`, `-=`, `*=`, `/=`, `%=` | Functions other than `main` |
| `if` / `else`, `for`, `while` | `scanf` (ignored), structs, strings as variables |
| `printf` with `%d %i %u %f %c %s %x %X %o %%` and precision like `%.2f` | |
| `#define` constants, `#include` (ignored) | |

Loops stop after 100,000 iterations to avoid freezing the page.

### Python

`python` uses [Pyodide](https://pyodide.org) (real Python compiled to WebAssembly). The runtime (about 10 MB) downloads from the jsDelivr CDN **the first time you use it**, then stays cached.

- `python` opens a REPL with `>>>` and `...` prompts. Type `exit()` or `quit()` to leave. `Ctrl+C` cancels the line you're typing.
- `python hello.py` runs a file from `~/code`.
- Quick-command buttons are disabled while the REPL is open.

## Keyboard shortcuts

| Key | Where | Action |
|---|---|---|
| `t` | Anywhere on the page (not while typing in a field) | Open the terminal |
| `Esc` | Terminal maximized | Return to the docked window |
| `Enter` | Input | Run the command |
| `↑` / `↓` | Input | Browse command history |
| `Ctrl+C` | Python REPL | Cancel the current line |

`Ctrl+T`, `Cmd+T` and `Alt+T` are ignored so browser shortcuts still work.

## How it works

1. **Screen.** Output lives in a `lines` state array. Each `appendLine(html)` adds one entry, and React renders them above the input row, so the prompt always stays at the bottom.
2. **Running commands.** Pressing Enter calls `runCommand`, which splits the text into a command and arguments, echoes it (yellow if valid, red if not), looks it up in the `commands` object, and prints whatever the function returns.
3. **File system.** `vfsRef` (files), `vdirsRef` (folders) and `cwdRef` (current folder) hold a fake file system in memory. It is not saved: refreshing the page clears it.
4. **vim.** A transparent `<textarea>` sits on top of a coloured `<pre>`. The textarea handles typing and the caret, and the `<pre>` shows the syntax colours. A small state machine handles NORMAL, INSERT and COMMAND modes.
5. **C.** The source is stripped of comments and `#include`s, `main()` is extracted, split into statements, and executed one by one, with variables stored in an object and expressions evaluated after substituting values.
6. **Python.** Pyodide loads on first use. The REPL feeds each line into Python's `InteractiveConsole`, which reports whether more lines are needed (the `...` prompt).
7. **Window.** A `mode` state adds a CSS class such as `state-docked` or `state-maximized` to the root element. CSS handles size, position and animation. Dragging sets temporary inline `left`/`top` values.

## Limitations

- **Nothing is saved.** Files created in `~/code` disappear on refresh.
- **Not a real compiler.** See the [supported list](#the-c-interpreter).
- **Python needs internet** on first use (the runtime comes from a CDN), and the first load takes a few seconds.
- **No nested paths.** `cd a/b`, `touch a/b.c` and similar are not supported; move one folder at a time.
- **Output is HTML.** Command output is inserted as HTML. User-typed text must go through `escapeHtml` (all built-in commands already do).
- **Client-side only.** The component is meant to be rendered in the browser (see the Next.js note in [Install](#install)).

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing appears | Make sure `<Terminal />` is rendered, and that `terminal.css` is in the same folder as `Terminal.jsx` |
| Button doesn't open it | Check the button has `data-action="open-terminal"` exactly, and that `triggerSelector` hasn't been set to `null` |
| Terminal is hidden behind other content | Raise `z-index` on `.terminal-modal` (default `80`) |
| `theme` command does nothing visible | Pass `theme` and `onToggleTheme` so it updates your React state, or make sure your CSS reads `body[data-theme="dark"]` / `body[data-theme="light"]` |
| `goto contact` says "no section named" | The page needs an element with `id="contact"`. Or pass `onNavigate` for custom behaviour |
| Terminal covers the footer | Pass `footerSelector` matching your footer's selector (default `#siteFooter`) |
| `python` says "could not load the Python runtime" | No internet, or the CDN is blocked by an ad blocker or firewall. Check access to `cdn.jsdelivr.net` |
| Pressing `t` while typing opens the terminal | It shouldn't: the hotkey is ignored inside inputs and textareas. If you use a custom editor, set `hotkey={null}` |
| `Cannot use import statement` / CSS import error | Your bundler needs to support importing `.css` files (Vite, CRA and Next.js do) |

## License

MIT. See the [LICENSE](LICENSE) file. Free to use and modify, just keep the copyright notice.

## Credits

Created by **Dineth Silva** ([dinethsilva.com](https://dinethsilva.com))

Python runs through [Pyodide](https://pyodide.org). Font: [Adwaita Mono](https://fontsource.org/fonts/adwaita-mono).
