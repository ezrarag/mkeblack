################################################################################
#                                                                              #
#   MKE BLACK iOS APP — SWIFT BUILD PLAN                                      #
#   Target: Monday meeting demo + TestFlight invite path                       #
#   Generated: April 2026                                                      #
#                                                                              #
#   STRATEGY                                                                   #
#   Build a focused preview app — not all of Phase 4, but the                 #
#   3 screens that make the strongest case in the meeting:                     #
#   1. Directory with Near Me + Now Open + Map                                 #
#   2. Business profile (photos, hours, contact)                               #
#   3. Solidarity Circle / Membership CTA                                      #
#                                                                              #
#   Same Firebase project (mkeblack-c6dfe) as the website.                    #
#   One database — the key ask from the spec.                                  #
#   Real data from the imported CSV shows immediately.                         #
#                                                                              #
#   PAYMENT ANGLE FOR THE MEETING                                              #
#   "To get this on your iPhone for testing, two things are needed:            #
#    1. Payment for the build work (RAG development fee)                       #
#    2. Apple Developer Account ($99/year) — required to distribute           #
#       via TestFlight to your devices. Currently using my personal            #
#       dev cert which expires/limits to my own devices."                      #
#                                                                              #
#   This is a clean ask: they want to test it → they need to pay.             #
#   TestFlight = the proof. App Store = the goal.                             #
#                                                                              #
################################################################################


================================================================================
XCODE PROJECT SETUP
================================================================================

Project name: MKEBlack
Bundle ID: com.readyaimgo.mkeblack
Deployment target: iOS 17.0
Destination for demo: iPhone 16 Pro Simulator + "My Mac (Designed for iPad)"

## Dependencies (Swift Package Manager)
Add to Package.swift / Xcode SPM:

1. Firebase iOS SDK
   https://github.com/firebase/firebase-ios-sdk
   Products: FirebaseAuth, FirebaseFirestore, FirebaseStorage

2. Mapbox Maps SDK for iOS
   https://github.com/mapbox/mapbox-maps-ios
   (Same Mapbox token as web: NEXT_PUBLIC_MAPBOX_TOKEN)

3. SDWebImageSwiftUI (async image loading)
   https://github.com/SDWebImage/SDWebImageSwiftUI

## Firebase config
Download GoogleService-Info.plist from Firebase Console
(Project: mkeblack-c6dfe → iOS app → Add app if not already added)
Bundle ID: com.readyaimgo.mkeblack
Drop into Xcode project root.

## Mapbox config
Add to Info.plist:
MBXAccessToken = pk.eyJ1IjoiZXpyYXJlYWR5YWltZ28i... (existing token)


================================================================================
SHARED FIREBASE LAYER (mirrors web schema exactly)
================================================================================

## Models/Business.swift
```swift
import Foundation
import FirebaseFirestore

struct DailyHours: Codable {
    var open: String
    var close: String
    var closed: Bool
}

struct BusinessHours: Codable {
    var monday: DailyHours
    var tuesday: DailyHours
    var wednesday: DailyHours
    var thursday: DailyHours
    var friday: DailyHours
    var saturday: DailyHours
    var sunday: DailyHours
}

struct BusinessLocation: Codable {
    var lat: Double
    var lng: Double
}

struct Business: Identifiable, Codable {
    @DocumentID var documentId: String?
    var id: String
    var name: String
    var category: String
    var description: String
    var address: String
    var phone: String
    var website: String
    var email: String
    var hours: BusinessHours
    var photos: [String]
    var tags: [String]
    var neighborhood: String
    var active: Bool
    var solidarityMember: Bool
    var hasTeamProfiles: Bool
    var location: BusinessLocation

    // Computed
    var isOpenNow: Bool {
        let now = Date()
        let cal = Calendar.current
        let weekday = cal.component(.weekday, from: now) // 1=Sun
        let dayKey: PartialKeyPath<BusinessHours>
        let todayHours: DailyHours
        switch weekday {
        case 1: todayHours = hours.sunday
        case 2: todayHours = hours.monday
        case 3: todayHours = hours.tuesday
        case 4: todayHours = hours.wednesday
        case 5: todayHours = hours.thursday
        case 6: todayHours = hours.friday
        case 7: todayHours = hours.saturday
        default: return false
        }
        if todayHours.closed { return false }
        let h = cal.component(.hour, from: now)
        let m = cal.component(.minute, from: now)
        let current = h * 60 + m
        let openParts = todayHours.open.split(separator: ":").compactMap { Int($0) }
        let closeParts = todayHours.close.split(separator: ":").compactMap { Int($0) }
        guard openParts.count == 2, closeParts.count == 2 else { return false }
        let open = openParts[0] * 60 + openParts[1]
        let close = closeParts[0] * 60 + closeParts[1]
        if close < open { return current >= open || current < close }
        return current >= open && current < close
    }
}
```

