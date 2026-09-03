# Hmmmidea: Developer Conventions

This document captures how the Hmmmidea codebase is written, documented, and checked. It is the practical companion to [ARCHITECTURE.md](./ARCHITECTURE.md) (what the product is) and [Design.md](./Design.md) (how it looks).

## Toolchain: Bun is the source of truth

This repository does **not** use `npm`, `npx`, or `node`. Everything runs through **Bun**:

- Install dependencies: `bun install`
- Add a dependency: `bun add <package>` — never hand-edit `package.json` or script around it.
- Run scripts: `bun run <script>` (see `package.json`).

Adding a dependency by wiring it into `package.json` by hand is the one hard rule we do not bend.

## Language: TypeScript, strict

All application source is **TypeScript** (`.ts` / `.tsx`) with `strict: true` enabled. Do not introduce plain JavaScript into `src`.

- `bun run typecheck` runs `tsc --noEmit` and must stay green.
- Path alias `@/*` resolves to `src/*`.

The separate `tests/` and `scripts/` directories are plain JavaScript run by Bun, but they still carry JSDoc file headers (below).

## Documentation convention: JSDoc file headers

Every source and test file must begin with a **file-level JSDoc block** documenting the module. This is enforced by `bun run docs:audit` (`scripts/audit-jsdoc.js`), which uses the TypeScript compiler API — so the check needs no separate documentation dependency.

The required header shape:

```ts
/**
 * @file ExampleThing.tsx
 * @description What this module does and why it exists.
 * @author Gurkirat Singh
 * @license MIT
 */
```

Requirements:

- `@file` must match the filename.
- `@description` must be meaningful — no filler such as "implementation for Hmmmidea."
- `@author Gurkirat Singh` and `@license MIT` are required.

Run the audit locally with:

```bash
bun run docs:audit
```

## Code organization

- **Route files compose features.** `src/app/**` should not contain database queries, provider protocols, export generation, or large reusable UI blocks.
- **Feature logic is separate from screens.** Real behavior lives in `src/features/**`, testable outside React.
- **Constants do not live in screen files.** Colors, spacing, provider presets, prompts, and tokens belong in `src/constants/` or dedicated configuration modules.
- **Keep a clear separation** between frontend concerns and internal functions.

## Icons

Use **Phosphor** icons (`phosphor-react-native`) only. Do not add React Icons or Lucide.

## UI rules

- Always provide **error, empty, loading, permission-denied, missing-record, and not-found** experiences — no screen should be left to fail silently.
- Follow [Design.md](./Design.md) as the sole source of truth for color, typography, spacing, shape, motion, and accessibility.

## Validation checklist

Run the whole set before any production build:

```bash
bun run typecheck
bun run lint
bun test
bun run format:check
bun run docs:audit
bunx expo-doctor
```

## Dependency discipline

Add an external dependency only when the platform or a small maintainable module cannot reasonably provide the capability. Every addition should survive the question: *do we actually need it?*
