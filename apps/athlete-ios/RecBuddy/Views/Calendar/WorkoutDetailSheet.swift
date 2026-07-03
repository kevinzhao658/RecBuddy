import SwiftUI
struct WorkoutDetailSheet: View {
    let workout: Workout
    let store: PlanStore
    let unit: Unit
    var body: some View { Text(workout.title) }
}