## Services/BusinessService.swift
```swift
import FirebaseFirestore
import CoreLocation

class BusinessService: ObservableObject {
    private let db = Firestore.firestore()

    @Published var businesses: [Business] = []
    @Published var loading = true
    @Published var error: String? = nil

    private var listener: ListenerRegistration?

    func startListening() {
        listener = db.collection("businesses")
            .whereField("active", isEqualTo: true)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    self.error = error.localizedDescription
                    self.loading = false
                    return
                }
                self.businesses = (snapshot?.documents ?? []).compactMap { doc in
                    try? doc.data(as: Business.self)
                }
                // Sort: solidarity members first, then alphabetical
                .sorted {
                    if $0.solidarityMember != $1.solidarityMember {
                        return $0.solidarityMember
                    }
                    return $0.name < $1.name
                }
                self.loading = false
            }
    }

    func stopListening() { listener?.remove() }

    func filtered(
        query: String,
        category: String?,
        nowOpen: Bool,
        userLocation: CLLocation?
    ) -> [Business] {
        var results = businesses

        if !query.isEmpty {
            results = results.filter {
                $0.name.localizedCaseInsensitiveContains(query) ||
                $0.category.localizedCaseInsensitiveContains(query) ||
                $0.description.localizedCaseInsensitiveContains(query)
            }
        }
        if let category, !category.isEmpty {
            results = results.filter { $0.category == category }
        }
        if nowOpen {
            results = results.filter { $0.isOpenNow }
        }
        if let userLocation {
            results = results.sorted {
                let locA = CLLocation(latitude: $0.location.lat, longitude: $0.location.lng)
                let locB = CLLocation(latitude: $1.location.lat, longitude: $1.location.lng)
                return userLocation.distance(from: locA) < userLocation.distance(from: locB)
            }
        }
        return results
    }
}
```


================================================================================
SCREEN 1 — Directory (Tab 1)
================================================================================

## Views/Directory/DirectoryView.swift
```swift
import SwiftUI
import CoreLocation

struct DirectoryView: View {
    @StateObject private var service = BusinessService()
    @StateObject private var locationManager = LocationManager()
    @State private var searchText = ""
    @State private var selectedCategory: String? = nil
    @State private var nowOpenOnly = false
    @State private var viewMode: ViewMode = .list  // .list or .map

    enum ViewMode { case list, map }

    var filtered: [Business] {
        service.filtered(
            query: searchText,
            category: selectedCategory,
            nowOpen: nowOpenOnly,
            userLocation: locationManager.location
        )
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                SearchBar(text: $searchText)

                // Filter chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip("Now Open", active: $nowOpenOnly, color: .green)
                        FilterChip("Near Me", active: .constant(locationManager.location != nil)) {
                            locationManager.requestLocation()
                        }
                        // Category chips
                        ForEach(CATEGORIES, id: \.self) { cat in
                            CategoryChip(cat, selected: selectedCategory == cat) {
                                selectedCategory = selectedCategory == cat ? nil : cat
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 8)

                // View toggle
                Picker("View", selection: $viewMode) {
                    Label("List", systemImage: "list.bullet").tag(ViewMode.list)
                    Label("Map", systemImage: "map").tag(ViewMode.map)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.bottom, 8)

                if service.loading {
                    ProgressView("Loading businesses...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewMode == .list {
                    // Results count
                    HStack {
                        Text("\(filtered.count) businesses")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if nowOpenOnly {
                            Text("· Open now")
                                .font(.caption)
                                .foregroundStyle(.green)
                        }
                        Spacer()
                    }
                    .padding(.horizontal)

                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(filtered) { business in
                                NavigationLink(destination: BusinessDetailView(business: business)) {
                                    BusinessCard(
                                        business: business,
                                        distance: locationManager.distance(to: business.location)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding()
                    }
                } else {
                    BusinessMapView(businesses: filtered, userLocation: locationManager.location)
                }
            }
            .navigationTitle("MKE Black")
            .navigationBarTitleDisplayMode(.large)
        }
        .onAppear { service.startListening() }
        .onDisappear { service.stopListening() }
    }
}
```

