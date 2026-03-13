# Orvyn — AI-Assisted Development

This repository is optimized for AI-assisted development.

## Development Stack
| Tool | Purpose |
|------|---------|
| Claude Code | Terminal-based AI coding assistant |
| Antigravity IDE | AI IDE with skill-based workflows |
| GSD (Get Shit Done) | Spec-driven development + context management |
| UI UX Pro Max | Design system intelligence |
| Shannon | Security auditing (periodic) |

## Setup
```bash
# Install all AI skills and tools
./scripts/install-skills.sh
```

## Key Files

| File | What It Does |
|------|-------------|
| `CLAUDE.md` | 24-section rulebook — architecture, rules, IPC, Redux, endpoints |
| `.claude/context/project.md` | Business context and current development phase |
| `.claude/context/features.md` | Feature status tracker (done / in-progress / planned) |
| `.claude/commands/*.md` | Reusable Claude Code command prompts |
| `design-system/Orvyn/MASTER.md` | AI-generated design system (colors, typography, components) |
| `.agent/skills/` | Antigravity skill modules (installed by script) |

## Architecture
See `CLAUDE.md` sections 1-3 for the full stack, folder structure, and layer responsibilities.
See sections 15-20 for Smart DataRoom, classification engine, IPC channels, and Redux state.

## Design Rules
All UI work follows `design-system/Orvyn/MASTER.md`.
Page-specific overrides are in `design-system/Orvyn/pages/`.
Theme rules are in `CLAUDE.md` Section 11. Responsive rules in Section 14.

## Daily Workflow
1. Write a GSD spec for the feature (`/gsd:spec`)
2. Build using commands (`/project:build-feature "description"`)
3. Polish UI (`/project:refine-ui "component"`)
4. Review security (`/project:review-security`)
5. Run Shannon periodically for penetration testing