# Get Good @ GIT — Terminal Simulator

https://rhoded-uwp.github.io/Get_Good_GIT/

A browser-based, zero-install simulator where intro CS students practice real
Git/GitHub terminal commands against a fake in-memory repository. Students type
real commands; the simulator validates them **in context** and prints what real
Git would print — including the real error messages when a command is typed at
the wrong moment.

Built for an **introductory Python course**: the repo under management is
**Age Safe**, a small age-checking Python program, and the whole story assumes
a **single student** (no teammates) — when the remote is ahead, it's because
the student pushed from the campus lab computer. Branching/merging doubles as
a conditionals lab: `main` holds complex conditionals, branches try nested vs.
parallel (`if/elif/else`) rewrites, and the merge conflict is resolved by
keeping the winning parallel version. Pasting into the terminal is blocked so
commands get typed, not copied.

Built to the spec in [github-simulator-spec.md](github-simulator-spec.md).
Design tokens live in [design-system/get-good-at-git/MASTER.md](design-system/get-good-at-git/MASTER.md).

## Running it

It's a fully static site — no build step, no server, no dependencies.

- **Locally:** open `index.html` in any browser (double-click works).
- **GitHub Pages:** push this folder to a repo, enable Pages on the branch root
  (or move everything into `/docs` and point Pages there). All paths are relative.
- **Canvas LMS:** embed the published Pages URL in an `<iframe>`. No
  localStorage/sessionStorage is used, so sandboxed iframes are fine.
  Suggested embed: `<iframe src="…" width="100%" height="900" style="border:0"></iframe>`

Progress intentionally lives only in page memory and resets on reload —
repetition is the pedagogy.

## Curriculum (one tab per phase)

| Tab | Focus |
|-----|-------|
| **1A — Clone & Commit** | `clone`, `cd`, `status`, `add`, `commit`, `push` — the daily loop, starting from your Age Safe repo on GitHub |
| **1B — Connect Your Repo** | `init`, `remote add origin`, `remote -v`, `branch -M main`, `push -u` — linking local code to an empty GitHub repo (starts on `master` so the rename is meaningful) |
| **2 — Update Program** | `pull` first (you pushed from the lab computer yesterday), `log --oneline`, drilling the loop twice |
| **3 — Branching** | Try rewrites safely: `branch`/`switch` onto `nested-conditionals`, commit, `switch -c parallel-conditionals`, `push -u origin <branch>` — with conditional-style code examples in the hints |
| **4 — Merging** | Parallel conditionals won: `switch main`, `pull` (boundary bug-fix), `merge parallel-conditionals` hits a **deliberate conflict** on the same lines, keep the `if/elif/else` version, `branch -d` |

## Architecture

| File | Role |
|------|------|
| `js/state.js` | Repository state model + per-phase scenario factories (reset = re-seed) |
| `js/git.js` | Tokenizer + one handler per command; context validation, state mutation, realistic output |
| `js/curriculum.js` | Phase/skill definitions; checkpoints detect **state transitions**, not typed strings |
| `js/terminal.js` | Mock terminal styled after VS Code's integrated PowerShell on Windows (`PS C:\CS1430>`), block cursor, ↑/↓ history, Ctrl+C |
| `js/panel.js` | Visible-state sidebar: branch, file statuses, commit graph, ahead/behind sync |
| `js/editor.js` | Modal mini-editor (`edit <file>`) for making changes and resolving conflict markers |
| `js/app.js` | Tab shell, wiring, praise/completion, per-phase reset |

Non-Git helper commands available in the terminal: `ls`, `cd`, `pwd`, `cat`,
`edit`, `touch`, `clear`, `help`.
