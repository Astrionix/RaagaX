import SwiftUI

/// Premium Home screen with language filter chips, featured hero,
/// trending playlists, quick picks, and top albums.
struct HomeView: View {
    @ObservedObject var playerManager = AudioPlayerManager.shared
    @ObservedObject var libraryManager = LibraryManager.shared

    @State private var selectedLanguage: String = "Telugu"
    let languages = ["Telugu", "Hindi", "English", "Tamil", "Punjabi"]

    @State private var trendingSongs: [Song] = []
    @State private var homeShelves: [Shelf] = []
    @State private var isLoading = true

    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.Colors.background.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: AppTheme.Spacing.xl) {
                        // Top Header with Raaga Logo & Avatar
                        headerBar
                            .padding(.horizontal, AppTheme.Spacing.lg)
                            .padding(.top, AppTheme.Spacing.sm)

                        // Language Pills
                        languageSelector
                            .padding(.horizontal, AppTheme.Spacing.lg)

                        if isLoading && trendingSongs.isEmpty {
                            loadingPlaceholder
                                .frame(height: 350)
                        } else {
                            // Featured Hero Banner
                            if let firstSong = trendingSongs.first {
                                heroBanner(song: firstSong)
                                    .padding(.horizontal, AppTheme.Spacing.lg)
                            }

                            // Trending Songs Shelf
                            if !trendingSongs.isEmpty {
                                trendingSection
                            }

                            // Dynamic YouTube Music Shelves (Quick Picks, Albums, etc.)
                            ForEach(homeShelves) { shelf in
                                shelfSection(shelf: shelf)
                            }
                        }
                    }
                    .padding(.bottom, 110) // Clearance for MiniPlayer
                }
                .refreshable {
                    await loadHomeContent()
                }
            }
            .navigationBarHidden(true)
        }
        .navigationViewStyle(.stack)
        .task {
            if trendingSongs.isEmpty {
                await loadHomeContent()
            }
        }
    }

    // MARK: - Header Bar

    private var headerBar: some View {
        HStack {
            HStack(spacing: 8) {
                Image(systemName: "waveform.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(AppTheme.Colors.accentGradient)

                Text("Raaga")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundColor(AppTheme.Colors.textPrimary)

                Text("X")
                    .font(.system(size: 14, weight: .black, design: .rounded))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(AppTheme.Colors.accent)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
            }

            Spacer()

            NavigationLink(destination: HistoryView()) {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 20))
                    .foregroundColor(AppTheme.Colors.textSecondary)
                    .frame(width: 40, height: 40)
                    .background(AppTheme.Colors.surface)
                    .clipShape(Circle())
            }
        }
    }

    // MARK: - Language Selector

    private var languageSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(languages, id: \.self) { lang in
                    let isSelected = selectedLanguage == lang
                    Button(action: {
                        selectedLanguage = lang
                        Task { await loadTrendingForLanguage(lang) }
                    }) {
                        Text(lang)
                            .font(.system(size: 13, weight: isSelected ? .bold : .medium))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(isSelected ? AppTheme.Colors.accentGradient : LinearGradient(colors: [AppTheme.Colors.surface], startPoint: .top, endPoint: .bottom))
                            .foregroundColor(isSelected ? .white : AppTheme.Colors.textSecondary)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(isSelected ? Color.clear : AppTheme.Colors.border, lineWidth: 1)
                            )
                    }
                }
            }
        }
    }

    // MARK: - Hero Banner

    private func heroBanner(song: Song) -> some View {
        ZStack(alignment: .bottomLeading) {
            // Background Artwork Image with Blur
            AsyncImage(url: song.artworkURL(size: 600)) { phase in
                if let img = phase.image {
                    img.resizable().scaledToFill()
                } else {
                    Rectangle().fill(AppTheme.Colors.surfaceVariant)
                }
            }
            .frame(height: 220)
            .clipped()

            // Dark gradient overlay
            LinearGradient(
                colors: [Color.clear, Color.black.opacity(0.85)],
                startPoint: .center,
                endPoint: .bottom
            )

            // Content
            VStack(alignment: .leading, spacing: 6) {
                Text("TRENDING IN \(selectedLanguage.uppercased())")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.0)
                    .foregroundColor(AppTheme.Colors.accent)

                Text(song.title)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)

                Text(song.artist)
                    .font(.system(size: 14))
                    .foregroundColor(AppTheme.Colors.textSecondary)
                    .lineLimit(1)

                Button(action: {
                    playerManager.playQueue(songs: trendingSongs, startAt: 0)
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 13, weight: .bold))
                        Text("Play Now")
                            .font(.system(size: 13, weight: .bold))
                    }
                    .foregroundColor(.black)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.white)
                    .clipShape(Capsule())
                }
                .padding(.top, 4)
            }
            .padding(AppTheme.Spacing.lg)
        }
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.CornerRadius.xl, style: .continuous)
                .stroke(AppTheme.Colors.border, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.4), radius: 14, y: 6)
    }

    // MARK: - Trending Section

    private var trendingSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            HStack {
                Text("Trending Now")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                Spacer()
            }
            .padding(.horizontal, AppTheme.Spacing.lg)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 14) {
                    ForEach(Array(trendingSongs.prefix(15).enumerated()), id: \.offset) { index, song in
                        VStack(alignment: .leading, spacing: 8) {
                            // Cover Image
                            ZStack(alignment: .bottomTrailing) {
                                AsyncImage(url: song.artworkURL(size: 240)) { phase in
                                    if let img = phase.image {
                                        img.resizable().scaledToFill()
                                    } else {
                                        Rectangle().fill(AppTheme.Colors.surfaceVariant)
                                    }
                                }
                                .frame(width: 140, height: 140)
                                .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.md, style: .continuous))

                                // Play button overlay
                                Circle()
                                    .fill(AppTheme.Colors.accent)
                                    .frame(width: 32, height: 32)
                                    .overlay(
                                        Image(systemName: "play.fill")
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundColor(.white)
                                            .offset(x: 1)
                                    )
                                    .padding(8)
                            }

                            Text(song.title)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                                .lineLimit(1)
                                .frame(width: 140, alignment: .leading)

                            Text(song.artist)
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                                .lineLimit(1)
                                .frame(width: 140, alignment: .leading)
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            playerManager.playQueue(songs: trendingSongs, startAt: index)
                        }
                    }
                }
                .padding(.horizontal, AppTheme.Spacing.lg)
            }
        }
    }

    // MARK: - Dynamic Shelf Section

    @ViewBuilder
    private func shelfSection(shelf: Shelf) -> some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(shelf.title)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(AppTheme.Colors.textPrimary)

                if let sub = shelf.subtitle {
                    Text(sub)
                        .font(.system(size: 13))
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }
            }
            .padding(.horizontal, AppTheme.Spacing.lg)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 14) {
                    ForEach(shelf.items) { item in
                        switch item {
                        case .song(let s):
                            songCard(song: s)
                                .onTapGesture {
                                    playerManager.play(song: s)
                                }
                        case .collection(let c):
                            NavigationLink(destination: CollectionDetailView(collection: c)) {
                                collectionCard(collection: c)
                            }
                        }
                    }
                }
                .padding(.horizontal, AppTheme.Spacing.lg)
            }
        }
    }

    private func songCard(song: Song) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            AsyncImage(url: song.artworkURL(size: 200)) { phase in
                if let img = phase.image {
                    img.resizable().scaledToFill()
                } else {
                    Rectangle().fill(AppTheme.Colors.surfaceVariant)
                }
            }
            .frame(width: 130, height: 130)
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.md, style: .continuous))

            Text(song.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(AppTheme.Colors.textPrimary)
                .lineLimit(1)
                .frame(width: 130, alignment: .leading)

            Text(song.artist)
                .font(.system(size: 11))
                .foregroundColor(AppTheme.Colors.textSecondary)
                .lineLimit(1)
                .frame(width: 130, alignment: .leading)
        }
    }

    private func collectionCard(collection: MediaCollection) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            AsyncImage(url: Artwork.url(collection.thumbnailURL, size: 200)) { phase in
                if let img = phase.image {
                    img.resizable().scaledToFill()
                } else {
                    Rectangle().fill(AppTheme.Colors.surfaceVariant)
                }
            }
            .frame(width: 130, height: 130)
            .clipShape(RoundedRectangle(cornerRadius: collection.kind == .artist ? 65 : AppTheme.CornerRadius.md, style: .continuous))

            Text(collection.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(AppTheme.Colors.textPrimary)
                .lineLimit(1)
                .frame(width: 130, alignment: .leading)

            Text(collection.subtitle.isEmpty ? collection.kind.rawValue.capitalized : collection.subtitle)
                .font(.system(size: 11))
                .foregroundColor(AppTheme.Colors.textSecondary)
                .lineLimit(1)
                .frame(width: 130, alignment: .leading)
        }
    }

    // MARK: - Loading View

    private var loadingPlaceholder: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(AppTheme.Colors.accent)
                .scaleEffect(1.2)
            Text("Discovering music...")
                .font(.system(size: 14))
                .foregroundColor(AppTheme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Data Loading

    private func loadHomeContent() async {
        isLoading = true
        async let saavnTrending = JioSaavnService.shared.getTrendingSongs(language: selectedLanguage.lowercased())
        async let ytShelves = YouTubeMusicService.shared.browseHome()

        let (trending, shelves) = await (saavnTrending, ytShelves)
        self.trendingSongs = trending
        self.homeShelves = shelves
        self.isLoading = false
    }

    private func loadTrendingForLanguage(_ lang: String) async {
        let songs = await JioSaavnService.shared.getTrendingSongs(language: lang.lowercased())
        self.trendingSongs = songs
    }
}

