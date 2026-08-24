---

name: Soft Wellness
register: product

colors:
canvas: '#FFFFFF'
canvas-soft: '#FAFAFA'
surface: '#FFFFFF'
surface-muted: '#F4F4F4'

ink: '#1C1C1C'
ink-secondary: '#323232'
ink-muted: 'rgba(28, 28, 28, 0.58)'
ink-inverse: '#FFFFFF'

line: 'rgba(28, 28, 28, 0.10)'
line-strong: 'rgba(28, 28, 28, 0.18)'

primary: '#98E2F4'
primary-soft: '#E3F8FC'

happy: '#FDB0E3'
happy-soft: '#FFE7F6'

calm: '#83F5CC'
calm-soft: '#DDFFF1'

dark-canvas: '#1C1C1C'
dark-surface: '#323232'
dark-line: 'rgba(255, 255, 255, 0.12)'

typography:
display: Inter
body: Inter

rounded:
small: 10
medium: 16
large: 24
panel: 30
pill: 999

spacing:
page: 20
section: 28
item: 14
compact: 8
----------

# Soft Wellness

## Visual direction

A calm, friendly mobile interface built from large rounded surfaces, strong black typography, generous whitespace, and a restrained pastel palette.

The visual identity should feel lightweight and human rather than clinical. Most screens remain white or near-white, while emotional states are communicated through cyan, pink, and mint.

The UI should avoid gradients, glassmorphism, heavy shadows, excessive borders, and decorative effects. Personality comes from simple illustrations, expressive pastel areas, rounded controls, and typography.

## Core palette

The primary product color is `#98E2F4`.

Use it for:

* selected controls
* active navigation states
* primary informational cards
* progress indicators
* small icon backgrounds
* highlighted actions

Do not cover entire screens with the primary color. It works best as an accent against white or dark neutral surfaces.

### Emotional colors

`#FDB0E3` represents positive, happy, warm, or emotionally elevated states.

`#83F5CC` represents calm, relaxed, balanced, or completed states.

These colors are semantic accents. Do not randomly alternate between them for ordinary buttons.

Each emotional color has a very pale companion surface for illustrations and large background areas.

## Neutral colors

White is the default application canvas.

Use `#FAFAFA` and `#F4F4F4` when subtle separation from the main canvas is necessary.

Primary text and important controls use `#1C1C1C`.

Secondary dark surfaces use `#323232`.

Avoid pure gray text when possible. Prefer opacity applied to the main ink color so the interface remains visually consistent.

## Dark screens

Dark mode and focused flows use:

* canvas: `#1C1C1C`
* elevated controls: `#323232`
* primary text: `#FFFFFF`
* secondary text: `rgba(255,255,255,0.62)`
* borders: `rgba(255,255,255,0.12)`

Pastel accents retain approximately the same saturation in dark mode.

Dark screens should feel intentionally dark rather than like inverted versions of white screens.

Use them particularly well for focused questionnaires, onboarding steps, modal flows, and distraction-free tasks.

## Typography

Use Inter throughout the product.

Prefer the native system font when matching the operating system is more important than exact visual consistency.

Recommended hierarchy:

* Screen title: 28–32px, 600–700 weight
* Section title: 20–24px, 600 weight
* Card title: 16–18px, 600 weight
* Body: 15–16px, 400–500 weight
* Button: 14–16px, 500–600 weight
* Metadata: 12–13px, 400–500 weight

Typography should remain clean and compact.

Do not use oversized marketing typography inside application screens.

Headings should usually use sentence case rather than uppercase.

## Layout

Use generous whitespace with a default horizontal page padding of approximately 20px.

Major sections should normally have 24–32px between them.

Related controls should remain visually close using 8–14px gaps.

Screens should feel vertically spacious without wasting space.

Do not fill every empty region with cards.

## Cards

Cards use:

* white or pastel background
* 16–24px corner radius
* little or no visible border
* minimal shadow
* generous internal padding

Recommended card padding is 14–18px.

Cards should contain one primary concept.

Avoid deeply nested cards.

Colored cards should usually use cyan or a very pale semantic tint.

## Buttons

### Primary

Primary actions use a near-black background with white text.

They should be visually obvious and normally appear once per major action area.

### Secondary

Secondary buttons use white, muted gray, or outlined surfaces.

### Selected controls

Selected chips, filters, moods, and segmented controls use `#98E2F4`.

A selected state must remain understandable without relying only on color.

### Shape

Buttons are highly rounded.

Use:

* 12–16px radius for rectangular controls
* pill radius for compact filters and choice chips
* minimum touch height of 48px
* 52–56px for important bottom actions

Avoid square buttons unless they are icon-only controls.

## Choice chips

Questionnaire and filter choices use pill-shaped controls.