## Views/Directory/BusinessCard.swift
```swift
struct BusinessCard: View {
    let business: Business
    let distance: Double?  // in miles, nil if no location

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Photo
            if let photoUrl = business.photos.first {
                AsyncImage(url: URL(string: photoUrl)) { image in
                    image.resizable().aspectRatio(16/9, contentMode: .fill)
                } placeholder: {
                    Rectangle().fill(Color(.systemGray5))
                }
                .frame(height: 160)
                .clipped()
            } else {
                Rectangle()
                    .fill(Color(.systemGray5))
                    .frame(height: 120)
                    .overlay { Image(systemName: "building.2").foregroundStyle(.secondary) }
            }

            VStack(alignment: .leading, spacing: 6) {
                // Solidarity Circle badge
                if business.solidarityMember {
                    Label("Solidarity Circle", systemImage: "star.fill")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.black)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color(hex: "#D4A017"))
                        .clipShape(Capsule())
                }

                Text(business.name)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    Text(business.category)
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if let dist = distance {
                        Text("·")
                        Text(String(format: "%.1f mi", dist))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    // Open/closed indicator
                    HStack(spacing: 4) {
                        Circle()
                            .fill(business.isOpenNow ? .green : .red)
                            .frame(width: 6, height: 6)
                        Text(business.isOpenNow ? "Open" : "Closed")
                            .font(.caption2)
                            .foregroundStyle(business.isOpenNow ? .green : .red)
                    }
                }
            }
            .padding(12)
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 2)
    }
}
```


================================================================================
SCREEN 2 — Business Detail
================================================================================

