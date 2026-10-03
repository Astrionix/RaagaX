import SwiftUI
import AVFoundation

@main
struct RaagaApp: App {
    @StateObject private var playerManager = AudioPlayerManager.shared
    @StateObject private var libraryManager = LibraryManager.shared

    init() {
        // Configure system audio session for playback
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to set audio session category: \(error)")
        }

        // Configure UIKit appearance for dark mode
        UITableView.appearance().backgroundColor = .clear
        UITableViewCell.appearance().backgroundColor = .clear
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .environmentObject(playerManager)
                .environmentObject(libraryManager)
                .preferredColorScheme(.dark)
                .background(AppTheme.Colors.background.ignoresSafeArea())
        }
    }
}
