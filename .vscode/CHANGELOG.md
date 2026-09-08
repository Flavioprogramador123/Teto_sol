# Changelog — Workspace VS Code / Cursor (Teto_sol)

## 2026-09-07 — Prettier compartilhado + excludes extras

### Como reverter

```powershell
# Remover regras Prettier do repo
Remove-Item .prettierrc.json, .prettierignore -ErrorAction SilentlyContinue

# Voltar settings do workspace ao pack anterior (só node_modules/dist/.temp)
@'
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[javascript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true,
    "**/.temp/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.temp": true
  }
}
'@ | Set-Content .vscode/settings.json -Encoding utf8
```

Ou apague `.prettierrc.json`, `.prettierignore` e restaure `.vscode/settings.json` pelo git (`git checkout -- .vscode/settings.json` se já commitado).

### O que mudou

| Arquivo | Mudança |
|---------|---------|
| `.prettierrc.json` | **Novo** — regras Prettier do projeto (semi, aspas duplas, printWidth 120, LF) |
| `.prettierignore` | **Novo** — ignora node_modules, dist, .venv, storage, projetos, img, md… |
| `.vscode/settings.json` | watcher/search também excluem `.venv`, `storage`, `projetos`, `.vercel`, `.pytest_cache` |

---

## 2026-09-07 — Programmer pack (workspace)

### Como reverter

Apague a pasta `.vscode/` deste projeto, ou remova só os arquivos:

- `.vscode/settings.json`
- `.vscode/extensions.json`

Antes desta data **não havia** `.vscode/` no repo — reverter = deletar esses arquivos.

### O que foi criado

| Arquivo | Conteúdo |
|---------|----------|
| `settings.json` | formatOnSave, Prettier em TS/TSX/JS/JSON, tsdk local, excludes |
| `extensions.json` | recomenda Prettier, ESLint, Error Lens, vscode-icons |

Settings **globais** do Cursor ficam em `%APPDATA%\Cursor\User\` — ver `SETTINGS_CHANGELOG.md` e o backup `settings.backup-2026-09-07-programmer-pack.json` lá.
