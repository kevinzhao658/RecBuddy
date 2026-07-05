# RecBuddy — Athlete iOS app (sub-project C)

Native SwiftUI (iOS 17+) + supabase-swift. Spec:
`docs/superpowers/specs/2026-07-02-athlete-ios-design.md`.

## Setup
1. Install Xcode + `brew install xcodegen`
2. `cp Config.example.xcconfig Config.xcconfig` and fill the dev anon key
3. `cd apps/athlete-ios && xcodegen generate` → open `RecBuddy.xcodeproj` (or build via xcodebuild)

The project file is generated — edit `project.yml`, not the xcodeproj.
Re-run `xcodegen generate` after adding/removing source files.
