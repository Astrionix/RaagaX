import SwiftUI

/// Library screen displaying Liked Songs, Custom Playlists, and Play History.
struct LibraryView: View {
    @ObservedObject var libraryManager = LibraryManager.shared
    @ObservedObject var playerManager = AudioPlayerManager.shared

    @State private var showCreatePlaylistAlert = false
    @State private var newPlaylistName = ""

    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.Colors.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: AppTheme.Spacing.lg) {
                        // Header
                        HStack {
                            Text("Your Library")
                                .font(.system(size: 26, weight: .bold, design: .rounded))
                                .foregroundColor(AppTheme.Colors.textPrimary)

                            Spacer()

                            Button(action: { showCreatePlaylistAlert = true }) {
                                Image(systemName: "plus")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(AppTheme.Colors.textPrimary)
                                    .frame(width: 38, height: 38)
                                    .background(AppTheme.Colors.surface)
                                    .clipShape(Circle())
                            }
                        }
                        .padding(.horizontal, AppTheme.Spacing.lg)
                        .padding(.top, AppTheme.Spacing.sm)

                        // Quick Navigation Grid (Liked Songs & History)
                        HStack(spacing: 12) {
                            NavigationLink(destination: LikedSongsView()) {
                                quickTile(
                                    title: "Liked Songs",
                                    subtitle: "\(libraryManager.likedSongs.count) songs",
                                    icon: "heart.fill",
                                    gradient: AppTheme.Colors.accentGradient
                                )
                            }

                            NavigationLink(destination: HistoryView()) {
                                quickTile(
                                    title: "History",
                                    subtitle: "\(libraryManager.history.count) played",
                                    icon: "clock.arrow.circlepath",
                                    gradient: LinearGradient(
                                        colors: [Color(hex: "#3B82F6"), Color(hex: "#1D4ED8")],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                            }
                        }
                        .padding(.horizontal, AppTheme.Spacing.lg)

                        // Custom Playlists Section
                        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
                            Text("Playlists")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                                .padding(.horizontal, AppTheme.Spacing.lg)

                            if libraryManager.playlists.isEmpty {
                                emptyPlaylistsState
                                    .padding(.horizontal, AppTheme.Spacing.lg)
                            } else {
                                LazyVStack(spacing: 8) {
                                    ForEach(libraryManager.playlists) { playlist in
                                        NavigationLink(destination: UserPlaylistDetailView(playlistId: playlist.id)) {
                                            playlistRow(playlist: playlist)
                                        }
                                    }
                                }
                                .padding(.horizontal, AppTheme.Spacing.lg)
                            }
                        }
                    }
                    .padding(.bottom, 110) // Clearance for Mini Player
                }
            }
            .navigationBarHidden(true)
            .alert("Create Playlist", isPresented: $showCreatePlaylistAlert) {
                TextField("Playlist Name", text: $newPlaylistName)
                Button("Create") {
                    if !newPlaylistName.trimmingCharacters(in: .whitespaces).isEmpty {
                        _ = libraryManager.createPlaylist(name: newPlaylistName)
                        newPlaylistName = ""
                    }
                }
                Button("Cancel", role: .cancel) {
                    newPlaylistName = ""
                }
            }
        }
        .navigationViewStyle(.stack)
    }

    // MARK: - Quick Tile

    private func quickTile(title: String, subtitle: String, icon: String, gradient: LinearGradient) -> some View {
        HStack(spacing: 12) {
            ZStack {
                gradient
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)
            }
            .frame(width: 52, height: 52)
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.md))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.Colors.textSecondary)
            }

            Spacer()
        }
        .padding(10)
        .background(AppTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.CornerRadius.lg)
                .stroke(AppTheme.Colors.border, lineWidth: 1)
        )
    }

    // MARK: - Playlist Row

    private func playlistRow(playlist: UserPlaylist) -> some View {
        HStack(spacing: 14) {
            // Mosaic or single artwork
            ZStack {
                if let firstSong = playlist.songs.first, let url = firstSong.artworkURL(size: 120) {
                    AsyncImage(url: url) { phase in
                        if let img = phase.image {
                            img.resizable().scaledToFill()
                        } else {
                            Rectangle().fill(AppTheme.Colors.surfaceVariant)
                        }
                    }
                } else {
                    AppTheme.Colors.surfaceVariant
                    Image(systemName: "music.note.list")
                        .font(.system(size: 20))
                        .foregroundColor(AppTheme.Colors.textTertiary)
                }
            }
            .frame(width: 54, height: 54)
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.sm))

            VStack(alignment: .leading, spacing: 3) {
                Text(playlist.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                    .lineLimit(1)

                Text("\(playlist.songs.count) songs")
                    .font(.system(size: 13))
                    .foregroundColor(AppTheme.Colors.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(AppTheme.Colors.textTertiary)
        }
        .padding(12)
        .background(AppTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.md))
    }

    private var emptyPlaylistsState: some View {
        VStack(spacing: 12) {
            Image(systemName: "music.note.list")
                .font(.system(size: 38))
                .foregroundColor(AppTheme.Colors.textTertiary)
            Text("Create your first playlist")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(AppTheme.Colors.textPrimary)
            Button(action: { showCreatePlaylistAlert = true }) {
                Text("Create Playlist")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(AppTheme.Colors.accent)
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .background(AppTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.lg))
    }
}

// MARK: - Liked Songs Screen

struct LikedSongsView: View {
    @ObservedObject var libraryManager = LibraryManager.shared
    @ObservedObject var playerManager = AudioPlayerManager.shared

