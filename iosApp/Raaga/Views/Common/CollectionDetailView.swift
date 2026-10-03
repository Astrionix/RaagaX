import SwiftUI

/// Rich detail view for Albums, Playlists, and Artists.
struct CollectionDetailView: View {
    let collection: MediaCollection

    @State private var songs: [Song] = []
    @State private var isLoading = true
    @State private var fullCollection: MediaCollection? = nil

    @ObservedObject var playerManager = AudioPlayerManager.shared
    @ObservedObject var libraryManager = LibraryManager.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            AppTheme.Colors.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: AppTheme.Spacing.lg) {
                    // Header Artwork & Metadata
                    headerSection

                    // Action Buttons (Play All & Shuffle)
                    actionButtons

                    // Tracklist
                    if isLoading {
                        ProgressView()
                            .tint(AppTheme.Colors.accent)
                            .frame(maxWidth: .infinity, minHeight: 120)
                    } else if songs.isEmpty {
                        Text("No songs found")
                            .font(.system(size: 15))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                            .frame(maxWidth: .infinity, minHeight: 120)
                    } else {
                        tracklistSection
                    }
                }
                .padding(.bottom, 120) // Clearance for Mini Player
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(collection.title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                    .lineLimit(1)
            }
        }
        .task {
            await loadCollection()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(spacing: AppTheme.Spacing.md) {
            // Artwork with glow
            ZStack {
                if let thumb = collection.thumbnailURL, let url = Artwork.url(thumb, size: 500) {
                    AsyncImage(url: url) { phase in
                        if let img = phase.image {
                            img.resizable()
                                .scaledToFill()
                                .blur(radius: 30)
                                .opacity(0.3)
                        }
                    }
                    .frame(width: 200, height: 200)

                    AsyncImage(url: url) { phase in
                        if let img = phase.image {
                            img.resizable()
                                .scaledToFill()
                        } else {
                            Rectangle().fill(AppTheme.Colors.surfaceVariant)
                        }
                    }
                    .frame(width: 190, height: 190)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.lg, style: .continuous))
                    .shadow(color: .black.opacity(0.5), radius: 16, y: 8)
                }
            }
            .padding(.top, AppTheme.Spacing.md)

            // Title & Subtitle
            VStack(spacing: 6) {
                Text(collection.title)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, AppTheme.Spacing.lg)

                if !collection.subtitle.isEmpty {
                    Text(collection.subtitle)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }

                Text("\(collection.kind.rawValue.capitalized) • \(songs.count) tracks")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.Colors.textTertiary)
            }
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: 16) {
            // Play All
            Button(action: {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                playerManager.isShuffled = false
                playerManager.playQueue(songs: songs, startAt: 0)
            }) {
                HStack(spacing: 8) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 15, weight: .bold))
                    Text("Play")
                        .font(.system(size: 15, weight: .bold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(AppTheme.Colors.accentGradient)
                .clipShape(Capsule())
                .shadow(color: AppTheme.Colors.accent.opacity(0.3), radius: 8, y: 4)
            }

            // Shuffle
            Button(action: {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                playerManager.isShuffled = true
                playerManager.playQueue(songs: songs, startAt: 0)
            }) {
                HStack(spacing: 8) {
                    Image(systemName: "shuffle")
                        .font(.system(size: 15, weight: .bold))
                    Text("Shuffle")
                        .font(.system(size: 15, weight: .bold))
                }
                .foregroundColor(AppTheme.Colors.textPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(AppTheme.Colors.surface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(AppTheme.Colors.border, lineWidth: 1))
            }
        }
        .padding(.horizontal, AppTheme.Spacing.lg)
    }

    // MARK: - Tracklist

    private var tracklistSection: some View {
        LazyVStack(spacing: 0) {
            ForEach(Array(songs.enumerated()), id: \.offset) { index, song in
                let isCurrent = playerManager.currentSong?.id == song.id

                HStack(spacing: 14) {
                    // Track index / Equalizer indicator
                    ZStack {
                        if isCurrent {
                            Image(systemName: playerManager.playbackState == .playing ? "speaker.wave.3.fill" : "speaker.fill")
                                .font(.system(size: 13))
                                .foregroundColor(AppTheme.Colors.accent)
                        } else {
                            Text("\(index + 1)")
                                .font(.system(size: 14, weight: .medium, design: .monospaced))
                                .foregroundColor(AppTheme.Colors.textTertiary)
                        }
                    }
                    .frame(width: 24)

                    // Song info
                    VStack(alignment: .leading, spacing: 3) {
                        Text(song.title)
                            .font(.system(size: 15, weight: isCurrent ? .bold : .medium))
                            .foregroundColor(isCurrent ? AppTheme.Colors.accent : AppTheme.Colors.textPrimary)
                            .lineLimit(1)

                        Text(song.artist)
                            .font(.system(size: 13))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    if let dur = song.durationText {
                        Text(dur)
                            .font(.system(size: 13, design: .monospaced))
                            .foregroundColor(AppTheme.Colors.textTertiary)
                    }

                    // Context Menu
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
                .padding(.vertical, 10)
                .contentShape(Rectangle())
                .onTapGesture {
                    playerManager.playQueue(songs: songs, startAt: index)
                }

                Divider()
                    .background(AppTheme.Colors.border)
                    .padding(.leading, 56)
            }
        }
    }

    private func loadCollection() async {
        isLoading = true
        if collection.browseId.hasPrefix("saavn_album:") {
            let albumId = String(collection.browseId.dropFirst("saavn_album:".count))
            let result = await JioSaavnService.shared.getAlbum(albumId: albumId)
            self.fullCollection = result.collection
            self.songs = result.songs
        } else {
            let result = await YouTubeMusicService.shared.browse(browseId: collection.browseId)
            self.fullCollection = result.collection
            self.songs = result.songs
        }
        isLoading = false
    }
}
