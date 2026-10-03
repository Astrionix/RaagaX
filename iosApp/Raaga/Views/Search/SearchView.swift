import SwiftUI

/// Search screen with live suggestions, category pills, and mixed song/collection results.
struct SearchView: View {
    @ObservedObject var playerManager = AudioPlayerManager.shared
    @ObservedObject var libraryManager = LibraryManager.shared

    @State private var query = ""
    @State private var selectedFilter: YouTubeMusicService.SearchFilter = .all
    @State private var suggestions: [String] = []
    @State private var searchResults: [Song] = []
    @State private var collectionResults: [MediaCollection] = []
    @State private var isSearching = false
    @State private var hasSearched = false

    @State private var recentSearches: [String] = [
        "Anirudh Ravichander", "Sid Sriram", "Telugu Hits 2025", "A.R. Rahman", "Thaman S"
    ]

    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.Colors.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Search Bar
                    searchBarInput
                        .padding(.horizontal, AppTheme.Spacing.lg)
                        .padding(.top, AppTheme.Spacing.sm)

                    // Category Filter Pills
                    categoryPills
                        .padding(.horizontal, AppTheme.Spacing.lg)
                        .padding(.vertical, AppTheme.Spacing.sm)

                    // Body: Suggestions OR Results OR Recent
                    if isSearching {
                        ProgressView()
                            .tint(AppTheme.Colors.accent)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if !query.isEmpty && !hasSearched && !suggestions.isEmpty {
                        suggestionsList
                    } else if hasSearched {
                        resultsList
                    } else {
                        recentSearchesView
                    }
                }
                .padding(.bottom, 110) // Clearance for Mini Player
            }
            .navigationBarHidden(true)
        }
        .navigationViewStyle(.stack)
        .onChange(of: query) { newQuery in
            if newQuery.isEmpty {
                suggestions = []
                searchResults = []
                collectionResults = []
                hasSearched = false
            } else {
                hasSearched = false
                Task {
                    let items = await YouTubeMusicService.shared.searchSuggestions(query: newQuery)
                    if query == newQuery {
                        self.suggestions = items
                    }
                }
            }
        }
    }

    // MARK: - Search Input Bar

    private var searchBarInput: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(AppTheme.Colors.textSecondary)

            TextField("Songs, artists, albums, or videos", text: $query)
                .font(.system(size: 15))
                .foregroundColor(AppTheme.Colors.textPrimary)
                .submitLabel(.search)
                .onSubmit {
                    performSearch(term: query)
                }

            if !query.isEmpty {
                Button(action: {
                    query = ""
                    suggestions = []
                    searchResults = []
                    collectionResults = []
                    hasSearched = false
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(AppTheme.Colors.textTertiary)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(AppTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.CornerRadius.md, style: .continuous)
                .stroke(AppTheme.Colors.border, lineWidth: 1)
        )
    }

    // MARK: - Category Filter Pills

    private var categoryPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(YouTubeMusicService.SearchFilter.allCases) { filter in
                    let isSelected = selectedFilter == filter
                    Button(action: {
                        selectedFilter = filter
                        if !query.isEmpty {
                            performSearch(term: query)
                        }
                    }) {
                        Text(filter.rawValue)
                            .font(.system(size: 13, weight: isSelected ? .bold : .medium))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 6)
                            .background(isSelected ? AppTheme.Colors.accentGradient : LinearGradient(colors: [AppTheme.Colors.surface], startPoint: .top, endPoint: .bottom))
                            .foregroundColor(isSelected ? .white : AppTheme.Colors.textSecondary)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(isSelected ? Color.clear : AppTheme.Colors.border, lineWidth: 1)
                            )
                    }
                }
            }
        }
    }

    // MARK: - Live Suggestions List

    private var suggestionsList: some View {
        List {
            ForEach(suggestions, id: \.self) { suggestion in
                Button(action: {
                    query = suggestion
                    performSearch(term: suggestion)
                }) {
                    HStack(spacing: 14) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 14))
                            .foregroundColor(AppTheme.Colors.textTertiary)

                        Text(suggestion)
                            .font(.system(size: 15))
                            .foregroundColor(AppTheme.Colors.textPrimary)

                        Spacer()

                        Image(systemName: "arrow.up.left")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.Colors.textTertiary)
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(AppTheme.Colors.background)
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Search Results

    private var resultsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Collections (Albums / Artists / Playlists)
                if !collectionResults.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Albums & Artists")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundColor(AppTheme.Colors.textPrimary)
                            .padding(.horizontal, AppTheme.Spacing.lg)
                            .padding(.top, 10)

                        ScrollView(.horizontal, showsIndicators: false) {
                            LazyHStack(spacing: 12) {
                                ForEach(collectionResults) { collection in
                                    NavigationLink(destination: CollectionDetailView(collection: collection)) {
                                        VStack(alignment: .leading, spacing: 6) {
                                            AsyncImage(url: Artwork.url(collection.thumbnailURL, size: 200)) { phase in
                                                if let img = phase.image {
                                                    img.resizable().scaledToFill()
                                                } else {
                                                    Rectangle().fill(AppTheme.Colors.surfaceVariant)
                                                }
                                            }
                                            .frame(width: 120, height: 120)
                                            .clipShape(RoundedRectangle(cornerRadius: collection.kind == .artist ? 60 : AppTheme.CornerRadius.md))

                                            Text(collection.title)
                                                .font(.system(size: 13, weight: .semibold))
                                                .foregroundColor(AppTheme.Colors.textPrimary)
                                                .lineLimit(1)
                                                .frame(width: 120, alignment: .leading)

                                            Text(collection.kind.rawValue.capitalized)
                                                .font(.system(size: 11))
                                                .foregroundColor(AppTheme.Colors.textSecondary)
                                                .lineLimit(1)
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, AppTheme.Spacing.lg)
                        }
                    }
                }

                // Songs
                if !searchResults.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Songs")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundColor(AppTheme.Colors.textPrimary)
                            .padding(.horizontal, AppTheme.Spacing.lg)
                            .padding(.top, 16)
                            .padding(.bottom, 8)

                        ForEach(Array(searchResults.enumerated()), id: \.offset) { index, song in
                            let isCurrent = playerManager.currentSong?.id == song.id

                            HStack(spacing: 12) {
                                AsyncImage(url: song.artworkURL(size: 140)) { phase in
                                    if let img = phase.image {
                                        img.resizable().scaledToFill()
                                    } else {
                                        Rectangle().fill(AppTheme.Colors.surfaceVariant)
                                    }
                                }
                                .frame(width: 48, height: 48)
                                .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.sm))

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(song.title)
                                        .font(.system(size: 14, weight: isCurrent ? .bold : .medium))
                                        .foregroundColor(isCurrent ? AppTheme.Colors.accent : AppTheme.Colors.textPrimary)
                                        .lineLimit(1)

                                    Text(song.subtitleLine)
                                        .font(.system(size: 12))
                                        .foregroundColor(AppTheme.Colors.textSecondary)
                                        .lineLimit(1)
                                }

                                Spacer()

                                // Menu
                                Menu {
                                    Button {
                                        playerManager.playNext(song: song)
                                    } label: {
                                        Label("Play Next", systemImage: "text.insert")
                                    }

                                    Button {
                                        playerManager.addToQueue(song: song)
                                    } label: {
                                        Label("Add to Queue", systemImage: "text.append")
                                    }

                                    Button {
                                        libraryManager.toggleLike(song)
                                    } label: {
                                        Label(libraryManager.isLiked(song) ? "Unlike" : "Like", systemImage: libraryManager.isLiked(song) ? "heart.slash" : "heart")
                                    }
                                } label: {
                                    Image(systemName: "ellipsis")
                                        .font(.system(size: 16))
                                        .foregroundColor(AppTheme.Colors.textTertiary)
                                        .frame(width: 32, height: 32)
                                }
                            }
                            .padding(.horizontal, AppTheme.Spacing.lg)
                            .padding(.vertical, 8)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                playerManager.playQueue(songs: searchResults, startAt: index)
                            }

                            Divider()
                                .background(AppTheme.Colors.border)
                                .padding(.leading, 72)
                        }
                    }
                } else if collectionResults.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 36))
                            .foregroundColor(AppTheme.Colors.textTertiary)
                        Text("No results for \"\(query)\"")
                            .font(.system(size: 15))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 200)
                }
            }
        }
    }

    // MARK: - Recent Searches View

    private var recentSearchesView: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Recent Searches")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(AppTheme.Colors.textPrimary)

                Spacer()

                Button("Clear") {
                    recentSearches.removeAll()
                }
                .font(.system(size: 13))
                .foregroundColor(AppTheme.Colors.accent)
            }
            .padding(.horizontal, AppTheme.Spacing.lg)
            .padding(.top, 16)

            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(recentSearches, id: \.self) { term in
                        Button(action: {
                            query = term
                            performSearch(term: term)
                        }) {
                            HStack(spacing: 12) {
                                Image(systemName: "clock")
                                    .font(.system(size: 14))
                                    .foregroundColor(AppTheme.Colors.textTertiary)

                                Text(term)
                                    .font(.system(size: 15))
                                    .foregroundColor(AppTheme.Colors.textPrimary)

                                Spacer()

                                Image(systemName: "arrow.up.left")
                                    .font(.system(size: 12))
                                    .foregroundColor(AppTheme.Colors.textTertiary)
                            }
                            .padding(.horizontal, AppTheme.Spacing.lg)
                            .padding(.vertical, 10)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Search Action

    private func performSearch(term: String) {
        let clean = term.trimmingCharacters(in: .whitespaces)
        guard !clean.isEmpty else { return }

        // Save to recents
        if !recentSearches.contains(clean) {
            recentSearches.insert(clean, at: 0)
        }

        isSearching = true
        hasSearched = true

        Task {
            // Simultaneously query YouTube Music Innertube and JioSaavn
            async let ytResult = YouTubeMusicService.shared.search(query: clean, filter: selectedFilter)
            async let saavnResult = JioSaavnService.shared.searchSongs(query: clean)

            let ((ytSongs, ytCollections), saavnSongs) = await (ytResult, saavnResult)

            // Deduplicate songs by title/artist
            var combinedSongs = ytSongs
            for saavnSong in saavnSongs {
                if !combinedSongs.contains(where: {
                    $0.title.lowercased() == saavnSong.title.lowercased() &&
                    $0.artist.lowercased() == saavnSong.artist.lowercased()
                }) {
                    combinedSongs.append(saavnSong)
                }
            }

            self.searchResults = combinedSongs
            self.collectionResults = ytCollections
            self.isSearching = false
        }
    }
}
