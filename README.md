# devbox — portfolio workbench

A workbench-style personal site for **Shibang Das**. Vanilla JS, no build step, no dependencies.

## Run

```bash
cd portfolio
npx serve .          # or: python -m http.server 5173
```

Then open the printed URL. (Open `index.html` via `file://` and the résumé HEAD-check will fail — use a server.)

## Layout

```
portfolio/
├── index.html
├── Shibang_Das_Resume.pdf   ← drop your PDF here (not committed)
└── assets/
    ├── style.css      themes, layout, animation
    ├── data.js        ALL content — edit this first
    ├── views.js       one renderer per "file" section
    ├── terminal.js    the shell command loop
    ├── assistant.js   offline résumé Q&A + query budget
    ├── game.js        Knight Run (unlocks at zero budget)
    └── app.js         shell: tabs, tree, palette, menus, keys
```

## Features

| Feature | Where |
|---|---|
| File tree + tabs (open/close/close-all, middle-click) | left sidebar, tab bar |
| Command palette — files, or `>` for commands | `Ctrl K` / `Ctrl P` |
| Terminal with 20 commands, history, tab-completion | `Ctrl` + backtick |
| Workspace search across all content | rail → Search |
| 6 colour themes, persisted | rail → Appearance, or `theme moss` |
| Editor zoom, resizable sidebar & terminal | `Ctrl +/−/0`, drag handles |
| Offline assistant with query budget | rail → ◆, `Ctrl I` |
| Knight Run mini-game (score 30 → +5 queries) | appears when budget hits 0 |
| Contact form with validation | `contact.sh` |
| Full keyboard control + shortcut sheet | `?` |
| Mobile layout (drawer sidebar, no chrome) | ≤860px |

## Two things to configure

1. **Résumé** — save your PDF as `portfolio/Shibang_Das_Resume.pdf`, or change
   `PROFILE.resume` in `assets/data.js`.
2. **Contact form** — set `FORM_ENDPOINT` at the top of `assets/app.js` to a
   [Formspree](https://formspree.io) (or any JSON POST) URL. Left empty, the form
   falls back to composing a pre-filled email in the visitor's mail client.

## Editing content

Everything visible comes from `assets/data.js` — `PROFILE`, `EXPERIENCE`,
`PROJECTS`, `SKILLS`, `ACHIEVEMENTS`, `LINKS`. Adding a new section means adding a
`FILES` entry plus a matching renderer in `views.js`; the tree, tabs, palette,
search index and `ls`/`cat` pick it up automatically.

## Deploy

Static — drop the folder on Netlify, Vercel, GitHub Pages or Cloudflare Pages. No build command.
