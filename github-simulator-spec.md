# GitHub Terminal Simulator — Design Specification

## Purpose

Build a browser-based, interactive simulator that lets introductory computer science students practice **terminal Git/GitHub commands** in a safe, fake environment. Students type real Git commands into a mock terminal; the simulator parses each command, mutates an in-memory repository state, and prints output that mirrors what real Git would show. The goal is muscle memory and conceptual understanding, not a real Git installation.

This is a **teaching tool for a college-level Intro to CS course**. Students will already have a GitHub account. They will NOT be taught how to create an account or a repository through a web browser. The focus is exclusively on the **command-line workflow** inside VS Code's integrated terminal.

## Hard Constraints (read first)

- **Single deliverable: a static site served from GitHub Pages.** No backend, no server, no database, no build step that requires a server runtime. It must work as plain files pushed to a `gh-pages` branch or `/docs` folder and served as static HTML/CSS/JS.
- **No real Git, no real network calls, no real filesystem access.** Everything is simulated in JavaScript. The "filesystem" and "repository" are plain JS objects held in memory.
- **No external runtime dependencies that require a server.** Vanilla JS is strongly preferred. If a library is used it must load from a CDN via `<script>` tag or be vendored as a static file. No npm build pipeline should be *required* to run the final artifact (a build step is acceptable only if its output is still a static bundle servable from GitHub Pages).
- **Self-contained and embeddable.** The final output should be embeddable in a Canvas LMS page via `<iframe>`. Keep it to a single HTML file where reasonable, or a small set of static files with relative paths only. No absolute paths, no assumptions about being served from the domain root.
- **No browser storage APIs that break in sandboxed iframes.** Do not rely on `localStorage` or `sessionStorage` for core functionality, because the artifact may run in a sandboxed iframe where they throw. Hold all state in JS memory for the session. Progress persistence, if added, must degrade gracefully when storage is unavailable.

## Visual / Design System

- **Dark theme.** Terminal-style aesthetic: dark background, light monospace text.
- **Fonts:** JetBrains Mono for the terminal and all code/command text; Outfit for UI chrome (headings, tab labels, instructions).
- **Layout:** Tabbed interface. Each tab is one **Phase** of the curriculum (see below). Within a phase, the student works through a sequence of skills.
- **CSS:** BEM-style class naming. Keep the stylesheet readable and well-organized.
- The mock terminal should look and feel like a real terminal: a prompt line, command history scrolling upward, typed input at the bottom.

## Core Architecture

The heart of the simulator is a **state object** representing the student's local and remote repository, and a **command parser** that interprets typed input and mutates that state.

### Repository State Model

Maintain a JS object that tracks at minimum:

- `currentDirectory` — where the student is (e.g. outside the project, inside it).
- `isGitRepo` — whether `git init` (or `git clone`) has happened in the current folder.
- `files` — a list of files in the working directory, each with a status: `untracked`, `modified`, `staged`, or `committed/clean`.
- `stagingArea` — which files are currently staged.
- `commits` — an ordered list of commits (hash, message, branch).
- `currentBranch` — the branch the student is on.
- `branches` — all local branches.
- `remote` — whether a remote named `origin` is linked, and its URL.
- `remoteCommits` — what exists on the "GitHub" side, so `push` and `pull` have something to diverge from.
- `upstreamSet` — whether the current branch has an upstream tracking branch.

### Command Parser

The parser must:

1. Tokenize the typed line into command + arguments.
2. Validate the command **in context**. A command typed at the wrong time should fail the way real Git fails. Examples:
   - `git status` before `git init` → print the real error: `fatal: not a git repository (or any of the parent directories): .git`
   - `git push` with no commits → behave like real Git (nothing to push / no upstream).
   - `git commit` with nothing staged → `nothing to commit, working tree clean` or the "no changes added to commit" message as appropriate.
   - `git push` before `git remote add origin` and before `-u` → the "no upstream branch" error.
3. Mutate state on success and **print realistic output**. The output text matters: students should recognize it when they see the real thing. Match real Git's wording closely (commit hashes can be faked but should look plausible, e.g. 7-char short hashes).
4. Re-render the terminal and any side panels (file status list, branch indicator, commit log visualizer).

> **Design intent:** The teaching value is in *context-sensitive correctness*. It is not enough to check that the student typed `git add .`; the simulator must verify they typed it at the right moment in the workflow and produce the correct success or error output for the current state. Getting the error messages right is as important as getting the success path right, because beginners learn the workflow by recognizing and recovering from these errors.

## Curriculum: Phases and Skills

The simulator is divided into four phases, each a tab. Phase 1 has two tracks (1A and 1B). Each skill below is a discrete, checkable step the student practices.

### Phase 1A — Clone an Existing Repo (the basic loop)

The "start from the cloud" path. Student copies an existing remote repo down and practices the core commit loop.

- `git clone <url>` — copy an existing remote repo to local
- `cd <repo>` — navigate into the project folder
- `git status` — check the current state
- `git add <file>` — stage a single file
- `git add .` — stage all changes
- `git commit -m "message"` — save a snapshot
- `git push` — upload commits to GitHub

