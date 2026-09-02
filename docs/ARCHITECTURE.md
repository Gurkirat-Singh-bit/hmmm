# Hmmmidea: Product and Architecture

## 1. Product summary

Hmmmidea is a local-first, voice-first mobile idea vault. It is designed for the moment when a person has a useful thought but does not have time to title, tag, or organize it. The shortest successful journey is:

1. Open the app.
2. Tap record and speak naturally.
3. See a live transcript when the selected speech provider supports it.
4. Pause, resume, or finish the recording.
5. Leave while the saved capture is organized in the background.
6. Return to a structured idea that can be searched, questioned, edited, and shared.

The app should remove resistance at capture time. Organization happens after the thought is safe, not before.

## 2. Product principles

- **Capture first.** Recording is the home screen and its primary action.
- **Local ownership.** Ideas, reports, discussions, preferences, and job state live on the device.
- **Raw words remain available.** AI output never replaces the original transcript or optional audio.
- **Calm background work.** Saving is immediate. Transcription and analysis use durable jobs and do not trap the user on a processing screen.
- **Structured, not merely summarized.** An idea becomes a useful report with a gist, evidence, risks, next move, and sources when research is enabled.
- **Provider choice.** Users configure their own speech and AI providers and credentials.
- **Honest limitations.** Network-backed work cannot be guaranteed while a mobile OS has suspended or killed the app.

The visual system is defined separately in [Design.md](./Design.md). That file, not the old prototype, is the source of truth for colors, typography, spacing, shapes, interaction styling, and accessibility.

## 3. Product areas

### 3.1 Capture / Hero

The default route and fastest path to value.

Responsibilities:

- Present one obvious record action with minimal surrounding UI.
- Record source audio and show elapsed time.
- Show live transcription when the configured provider supports streaming.
- Allow pause and resume without losing recorded content.
- Stop and save the capture atomically.
- Show the three most recent ideas and their current processing states.
- Continue background work after navigation when the app remains active.

The UI must distinguish idle, starting, recording, paused, saving, and failure states. Permission denial, missing provider configuration, interrupted audio, and provider errors need recoverable messages.

### 3.2 Vault

The searchable collection of saved captures.

Responsibilities:

- Render ideas clearly with title, summary, date, type, and processing state.
- Search titles, summaries, and transcripts.
- Sort by time, alphabetical order, and future supported sort modes.
- Star important ideas.
- Select and share one or more ideas when the export format supports it.
- Represent empty, no-results, loading, failed, and ready states.

Search and sorting must operate locally and remain usable offline.

### 3.3 Onboarding

A short flow of no more than three substantive setup steps before entering the app.

Responsibilities:

- Explain what Hmmmidea does and that content is stored locally.
- Request microphone permission in context, when it is needed.
- Configure speech-to-text provider, model, language, endpoint where applicable, and key.
- Configure AI/research provider, model, endpoint where applicable, and key.
- Test configurations before saving when practical.
- Let a user revisit or correct setup from Settings.

On completion, route directly to Capture. Secrets must never be placed in route parameters, logs, SQLite, analytics, or exports.

### 3.4 Settings

The control center for provider and data behavior.

Responsibilities:

- Change speech and AI provider/model configuration.
- Persist an app and generated-content language preference.
- Manage notification preferences.
- Enable or disable optional web research.
- Choose whether original audio is retained after successful transcription.
- Export all non-secret user data.
- Delete local data and referenced audio with explicit confirmation.
- Explain where ideas and API keys are stored.
- Provide an in-app workflow guide and answers to common product questions.
- Publish a plain-language privacy policy that describes local storage and direct provider requests.
- Show application version, MIT license, source repository, and issue-tracker links.
- Edit the system prompt only if the product exposes this as an advanced, validated setting.

Settings secondary routes:

| Route | Purpose |
| --- | --- |
| `/settings/providers` | Edit speech and AI providers, credentials, endpoints, and models in place |
| `/settings/language` | Select and persist the preferred language |
| `/settings/how-to-use` | Explain the complete capture-to-report workflow |
| `/settings/faq` | Answer common questions about local data, providers, failures, and exports |
| `/settings/export-data` | Share a JSON copy of non-secret profile and provider configuration |
| `/settings/privacy` | Explain storage, network boundaries, credentials, retention, and exports |
| `/settings/about` | Show app identity, version, MIT license, repository, and issue tracker |

Provider presets and default endpoints belong in dedicated configuration modules, not screen files.

### 3.5 Idea Detail

The structured, section-based representation of one capture.

Initial report sections:

1. **The gist:** what the idea is.
2. **Evidence:** research findings and sources, when research is enabled.
3. **Risk check:** assumptions, weaknesses, and possible failure modes.
4. **Next move:** one concrete action.
5. **Original words:** the trustworthy raw transcript and optional source audio.

Responsibilities:

