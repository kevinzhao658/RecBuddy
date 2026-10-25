import Foundation
import Testing
@testable import RecBuddy

@Suite struct LinkRequestTests {
    private func request(_ name: String, _ relationship: String, kind: String = "athlete") -> LinkRequest {
        LinkRequest(id: UUID().uuidString, kind: kind, coachId: "c", athleteId: "a",
                    relationship: relationship, requesterName: name, athleteName: "Maya Chen")
    }

    @Test func decodesTheServerRow() throws {
        let json = #"[{"id":"r1","kind":"athlete","coach_id":"c1","athlete_id":"a1","relationship":"head","requester_name":"Dani Brooks","athlete_name":"Maya Chen","created_at":"2026-10-24T10:00:00+00:00"}]"#
        let rows = try JSONDecoder().decode([LinkRequest].self, from: Data(json.utf8))
        #expect(rows.first?.requesterName == "Dani Brooks")
        #expect(rows.first?.relationship == "head")
    }

    @Test func titleSaysWhatTheCoachIsAskingFor() {
        #expect(LinkRequestText.title(request("Dani Brooks", "head")) == "Dani Brooks wants to be your head coach")
        #expect(LinkRequestText.title(request("Sam Reed", "assistant")) == "Sam Reed wants to coach you")
    }

    @Test func bannerNamesOneCoachOrCountsSeveral() {
        #expect(LinkRequestText.banner([]) == nil)
        #expect(LinkRequestText.banner([request("Sam Reed", "assistant")]) == "Sam Reed wants to coach you")
        #expect(LinkRequestText.banner([request("A", "head"), request("B", "assistant")]) == "2 coaches want to coach you")
    }

    @Test func onlyAthleteRequestsAreShownInTheApp() {
        let rows = [request("A", "head"), request("B", "assistant", kind: "co_coach")]
        #expect(LinkRequestText.forAthlete(rows).map(\.requesterName) == ["A"])
    }
}
