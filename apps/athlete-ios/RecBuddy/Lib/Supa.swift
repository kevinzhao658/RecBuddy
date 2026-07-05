import Foundation
import Supabase

/// The one Supabase client (mirror of coach-web's lib/supabase.ts singleton).
/// URL + anon key come from Info.plist, injected by Config.xcconfig at build.
enum Supa {
    static let shared: SupabaseClient = {
        guard
            let urlString = Bundle.main.object(forInfoDictionaryKey: "SupabaseURL") as? String,
            let key = Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String,
            let url = URL(string: urlString), !key.isEmpty, !key.hasPrefix("<")
        else {
            fatalError("Missing Supabase config — copy Config.example.xcconfig to Config.xcconfig and fill it in.")
        }
        return SupabaseClient(supabaseURL: url, supabaseKey: key)
    }()
}
