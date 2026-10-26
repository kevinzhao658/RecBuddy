import Testing
import Foundation
@testable import RecBuddy

/// App Store review requires a privacy manifest declaring why the app uses
/// "required reason" APIs. RecBuddy uses UserDefaults for its own settings and
/// the App Group it shares with the widget.
@Suite struct PrivacyManifestTests {
    private func manifest(_ bundle: Bundle) throws -> [String: Any] {
        let url = try #require(bundle.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"))
        let data = try Data(contentsOf: url)
        return try #require(try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any])
    }

    @Test func appDeclaresNoTrackingAndItsUserDefaultsReasons() throws {
        let m = try manifest(.main)
        #expect(m["NSPrivacyTracking"] as? Bool == false)
        let apis = try #require(m["NSPrivacyAccessedAPITypes"] as? [[String: Any]])
        let defaults = try #require(apis.first { $0["NSPrivacyAccessedAPIType"] as? String == "NSPrivacyAccessedAPICategoryUserDefaults" })
        #expect(Set(defaults["NSPrivacyAccessedAPITypeReasons"] as? [String] ?? []) == ["CA92.1", "1C8F.1"])
    }

    @Test func widgetShipsItsOwnManifest() throws {
        let widgets = try #require(Bundle.main.builtInPlugInsURL?.appendingPathComponent("RecBuddyWidgets.appex"))
        let m = try manifest(try #require(Bundle(url: widgets)))
        #expect(m["NSPrivacyTracking"] as? Bool == false)
    }
}