### Phase 1B — Connect Your Own Code to Your Own Repo

The "start from local" path, and the workflow students will actually use for their coursework. They have an empty GitHub repo already created and want to push their existing local code up to it so they can access it from any computer.

**Conceptual distinction to teach:** cloning starts from the cloud and pulls down; this path starts on the local machine and pushes up. The empty repo exists on GitHub, but local Git does not know about it until the two are linked with `git remote add origin`.

- `cd <project-folder>` — navigate into their existing code folder
- `git init` — turn the folder into a Git repository (creates the hidden `.git`)
- `git status` — see all files listed as untracked
- `git add .` — stage everything
- `git commit -m "Initial commit"` — first snapshot, still local only
- `git remote add origin <url>` — link the local repo to their empty GitHub repo (**the critical new concept**)
- `git remote -v` — confirm the link exists (nothing visible happens on `remote add`, so this gives reassurance)
- `git branch -M main` — rename the branch to `main` (matches GitHub's default; avoids master/main mismatch)
- `git push -u origin main` — first push; `-u` sets the upstream so future pushes are just `git push`

**After setup, collapse back to the daily loop.** Make it explicit to students that `init` / `remote add` / `branch -M` / first `-u` push happen **once per project**, and every day after that is just the three commands they already learned: `git add .` → `git commit -m "..."` → `git push`.

**State requirement specific to 1B:** model a folder that is *not yet a repo*, so `git status` before `git init` errors with the real "not a git repository" message. Then transition through three stages: (1) not a repo → (2) initialized but no remote → (3) linked to remote. Triggering the correct error at each wrong moment is the whole lesson.

### Phase 2 — Staying in Sync

- `git pull` — download remote changes before working (teach this as a habit done *before* starting work, to prevent conflicts)
- `git log --oneline` — view commit history as a compact list
- Drill: repeat add → commit → push until it is automatic

### Phase 3 — Branching

- `git branch` — list branches and see the current one
- `git branch <name>` — create a branch
- `git switch <name>` — move onto a branch
- `git switch -c <name>` — create and switch in one step
- `git add` / `git commit` on a branch — show that commits land on the active branch
- `git push -u origin <name>` — push the branch and set its upstream

### Phase 4 — Merging

- `git switch main` — return to main
- `git pull` — update main before merging
- `git merge <name>` — merge the branch into main
- Resolve a merge conflict — deliberately introduce one so the first conflict is not scary
- `git push` — upload the merged result
- `git branch -d <name>` — delete the finished branch

## Pedagogical Behavior Requirements

These shape *how* the simulator teaches, beyond just parsing commands.

1. **Always-available orientation commands.** `git status` and `git log --oneline` are the "where am I?" commands. Beginners get lost without them. Encourage their use and make their output clear and accurate at every state.
2. **Realistic errors, not generic ones.** When a student does something out of order, print the actual Git error for that situation, not a custom "try again" message. The recognition transfer to real Git is the point.
3. **Visible state.** Alongside the terminal, show a panel reflecting the repo state: current branch, list of files with their status (untracked/modified/staged/clean), and a simple commit log or graph. When a command changes state, the panel updates. This makes the invisible model visible, which is essential for `git add` (staging) and `git remote add` (linking), where nothing obvious happens in the terminal.
4. **Checkpoint detection per skill.** Each skill in a phase should be detectable as completed. When the student performs the correct command in the correct context, mark that skill done and give clear positive feedback. A phase is complete when all its skills are checked off.
5. **Guided but not on-rails.** Provide a goal/prompt for each step ("Stage all your changes, then commit them with a message"), but let students type freely and learn from realistic failure. Do not auto-complete or auto-correct their commands.
6. **Reset per phase.** Let students reset a phase to its starting state to practice the sequence again, since repetition is how the loop becomes muscle memory.

## Suggested Build Order (for whoever implements this)

Start with **Phase 1 fully functional** (both 1A and 1B): mock terminal, the state model above, realistic Git output and errors, the visible state panel, and checkpoint detection. This establishes the pattern. Once Phase 1 feels right, scale the same architecture to Phases 2, 3, and 4 by extending the state model (branches, remote divergence, conflicts) and adding the new commands.

## Out of Scope

- Account creation, repo creation via the GitHub website, SSH key setup, authentication tokens.
- Real network or filesystem operations.
- GUI Git tools or the VS Code Source Control panel (this is terminal-only by design).
- Any feature requiring a server, database, or persistent backend.

## Summary of Design Intent

A static, single-file-where-possible, dark-themed, terminal-styled web app, servable from GitHub Pages and embeddable in Canvas via iframe, that simulates the terminal Git workflow for intro CS students. Its teaching power comes from a context-sensitive command parser that produces *real Git output and real Git errors* against an in-memory repository state, paired with a visible state panel that exposes the otherwise-invisible concepts of staging and remote linking. Organized into four tabbed phases progressing from the basic commit loop (including connecting your own local code to your own empty repo) through syncing, branching, and merging.