- Display partial/processing, ready, and failed states without losing access to saved content.
- Link citations through validated HTTPS URLs.
- Open the idea-specific discussion.
- Share the idea as PDF and other deliberately supported formats.
- Support manual edits while keeping AI-generated and user-edited content distinguishable in the data model.
- Support an explicit regenerate/update action; never silently overwrite user edits.

An unknown or deleted capture ID must show a useful not-found state with navigation back to the Vault.

### 3.6 Discuss

There are two levels:

- A primary Discuss screen for choosing an idea or continuing recent threads.
- An idea-specific thread whose context is the selected capture and report.

Responsibilities:

- Persist user and assistant messages locally.
- Let the user question, challenge, refine, or update an idea.
- Stream responses when supported, while preserving a valid partial response on interruption.
- Update the idea only after an explicit user action or clearly confirmed instruction.
- Keep discussions attached to their capture and delete them when that capture is deleted.

Discussion requires network access and a configured AI provider. Existing threads remain readable offline.

## 4. Navigation model

Use Expo Router for file-based routes and deep links. The intended high-level route map is:

```text
Root layout
├── onboarding
├── primary app shell
│   ├── capture (default / hero)
│   ├── vault
│   │   └── [id] (idea report)
│   ├── discuss
│   │   └── [ideaId] (idea conversation)
│   └── settings
│       ├── providers
│       ├── language
│       ├── how-to-use
│       ├── faq
│       ├── export-data
│       ├── privacy
│       └── about
└── not-found
```

The four primary destinations use bottom navigation. Idea detail and idea discussion are secondary stack routes with conventional back navigation. Onboarding appears only until setup is complete, but remains accessible indirectly through Settings when configuration needs repair.

Route files should compose features; they should not contain database queries, provider protocols, export generation, or large blocks of reusable UI.

## 5. Runtime architecture

Hmmmidea starts as one Expo application with no required product backend, hosted database, account system, or server worker.

```text
Screens and components
        │
        ▼
Feature hooks / application services
        │
        ├── local repositories ── SQLite
        ├── secret adapter ────── OS keychain / keystore
        ├── audio adapter ─────── app document directory
        ├── speech adapter ────── configured speech API
        ├── AI adapter ────────── configured AI API
        ├── search adapter ────── configured external search API
        └── export adapter ────── PDF / JSON / native share sheet
```

Dependencies point inward: screens depend on feature interfaces; provider and storage adapters implement those interfaces. Provider-specific request shapes must not leak into screen components or persisted domain records.

### Recording and processing flow

1. Validate microphone permission and provider readiness.
2. Start a local recording and, for a streaming provider, send supported audio chunks for interim transcription.
3. Pause/resume locally while maintaining an accurate session state.
4. On finish, save the audio reference, transcript available so far, capture row, and required job rows.
5. Return the UI to an interactive state immediately.
6. If post-recording transcription is required, a local job uploads the saved audio to the configured speech provider.
7. A subsequent analysis job creates a title, summary, classification, structured report, and optional citations.
8. Store results transactionally and mark the capture ready.
9. If interrupted, requeue running work on the next application start. If a provider fails, store an actionable error and expose retry.

Jobs should be idempotent. A retry must update the existing capture rather than create a duplicate.

### Discussion flow

1. Load the selected capture, report, and locally persisted thread.
2. Persist the user's message before the remote request.
3. Send bounded capture context and recent thread context through the AI adapter.
4. Render streaming output when supported.
5. Persist the final response, or a valid partial response if interrupted.
6. Apply suggested idea changes only through an explicit update command and a transactional repository operation.

## 6. Persistence and data model

SQLite is the source of truth for structured application data. The exact schema will evolve through versioned migrations, but the initial domain needs these records:

| Record | Important fields | Notes |
| --- | --- | --- |
| Capture | id, timestamps, title, summary, kind, status, transcript, audio URI, duration, starred, error | Root record for an idea |
| Report | capture ID, gist, evidence, risks, next step, verdict, sources, revision | Structured separately or stored as validated JSON initially |
| Source | title, URL, domain | Must accept only safe links for opening |
| Message | id, capture ID, role, content, timestamp | Cascade-delete with its capture |
| Job | id, capture ID, kind, status, attempts, last error, timestamps | Durable transcription/analysis work |
| Preference | key/value or typed settings row | Non-secret settings only |

Recommended capture statuses are `transcribing`, `queued`, `naming`, `researching`, `ready`, and `failed`. UI copy can simplify these internal states, but should not infer processing from missing fields alone.

Storage boundaries:

| Data | Storage | Reason |
| --- | --- | --- |
| Captures, reports, messages, jobs, preferences | SQLite | Durable, searchable, transactional |
| Speech, AI, and search API keys | SecureStore / OS keychain or keystore | Secrets stay out of app data and exports |
| Original audio | App document directory | Large binary content does not belong in SQLite |
| Full backup export | User-selected file through native sharing | Portable and intentionally initiated |