Default:

* background: `#323232` on dark screens
* text: white
* no heavy border

Selected:

* background: `#98E2F4`
* text: `#1C1C1C`

Maintain approximately 10–12px vertical and 18–22px horizontal padding.

Choice grids should have consistent widths whenever practical.

## Navigation

Use a simple four-item bottom navigation when the app has four primary destinations.

Navigation should:

* sit on a white background
* use simple line icons
* use dark inactive icons
* place the active icon inside a soft cyan rounded container
* keep labels optional when icons are universally understandable

Avoid oversized floating navigation bars or highly decorative docks.

Secondary screens should use conventional back navigation rather than exposing the entire hierarchy.

## Illustrations

Illustrations should be extremely simple.

Use:

* thick black hand-drawn lines
* basic geometric faces
* minimal facial details
* one dominant pastel shape
* large areas of negative space

Illustrations should feel imperfect and friendly rather than polished or 3D.

Do not use detailed vectors, realistic characters, shadows, gradients, or AI-looking imagery.

A typical emotional illustration consists of a pastel circular shape with a simple black-line face.

## Mood states

Mood colors are semantic:

* Happy: `#FDB0E3`
* Calm: `#83F5CC`
* General active / selected: `#98E2F4`

Negative states such as anxiety, stress, sadness, anger, loneliness, and insomnia should normally remain neutral unless the product explicitly requires unique semantic colors.

This prevents the interface from becoming a rainbow of status colors.

## Search

Search fields use:

* white or `#FAFAFA` background
* pill or 16px radius
* subtle or absent border
* dark search icon
* muted placeholder text
* approximately 48px height

Search should visually recede behind the content itself.

## Data visualization

Charts should use thin lines and generous whitespace.

Prefer:

* cyan for the primary trend
* mint for calm or stable states
* pink for happy or elevated states

Avoid filling charts with many colors.

Grid lines should be extremely subtle.

Labels should use muted ink rather than full black.

Charts should feel like part of the interface rather than analytics dashboards.

## Iconography

Use simple rounded line icons.

Recommended libraries:

* Lucide
* Phosphor
* platform-native equivalents

Use consistent stroke weight throughout the application.

Icons should support text rather than replace unclear actions.

Important icon-only buttons require accessibility labels.

## Borders and shadows

Borders should rarely define large sections.

Prefer whitespace and surface changes.

When required:

`rgba(28, 28, 28, 0.10)`

Shadows should be subtle and mostly reserved for floating or physically elevated controls.

Avoid:

* thick black outlines
* neo-brutalist shadows
* glow effects
* colored shadows
* excessive elevation

## Motion

Animation should reinforce state changes.

Use approximately 180–260ms transitions with ease-out timing.

Suitable motion includes:

* selected pill transitions
* cards appearing after an action
* navigation state changes
* chart updates
* illustration state changes
* progress between questionnaire steps

Avoid continuous decorative animation.

Respect reduced-motion preferences.

## Settings

Settings uses the same white canvas as the rest of the primary application shell. It starts with the compact shared Hmmmidea brand header and a seven-day activity summary, followed by grouped actions.

Group settings actions by purpose:

* Configuration: providers, models, credentials, and language.
* Help: the complete product guide and frequently asked questions.
* Data and privacy: non-secret export and the privacy policy.
* About: version, MIT license, repository, and issue reporting.

Each group uses one rounded list surface. Rows include a Phosphor icon, a concise title, one line of supporting copy, and a trailing caret. Secondary settings screens use a conventional circular back button, clear title and supporting copy, and no primary bottom dock.

Provider controls on Settings use light surfaces. The dark provider treatment remains specific to focused onboarding.

## Accessibility

Interactive targets must be at least 48px high or wide.

Never communicate emotional state using color alone.

Maintain strong text contrast, particularly when using cyan, mint, or pink backgrounds.

Pastel surfaces should normally use `#1C1C1C` text.

Support dynamic text sizing without clipping controls.

Provide labels for icon-only controls and meaningful descriptions for charts.

## Product character

The product should feel:

* calm
* warm
* playful
* minimal
* approachable
* modern
* emotionally expressive
* lightweight

It should not feel:

* clinical
* corporate
* childish
* futuristic
* glassy
* overly animated
* dashboard-heavy
* visually cluttered

## Implementation rule

When creating new screens, start with this order of priority:

1. White or dark neutral canvas.
2. Clear black/white typography hierarchy.
3. Generous spacing.
4. Rounded controls and surfaces.
5. Cyan only for interaction and selection.
6. Pink or mint only when emotional meaning requires them.
7. Illustration or motion only when it adds useful emotional feedback.

When unsure, remove visual decoration rather than adding another color, border, card, shadow, or effect.
