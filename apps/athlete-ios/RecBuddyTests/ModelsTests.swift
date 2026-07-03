import Testing
import Foundation
@testable import RecBuddy

@Suite struct ModelsTests {
    let decoder = JSONDecoder()

    @Test func decodesWorkoutRow() throws {
        let json = """
        {"id":"w1","plan_id":"p1","athlete_id":"a1","date":"2026-07-06","type":"long",
         "title":"Long Run 11 mi","dist":11.0,"pace":"9:25/mi","est_minutes":null,
         "dur":null,"note":"Fuel every 4 miles.","sets":[["Steady","8 mi"],["Finish","3 mi"]],
         "status":"planned"}
        """.data(using: .utf8)!
        let w = try decoder.decode(Workout.self, from: json)
        #expect(w.id == "w1")
        #expect(w.type == "long")
        #expect(w.dist == 11.0)
        #expect(w.sets.count == 2)
        #expect(w.sets[0] == ["Steady", "8 mi"])
        #expect(w.status == "planned")
    }

    @Test func decodesProfileAndMessage() throws {
        let pJson = """
        {"id":"u1","role":"athlete","name":"Jordan Reyes","email":"j@x.com","initials":"JR",
         "experience_level":"returning","primary_goal":"pr","title":null,"avatar_url":null}
        """.data(using: .utf8)!
        let p = try decoder.decode(Profile.self, from: pJson)
        #expect(p.role == "athlete")
        #expect(p.initials == "JR")

        let mJson = """
        {"id":"m1","thread_id":"t1","from_user_id":"u2","kind":"runcard",
         "body":null,"payload":{"title":"Long Run","dist":"9.1 mi","pace":"9:22/mi","time":"1:25:14","hr":152},
         "workout_id":null,"read":true,"created_at":"2026-07-01T10:00:00+00:00"}
        """.data(using: .utf8)!
        let m = try decoder.decode(Message.self, from: mJson)
        #expect(m.kind == "runcard")
        #expect(m.payloadString("title") == "Long Run")
        #expect(m.payloadInt("hr") == 152)
    }

    @Test func decodesPayloadValueEdgeCases() throws {
        let json = #"{"flag":true,"score":3.5,"nothing":null}"#.data(using: .utf8)!
        let vals = try decoder.decode([String: PayloadValue].self, from: json)
        #expect(vals["flag"] == .bool(true))
        #expect(vals["score"] == .double(3.5))
        #expect(vals["nothing"] == .null)
    }
}