## Views/Business/BusinessDetailView.swift
```swift
import SwiftUI
import MapKit

struct BusinessDetailView: View {
    let business: Business
    @State private var showingAllPhotos = false
    @State private var selectedTab = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Photo gallery
                TabView {
                    ForEach(business.photos, id: \.self) { url in
                        AsyncImage(url: URL(string: url)) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: { Color(.systemGray5) }
                    }
                }
                .tabViewStyle(.page)
                .frame(height: 260)

                VStack(alignment: .leading, spacing: 16) {

                    // Name + badges
                    VStack(alignment: .leading, spacing: 6) {
                        if business.solidarityMember {
                            Label("Solidarity Circle Member", systemImage: "star.fill")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.black)
                                .padding(.horizontal, 10).padding(.vertical, 4)
                                .background(Color(hex: "#D4A017"))
                                .clipShape(Capsule())
                        }

                        Text(business.name)
                            .font(.title.bold())

                        HStack {
                            Text(business.category)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            Spacer()

                            HStack(spacing: 4) {
                                Circle()
                                    .fill(business.isOpenNow ? .green : .red)
                                    .frame(width: 8, height: 8)
                                Text(business.isOpenNow ? "Open now" : "Closed")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(business.isOpenNow ? .green : .red)
                            }
                        }
                    }

                    // Action buttons
                    HStack(spacing: 12) {
                        if !business.phone.isEmpty {
                            ActionButton(icon: "phone.fill", label: "Call") {
                                if let url = URL(string: "tel:\(business.phone.filter(\.isNumber))") {
                                    UIApplication.shared.open(url)
                                }
                            }
                        }
                        if !business.website.isEmpty {
                            ActionButton(icon: "globe", label: "Website") {
                                if let url = URL(string: business.website) {
                                    UIApplication.shared.open(url)
                                }
                            }
                        }
                        ActionButton(icon: "map.fill", label: "Directions") {
                            let addr = business.address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
                            if let url = URL(string: "https://www.google.com/maps/dir/?api=1&destination=\(addr)") {
                                UIApplication.shared.open(url)
                            }
                        }
                    }

                    Divider()

                    // About
                    if !business.description.isEmpty {
                        Text("About")
                            .font(.headline)
                        Text(business.description)
                            .font(.body)
                            .foregroundStyle(.secondary)
                        Divider()
                    }

                    // Hours
                    Text("Hours")
                        .font(.headline)
                    HoursView(hours: business.hours)

                    // Tags
                    if !business.tags.isEmpty {
                        Divider()
                        Text("Features")
                            .font(.headline)
                        TagsView(tags: business.tags)
                    }
                }
                .padding()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(business.name)
                    .font(.headline)
                    .lineLimit(1)
            }
        }
    }
}
```


================================================================================
SCREEN 3 — Membership (Tab 3)
================================================================================

## Views/Membership/MembershipView.swift
```swift
struct MembershipView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {

                    // Hero
                    VStack(spacing: 12) {
                        Image(systemName: "star.circle.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(Color(hex: "#D4A017"))

                        Text("Solidarity Circle")
                            .font(.largeTitle.bold())

                        Text("Join Milwaukee's Black business membership and unlock exclusive benefits for you and the community.")
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)

                    // Benefits
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Member Benefits")
                            .font(.headline)

                        ForEach(MEMBERSHIP_BENEFITS, id: \.title) { benefit in
                            HStack(spacing: 12) {
                                Image(systemName: benefit.icon)
                                    .foregroundStyle(Color(hex: "#D4A017"))
                                    .frame(width: 24)
                                VStack(alignment: .leading) {
                                    Text(benefit.title).font(.subheadline.weight(.semibold))
                                    Text(benefit.description).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                    // CTA
                    Button {
                        if let url = URL(string: "https://mkeblack.org/membership") {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        Text("Become a Member")
                            .font(.headline)
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color(hex: "#D4A017"))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .padding(.horizontal)
                }
                .padding()
            }
            .navigationTitle("Membership")
        }
    }
}

let MEMBERSHIP_BENEFITS = [
    (icon: "percent", title: "Member Discounts", description: "Exclusive discounts at Black-owned businesses"),
    (icon: "star.fill", title: "Priority Listing", description: "Your business appears first in all searches"),
    (icon: "bag.fill", title: "Marketplace Access", description: "Post products and services to the MKE Black Marketplace"),
    (icon: "briefcase.fill", title: "Jobs Board", description: "Post jobs and find local talent"),
    (icon: "gift.fill", title: "Free MKE Black T-Shirt", description: "Welcome gift for all new members"),
]
```


================================================================================
MAIN APP STRUCTURE
================================================================================

## MKEBlackApp.swift
```swift
import SwiftUI
import FirebaseCore

@main
struct MKEBlackApp: App {
    init() { FirebaseApp.configure() }

    var body: some Scene {
        WindowGroup {
            MainTabView()
        }
    }
}
```

## Views/MainTabView.swift
```swift
struct MainTabView: View {
    var body: some View {
        TabView {
            DirectoryView()
                .tabItem {
                    Label("Directory", systemImage: "building.2.fill")
                }

            MarketplaceView()
                .tabItem {
                    Label("Marketplace", systemImage: "bag.fill")
                }

            MembershipView()
                .tabItem {
                    Label("Membership", systemImage: "star.fill")
                }

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
        }
        .accentColor(Color(hex: "#D4A017"))
    }
}
```


