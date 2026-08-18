import SwiftUI
import PhotosUI
import Supabase

struct AccountSheet: View {
    let profile: Profile
    let plan: Plan?
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @AppStorage("unit") private var unitRaw = "mi"

    // Photo upload
    @State private var photoItem: PhotosPickerItem?
    @State private var uploadBusy = false
    @State private var uploadError: String?
    @State private var currentAvatarUrl: String?  // tracks post-upload URL locally

    // Coach count for caption
    @State private var coachCount: Int = 0

    private var planCaption: String {
        guard let plan else { return "Not set" }
        var parts: [String] = []
        if let race = plan.goalRace, !race.isEmpty { parts.append(race) }
        if let date = plan.goalDate { parts.append(Week.fmtShortDate(date)) }
        return parts.isEmpty ? "Not set" : parts.joined(separator: " · ")
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RB.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        headerSection
                        profileSection
                        coachesSection
                        preferencesSection
                        connectedServicesSection
                        supportSection
                        accountSection
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 48)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(RB.accent)
                }
            }
            .task { await loadCoachCount() }
            .onAppear { currentAvatarUrl = profile.avatarUrl }
            .onChange(of: photoItem) { _, newItem in
                guard let newItem else { return }
                Task { await uploadPhoto(item: newItem) }
            }
        }
        .presentationDragIndicator(.visible)
    }

    // MARK: – Header

    private var headerSection: some View {
        VStack(spacing: 12) {
            ZStack(alignment: .bottom) {
                avatarView
                    .frame(width: 56, height: 56)
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Text("Change photo")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(RB.accent)
                }
                .offset(y: 22)
            }
            .padding(.bottom, 22)

            VStack(spacing: 4) {
                Text(profile.name)
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Text(profile.email)
                    .font(.subheadline)
                    .foregroundStyle(RB.textMute)
            }

            if uploadBusy {
                ProgressView()
                    .tint(RB.accent)
                    .scaleEffect(0.8)
            }
            if let err = uploadError {
                Text(err)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    @ViewBuilder
    private var avatarView: some View {
        let urlStr = currentAvatarUrl ?? profile.avatarUrl
        if let urlStr, let url = URL(string: urlStr) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let img):
                    img.resizable()
                        .scaledToFill()
                        .frame(width: 56, height: 56)
                        .clipShape(Circle())
                default:
                    initialsCircle
                }
            }
        } else {
            initialsCircle
        }
    }

    private var initialsCircle: some View {
        ZStack {
            Circle().fill(RB.surface2)
            Text(profile.initials)
                .font(.title3.weight(.bold))
                .foregroundStyle(.white)
        }
        .frame(width: 56, height: 56)
    }

    // MARK: – Sections

    private var profileSection: some View {
        sectionGroup(title: "PROFILE") {
            NavigationLink {
                NameProfileView(profile: profile)
            } label: {
                navRow(icon: "person.fill", title: "Name & running profile", caption: profile.name)
            }
            .buttonStyle(.plain)

            NavigationLink {
                GoalSettingsView(profile: profile, plan: plan)
            } label: {
                navRow(icon: "target", title: "Race goal", caption: planCaption)
            }
            .buttonStyle(.plain)

            NavigationLink {
                EmailSettingsView(profile: profile)
            } label: {
                navRow(icon: "envelope.fill", title: "Email", caption: profile.email)
            }
            .buttonStyle(.plain)
        }
    }

    private var coachesSection: some View {
        sectionGroup(title: "COACHES") {
            NavigationLink {
                CoachesView(profile: profile)
            } label: {
                let caption = coachCount == 1 ? "1 coach" : "\(coachCount) coaches"
                navRow(icon: "person.2.fill", title: "Coaches", caption: caption)
            }
            .buttonStyle(.plain)
        }
    }

    private var preferencesSection: some View {
        sectionGroup(title: "PREFERENCES") {
            VStack(alignment: .leading, spacing: 8) {
                RBLabel("DISTANCE UNIT")
                Picker("", selection: $unitRaw) {
                    Text("Miles").tag("mi")
                    Text("Kilometers").tag("km")
                }
                .pickerStyle(.segmented)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .rbCard()
        }
    }

    private var connectedServicesSection: some View {
        sectionGroup(title: "CONNECTED SERVICES") {
            ConnectedServicesSection(athleteId: profile.id)
        }
    }

    private var supportSection: some View {
        sectionGroup(title: "SUPPORT") {
            Link(destination: URL(string: "mailto:kevin@recbuddy.app")!) {
                navRow(icon: "envelope.badge.fill", title: "Contact support", caption: "kevin@recbuddy.app")
            }
            .buttonStyle(.plain)

            NavigationLink {
                TermsView()
            } label: {
                navRow(icon: "doc.text.fill", title: "Terms & Conditions", caption: nil)
            }
            .buttonStyle(.plain)
        }
    }

    private var accountSection: some View {
        sectionGroup(title: "ACCOUNT") {
            Button {
                Task { await session.signOut(); dismiss() }
            } label: {
                Text("Log out")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.red.opacity(0.15))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Log out")

            NavigationLink {
                DeleteAccountView()
            } label: {
                Text("Delete account…")
                    .font(.footnote)
                    .foregroundStyle(RB.textFaint)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: – Helpers

    @ViewBuilder
    private func sectionGroup<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            RBLabel(title)
            content()
        }
    }

    private func navRow(icon: String, title: String, caption: String?) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(RB.surface2)
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 15))
                    .foregroundStyle(RB.textMute)
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                if let caption, !caption.isEmpty {
                    Text(caption)
                        .font(.caption)
                        .foregroundStyle(RB.textMute)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(RB.textFaint)
        }
        .padding(14)
        .rbCard()
    }

    // MARK: – Actions

    private func loadCoachCount() async {
        struct TeamRow: Decodable { let coach_id: String }
        let rows: [TeamRow] = (try? await Supa.shared
            .rpc("get_team", params: ["p_athlete_id": profile.id])
            .execute().value) ?? []
        coachCount = rows.count
    }

    private func uploadPhoto(item: PhotosPickerItem) async {
        uploadBusy = true
        uploadError = nil
        defer { uploadBusy = false }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                uploadError = "Could not read the photo."
                return
            }
            guard data.count < 5 * 1_024 * 1_024 else {
                uploadError = "Photo must be under 5 MB."
                return
            }
            try await Supa.shared.storage
                .from("avatars")
                .upload(
                    "\(profile.id)/avatar",
                    data: data,
                    options: FileOptions(
                        cacheControl: "3600",
                        contentType: "image/jpeg",
                        upsert: true
                    )
                )
            let base = try Supa.shared.storage
                .from("avatars")
                .getPublicURL(path: "\(profile.id)/avatar")
                .absoluteString
            let url = base + "?v=\(Int(Date().timeIntervalSince1970))"
            try await Supa.shared.from("profiles")
                .update(["avatar_url": url])
                .eq("id", value: profile.id)
                .execute()
            currentAvatarUrl = url
            await session.refreshProfile()
        } catch {
            uploadError = "Photo upload failed — try again."
        }
    }
}
