# RecBuddy — Athlete iOS app (sub-project C)

Native SwiftUI (iOS 17+) + supabase-swift. Spec:
`docs/superpowers/specs/2026-07-02-athlete-ios-design.md`.

## Setup
1. Install Xcode + `brew install xcodegen`
2. Create the two build configs (both gitignored) from the template and fill them:
   - `cp Config.example.xcconfig Config.dev.xcconfig` — dev Supabase (Debug)
   - `cp Config.example.xcconfig Config.prod.xcconfig` — prod Supabase (Release)
3. `cd apps/athlete-ios && xcodegen generate` → open `RecBuddy.xcodeproj` (or build via xcodebuild)

The project file is generated — edit `project.yml`, not the xcodeproj.
Re-run `xcodegen generate` after adding/removing source files.

## Environments (dev vs prod)
Two schemes, split by build configuration:

| Scheme | Config | xcconfig | Runs on | Supabase |
|---|---|---|---|---|
| **RecBuddy Dev** | Debug | `Config.dev.xcconfig` | Simulator | dev |
| **RecBuddy Prod** | Release | `Config.prod.xcconfig` | Device | prod |

Pick the scheme matching the destination. Same bundle id, so the two builds
replace each other on a given device (dev and prod have separate user tables →
you re-auth when switching). URLs in xcconfig must escape `//` as `https:/$()/host`
(a bare `//` starts an xcconfig comment).
