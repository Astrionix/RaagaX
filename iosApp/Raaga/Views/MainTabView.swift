import SwiftUI

enum TabSelection: Hashable {
    case home, search, library
}

/// Root Tab View containing Home, Search, Library, floating MiniPlayer,
/// and full-screen NowPlaying modal.
struct MainTabView: View {
    @State private var selectedTab: TabSelection = .home
    @State private var isNowPlayingExpanded: Bool = false
    @ObservedObject var playerManager = AudioPlayerManager.shared

    var body: some View {
        ZStack(alignment: .bottom) {
            // Tab Content
            TabView(selection: $selectedTab) {
                HomeView()
                    .tag(TabSelection.home)

                SearchView()
                    .tag(TabSelection.search)

                LibraryView()
                    .tag(TabSelection.library)
            }
            .accentColor(AppTheme.Colors.accent)

            // Pinned Floating MiniPlayer & Custom Bottom Bar
            VStack(spacing: 6) {
                // Mini Player (animates in when track is loaded)
                if playerManager.currentSong != nil {
                    MiniPlayerView(isExpanded: $isNowPlayingExpanded)
                }

                // Custom Tab Bar
                customTabBar
            }
            .padding(.bottom, 2)
        }
        .edgesIgnoringSafeArea(.bottom)
        .fullScreenCover(isPresented: $isNowPlayingExpanded) {
            NowPlayingView()
        }
    }

    // MARK: - Custom Glassmorphic Tab Bar

    private var customTabBar: some View {
        HStack(spacing: 0) {
            tabButton(tab: .home, title: "Home", icon: "house.fill")
            tabButton(tab: .search, title: "Search", icon: "magnifyingglass")
            tabButton(tab: .library, title: "Library", icon: "square.stack.fill")
        }
        .padding(.top, 10)
        .padding(.bottom, 26) // Home indicator padding
        .background(
            AppTheme.Colors.surface
                .opacity(0.95)
                .background(.ultraThinMaterial)
                .overlay(
                    Rectangle()
                        .fill(AppTheme.Colors.border)
                        .frame(height: 0.5),
                    alignment: .top
                )
        )
    }

    private func tabButton(tab: TabSelection, title: String, icon: String) -> some View {
        let isSelected = selectedTab == tab
        return Button(action: {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                selectedTab = tab
            }
        }) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: isSelected ? .bold : .medium))
                    .foregroundColor(isSelected ? AppTheme.Colors.accent : AppTheme.Colors.textTertiary)

                Text(title)
                    .font(.system(size: 11, weight: isSelected ? .bold : .regular))
                    .foregroundColor(isSelected ? AppTheme.Colors.accent : AppTheme.Colors.textTertiary)
            }
            .frame(maxWidth: .infinity)
        }
    }
}