Deleting a capture must delete its messages, queued jobs, report, and referenced audio. Deleting all data must be confirmed and should report partial filesystem failures rather than claiming complete success.

## 7. Provider boundaries

Speech, AI, and external search integrations use small provider-neutral interfaces.

Speech capabilities may differ:

- Streaming providers can emit interim and final transcript events while recording.
- Upload-based providers transcribe the saved audio after recording.
- The UI must describe the selected behavior accurately; it must not promise live text for an upload-only provider.

AI capabilities include naming, structured analysis, optional research/citations, and discussion. Model output must be parsed and validated before persistence. Invalid structured output is a recoverable job failure, not data to render optimistically.

Research has two explicit paths. AI-native research uses the selected model's own search tools. External research asks that model to plan one bounded query without tools, sends the query to the selected search adapter, and returns validated snippets and links to the model for report generation. SerpApi with Google organic results is the initial external adapter. A failed path must stop the job with an actionable error and must never silently fall back to another provider.

The provider catalog, base URLs, model defaults, supported capabilities, and request builders belong under provider/configuration modules. Validate custom endpoints and only permit secure network schemes in production.

## 8. Security and privacy

- Provider keys are user-supplied and stored using the platform secret store.
- Keys never enter SQLite, source control, app exports, crash messages, or ordinary logs.
- Direct provider calls place a key in process memory and transmit user content to that provider; onboarding and Settings must state this plainly.
- Users should be encouraged to use restricted, low-limit keys.
- Export files omit secrets by construction.
- Source and custom endpoint URLs must be validated before opening or requesting.
- SerpApi authentication is placed in its request URL only inside the adapter. Credential-bearing URLs and raw responses must never enter errors, logs, telemetry, SQLite, or exports.
- Consent copy must disclose that standard SerpApi searches may be retained for 31 days and that ZeroTrace is limited to Enterprise plans.
- No analytics or telemetry should be introduced without an explicit product decision and disclosure.

The local-first model protects ownership but is not the same as end-to-end encryption. A compromised or rooted device can expose local files or runtime secrets.

## 9. Offline and background behavior

Available offline:

- Browsing and searching existing ideas.
- Reading transcripts, reports, and saved discussions.
- Recording and safely queueing work, when the recording library supports it.
- Editing local content.
- Creating local exports.

Requires network access:

- Remote transcription.
- AI naming, analysis, and research.
- AI discussion.
- Provider configuration tests and model catalog refreshes.

“Background” means the interface remains usable and durable jobs resume safely. It does not guarantee execution after the operating system terminates the app. Guaranteed terminated-app processing would require a server or a carefully scoped native background service and is outside the initial architecture.

## 10. Source organization

Grow the current repository into feature-oriented boundaries while retaining Expo Router conventions:

```text
app/                  route composition and navigation layouts
components/           shared presentational UI and navigation pieces
features/
  captures/           capture use cases, domain types, repositories
  recording/          recording session and audio adapter
  jobs/               durable local job runner
  providers/          speech and AI adapters/configuration
  discussion/         thread use cases
  settings/           typed preferences and setup logic
  export/             PDF/JSON/native sharing
constants/            stable product and design constants
docs/                 product, architecture, and design decisions
```

Rules for implementation:

- Keep route files thin and feature logic testable outside the screen.
- Keep constants, provider presets, prompts, and tokens out of main screen files.
- Use TypeScript for application source.
- Use Bun for installing packages and running scripts. Add packages with `bun add`, never by manually editing dependency declarations.
- Add an external dependency only when the platform or a small maintainable module cannot reasonably provide the capability.
- Use Phosphor icons; do not add React Icons or Lucide.
- Provide error, empty, loading, permission-denied, missing-record, and not-found experiences.

## 11. Testing and delivery expectations

At minimum, test:

- Domain parsing and validation for provider responses.
- Database migrations and repository CRUD/cascade behavior.
- Job interruption, retry, and idempotency.
- Secret/export separation.
- Search and sorting behavior.
- Recording state transitions, including pause/resume and failure.
- Missing capture and invalid route handling.
- Provider endpoint validation.

Before a production build, run the repository's Bun-backed typecheck, lint/format checks, tests, and Expo diagnostics. Native recording must be verified on physical Android and iOS devices; Expo Go may not support the eventual recording module.

## 12. Reference-build policy

The earlier build at `/home/khvalin/Desktop/Code` is a behavioral reference. It demonstrates useful approaches such as local SQLite persistence, SecureStore-backed BYOK credentials, filesystem audio, provider adapters, resumable jobs, report exports, and idea-bound discussions.

It is not the production specification. Do not copy its visual tokens, route names, dependencies, schema, prompts, or components without checking them against:

1. the owner's product map,
2. [Design.md](./Design.md),
3. this architecture,
4. the current repository and platform requirements.

When these disagree, the product map and current documentation win. Any intentional architectural departure should be recorded in this document or a focused decision record under `docs/`.
