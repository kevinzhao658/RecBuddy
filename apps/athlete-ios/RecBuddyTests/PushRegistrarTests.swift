import Testing
import Foundation
@testable import RecBuddy

@Suite struct PushRegistrarTests {
    @Test func hexTokenEncodesLowercaseNoSeparators() {
        let data = Data([0x0A, 0xFF, 0x00, 0x12])
        #expect(PushRegistrar.hexToken(data) == "0aff0012")
    }
    @Test func apnsEnvFollowsTheProvisioningProfileNotBuildConfig() {
        #expect(PushRegistrar.apnsEnv(profileText: nil, isSimulator: true) == "sandbox")
        // Xcode-installed build: profile carries aps-environment development.
        let devProfile = "<key>aps-environment</key>\n\t<string>development</string>"
        #expect(PushRegistrar.apnsEnv(profileText: devProfile, isSimulator: false) == "sandbox")
        // TestFlight/App Store: production (or no embedded profile at all).
        let prodProfile = "<key>aps-environment</key>\n\t<string>production</string>"
        #expect(PushRegistrar.apnsEnv(profileText: prodProfile, isSimulator: false) == "prod")
        #expect(PushRegistrar.apnsEnv(profileText: nil, isSimulator: false) == "prod")
    }
}