// MARK: - History View

struct HistoryView: View {
    @ObservedObject var libraryManager = LibraryManager.shared
    @ObservedObject var playerManager = AudioPlayerManager.shared

    var body: some View {
        ZStack {
            AppTheme.Colors.background.ignoresSafeArea()

            if libraryManager.history.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 40))
                        .foregroundColor(AppTheme.Colors.textTertiary)
                    Text("No Play History Yet")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppTheme.Colors.textPrimary)
                }
            } else {
                List {
                    ForEach(Array(libraryManager.history.enumerated()), id: \.offset) { index, song in
                        HStack(spacing: 12) {
                            AsyncImage(url: song.artworkURL(size: 120)) { phase in
                                if let img = phase.image {
                                    img.resizable().scaledToFill()
                                } else {
                                    Rectangle().fill(AppTheme.Colors.surfaceVariant)
                                }
                            }
                            .frame(width: 44, height: 44)
                            .clipShape(RoundedRectangle(cornerRadius: 6))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(song.title)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(AppTheme.Colors.textPrimary)
                                    .lineLimit(1)
                                Text(song.artist)
                                    .font(.system(size: 12))
                                    .foregroundColor(AppTheme.Colors.textSecondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            playerManager.playQueue(songs: libraryManager.history, startAt: index)
                        }
                        .listRowBackground(AppTheme.Colors.background)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("History")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !libraryManager.history.isEmpty {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Clear") {
                        libraryManager.clearHistory()
                    }
                    .foregroundColor(AppTheme.Colors.accent)
                }
            }
        }
    }
}