    var body: some View {
        ZStack {
            AppTheme.Colors.background.ignoresSafeArea()

            if libraryManager.likedSongs.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "heart.slash")
                        .font(.system(size: 40))
                        .foregroundColor(AppTheme.Colors.textTertiary)
                    Text("No Liked Songs Yet")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    Text("Tap the heart icon on any song to add it here.")
                        .font(.system(size: 13))
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }
            } else {
                List {
                    // Header action buttons
                    Section {
                        HStack(spacing: 16) {
                            Button(action: {
                                playerManager.isShuffled = false
                                playerManager.playQueue(songs: libraryManager.likedSongs, startAt: 0)
                            }) {
                                HStack {
                                    Image(systemName: "play.fill")
                                    Text("Play")
                                }
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity, height: 42)
                                .background(AppTheme.Colors.accentGradient)
                                .clipShape(Capsule())
                            }

                            Button(action: {
                                playerManager.isShuffled = true
                                playerManager.playQueue(songs: libraryManager.likedSongs, startAt: 0)
                            }) {
                                HStack {
                                    Image(systemName: "shuffle")
                                    Text("Shuffle")
                                }
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                                .frame(maxWidth: .infinity, height: 42)
                                .background(AppTheme.Colors.surface)
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(AppTheme.Colors.border, lineWidth: 1))
                            }
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 12, trailing: 0))
                    }

                    ForEach(Array(libraryManager.likedSongs.enumerated()), id: \.offset) { index, song in
                        let isCurrent = playerManager.currentSong?.id == song.id

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
                                    .font(.system(size: 14, weight: isCurrent ? .bold : .medium))
                                    .foregroundColor(isCurrent ? AppTheme.Colors.accent : AppTheme.Colors.textPrimary)
                                    .lineLimit(1)
                                Text(song.artist)
                                    .font(.system(size: 12))
                                    .foregroundColor(AppTheme.Colors.textSecondary)
                                    .lineLimit(1)
                            }

                            Spacer()

                            Button(action: {
                                libraryManager.toggleLike(song)
                            }) {
                                Image(systemName: "heart.fill")
                                    .foregroundColor(AppTheme.Colors.accent)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            playerManager.playQueue(songs: libraryManager.likedSongs, startAt: index)
                        }
                        .listRowBackground(AppTheme.Colors.background)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Liked Songs")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - User Playlist Detail View

struct UserPlaylistDetailView: View {
    let playlistId: UUID
    @ObservedObject var libraryManager = LibraryManager.shared
    @ObservedObject var playerManager = AudioPlayerManager.shared
    @Environment(\.dismiss) private var dismiss

    var playlist: UserPlaylist? {
        libraryManager.playlists.first(where: { $0.id == playlistId })
    }

    var body: some View {
        ZStack {
            AppTheme.Colors.background.ignoresSafeArea()

            if let p = playlist {
                VStack(spacing: 0) {
                    if p.songs.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "music.note")
                                .font(.system(size: 40))
                                .foregroundColor(AppTheme.Colors.textTertiary)
                            Text("Playlist is empty")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                            Text("Search songs and add them to this playlist.")
                                .font(.system(size: 13))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        List {
                            // Play All & Shuffle Buttons
                            Section {
                                HStack(spacing: 16) {
                                    Button(action: {
                                        playerManager.isShuffled = false
                                        playerManager.playQueue(songs: p.songs, startAt: 0)
                                    }) {
                                        HStack {
                                            Image(systemName: "play.fill")
                                            Text("Play")
                                        }
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.white)
                                        .frame(maxWidth: .infinity, height: 42)
                                        .background(AppTheme.Colors.accentGradient)
                                        .clipShape(Capsule())
                                    }

                                    Button(action: {
                                        playerManager.isShuffled = true
                                        playerManager.playQueue(songs: p.songs, startAt: 0)
                                    }) {
                                        HStack {
                                            Image(systemName: "shuffle")
                                            Text("Shuffle")
                                        }
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(AppTheme.Colors.textPrimary)
                                        .frame(maxWidth: .infinity, height: 42)
                                        .background(AppTheme.Colors.surface)
                                        .clipShape(Capsule())
                                        .overlay(Capsule().stroke(AppTheme.Colors.border, lineWidth: 1))
                                    }
                                }
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 12, trailing: 0))
                            }

                            ForEach(Array(p.songs.enumerated()), id: \.offset) { index, song in
                                let isCurrent = playerManager.currentSong?.id == song.id

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
                                            .font(.system(size: 14, weight: isCurrent ? .bold : .medium))
                                            .foregroundColor(isCurrent ? AppTheme.Colors.accent : AppTheme.Colors.textPrimary)
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
                                    playerManager.playQueue(songs: p.songs, startAt: index)
                                }
                                // Swipe action to delete song from playlist (per user request!)
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        libraryManager.removeSongAtIndex(index: index, playlistId: playlistId)
                                    } label: {
                                        Label("Remove", systemImage: "trash")
                                    }
                                }
                                .listRowBackground(AppTheme.Colors.background)
                            }
                        }
                        .listStyle(.plain)
                    }
                }
                .navigationTitle(p.name)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Menu {
                            Button(role: .destructive) {
                                libraryManager.deletePlaylist(id: playlistId)
                                dismiss()
                            } label: {
                                Label("Delete Playlist", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .foregroundColor(AppTheme.Colors.textPrimary)
                        }
                    }
                }
            }
        }
    }
}
