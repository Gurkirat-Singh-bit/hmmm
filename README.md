# Hmmmidea

Hmmmidea is a local-first, voice-first Expo app for capturing ideas, transcribing them, and turning them into structured reports. Ideas and job state remain in SQLite, optional audio stays in app-owned storage, and provider credentials remain in Android SecureStore.

## Requirements

- Bun 1.4+
- Android development build (recording and protected credentials are Android-first)
- User-supplied speech and AI provider credentials

## Development

```bash
bun install
bun run start
```

Open Android directly with:

```bash
bun run android
```

The app uses Expo Router routes under `src/app` and resolves `@/` from `src`.

## Validation

```bash
bun run typecheck
bun run lint
bun test
bun run docs:audit
bunx expo-doctor
```

The JSDoc audit uses the installed TypeScript compiler API and does not require a separate documentation dependency.

## Product boundaries

See [Architecture](docs/ARCHITECTURE.md) for data and provider boundaries and [Design](docs/Design.md) for the visual source of truth.

## License

MIT