================================================================================
DESIGN SYSTEM
================================================================================

## Utilities/MKEBlackStyle.swift
```swift
import SwiftUI

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }

    static let mkeGold = Color(hex: "#D4A017")
    static let mkeDark = Color(hex: "#0a0a0a")
    static let mkeSurface = Color(hex: "#1a1a1a")
}

// Shared corner radius
let mkeRadius: CGFloat = 16
```


================================================================================
WHAT TO SHOW MONDAY — DEMO SCRIPT
================================================================================

The app shows 3 things that make the case:

1. "This is the same data as the website"
   → Open app, open website side by side
   → Same businesses, real Milwaukee data from the CSV import
   → This proves "ONE Database" — the core spec requirement

2. "Now Open works in real time"
   → Tap "Now Open" filter → list narrows to businesses open right now
   → This is the #1 feature from user research
   → Rick and Solana have been asking for this since day 1

3. "To put this on your phones to test"
   → "We need two things:
      a. Development fee for the build work (RAG fee — discuss)
      b. Apple Developer Account ($99/year, required for TestFlight)
         I need to reactivate mine to distribute to your devices"
   → This is the natural close: they want it, now they need to pay for it

4. If they want to see more:
   → Tap a business → full profile with photos, hours, contact buttons
   → Show gold "Solidarity Circle" badge on member businesses
   → Show map view with pins


================================================================================
PAYMENT STRUCTURE SUGGESTION FOR THE MEETING
================================================================================

The web build and app together represent significant work.
Here's how to frame it based on what MKE's own research showed:

MKE's student research estimated: $24,000–$27,500 to build this.
You're delivering more than that scope.

Suggested conversation:
"The website is almost ready to go live. The app preview is running.
To move forward on both:

1. Website launch fee: $[X] — gets the live site deployed,
   CSV imported, Rick + Solana as admins, business owners invited.

2. App development retainer: $[Y]/month — continued app development,
   features added as we go, same Firebase data.

3. Apple Developer Account: $99/year — you pay this directly to Apple.
   Required to distribute the app to your phones for testing.

OR: if you want to keep the app development costs lower,
we can redirect part of the budget toward Maia's pilot
(per our earlier conversation about the Hroshi benefit structure)
which builds the RAG track record and keeps everyone moving."


================================================================================
XCODE PROJECT CREATION STEPS
================================================================================

Run these steps now to start the Xcode project:

1. Open Xcode → File → New → Project
2. iOS → App
3. Product Name: MKEBlack
4. Team: Personal Team (for now, no Apple Developer account needed for simulator)
5. Bundle ID: com.readyaimgo.mkeblack
6. Interface: SwiftUI
7. Language: Swift
8. Save to: /Users/ehauga/Desktop/local dev/MKEBlackApp

8. File → Add Package Dependencies → add Firebase, Mapbox, SDWebImageSwiftUI

9. Download GoogleService-Info.plist from Firebase Console:
   → mkeblack-c6dfe project → Project Settings → Add iOS app
   → Bundle ID: com.readyaimgo.mkeblack → Download plist → drag into Xcode

10. Create file structure:
    MKEBlack/
      Models/
        Business.swift
      Services/
        BusinessService.swift
        LocationManager.swift
      Views/
        Directory/
          DirectoryView.swift
          BusinessCard.swift
          BusinessMapView.swift
        Business/
          BusinessDetailView.swift
          HoursView.swift
          TagsView.swift
        Membership/
          MembershipView.swift
        Shared/
          ActionButton.swift
          FilterChip.swift
      Utilities/
        MKEBlackStyle.swift

11. Copy Swift code from this file into each file above
12. Run on iPhone 16 Pro Simulator → should show live Firebase data

================================================================================
END OF MKE BLACK iOS APP PLAN
================================================================================
