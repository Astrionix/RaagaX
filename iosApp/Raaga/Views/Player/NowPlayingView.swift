import SwiftUI

/// Full-screen Now Playing modal with Artwork & YouTube Video Player toggle,
/// scrubbable progress bar, transport controls, and queue sheet.
struct NowPlayingView: View {
    @ObservedObject var playerManager = AudioPlayerManager.shared
    @ObservedObject var libraryManager = LibraryManager.shared
    @Environment(\.dismiss) private var dismiss

    @State private var isScrubbing = false
    @State private var scrubTime: Double = 0
    @State private var showQueueSheet = false
    @State private var showPlaylistPicker = false

    var body: some View {
        ZStack {
            // Ambient dynamic background
            backgroundGlow

            VStack(spacing: 0) {
                // Header navigation
                headerBar
                    .padding(.horizontal, AppTheme.Spacing.lg)
                    .padding(.top, AppTheme.Spacing.md)

                Spacer(minLength: 12)

                // Visual Centerpiece (Artwork or Official YouTube Player)
                visualCenterpiece
                    .padding(.horizontal, AppTheme.Spacing.xl)

                // Artwork / Video toggle switch
                mediaModePicker
                    .padding(.top, AppTheme.Spacing.md)

                Spacer(minLength: 16)

                // Song Title & Artist Info
                trackInfoSection
                    .padding(.horizontal, AppTheme.Spacing.xl)

                // Progress Bar & Timestamps
                timelineSection
                    .padding(.horizontal, AppTheme.Spacing.xl)
                    .padding(.top, AppTheme.Spacing.md)

                // Main Transport Controls (Shuffle, Prev, Play/Pause, Next, Repeat)
                transportControls
                    .padding(.horizontal, AppTheme.Spacing.xl)
                    .padding(.top, AppTheme.Spacing.lg)

                // Bottom toolbar (Queue, AirPlay, Add to Playlist)
                bottomToolbar
                    .padding(.horizontal, AppTheme.Spacing.xl)
                    .padding(.vertical, AppTheme.Spacing.lg)
            }
        }
        .sheet(isPresented: $showQueueSheet) {
            QueueSheetView(playerManager: playerManager)
        }
        .sheet(isPresented: $showPlaylistPicker) {
            if let song = playerManager.currentSong {
                AddToPlaylistSheet(song: song, libraryManager: libraryManager)
            }
        }
    }

    // MARK: - Ambient Background

    private var backgroundGlow: some View {
        ZStack {
            AppTheme.Colors.background
                .ignoresSafeArea()

            if let artworkURL = playerManager.currentSong?.artworkURL(size: 512) {
                AsyncImage(url: artworkURL) { phase in
                    if let image = phase.image {
                        image
                            .resizable()
                            .scaledToFill()
                            .blur(radius: 65)
                            .opacity(0.35)
                            .ignoresSafeArea()
                    }
                }
            }

            // Dark gradient overlay
            LinearGradient(
                colors: [
                    AppTheme.Colors.background.opacity(0.6),
                    AppTheme.Colors.background.opacity(0.95)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        }
    }

    // MARK: - Header Bar

    private var headerBar: some View {
        HStack {
            Button(action: { dismiss() }) {
                Image(systemName: "chevron.down")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                    .frame(width: 40, height: 40)
                    .background(AppTheme.Colors.surface.opacity(0.8))
                    .clipShape(Circle())
            }

            Spacer()

            VStack(spacing: 2) {
                Text("PLAYING FROM QUEUE")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1.2)
                    .foregroundColor(AppTheme.Colors.textSecondary)
                Text(playerManager.currentSong?.album ?? "Raaga Music")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                    .lineLimit(1)
            }

            Spacer()

            Button(action: {
                if let shareURL = playerManager.currentSong?.shareURL {
                    let activityVC = UIActivityViewController(activityItems: [shareURL], applicationActivities: nil)
                    if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                       let rootVC = windowScene.windows.first?.rootViewController {
                        rootVC.present(activityVC, animated: true)
                    }
                }
            }) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                    .frame(width: 40, height: 40)
                    .background(AppTheme.Colors.surface.opacity(0.8))
                    .clipShape(Circle())
            }
        }
    }

    // MARK: - Center Visual: Artwork or YouTube IFrame

    private var visualCenterpiece: some View {
        ZStack {
            if playerManager.showVideoPlayer {
                // Official YouTube IFrame Player (per AGENTS.md rules)
                YouTubePlayerView(playerManager: playerManager)
                    .aspectRatio(16/9, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.lg, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: AppTheme.CornerRadius.lg, style: .continuous)
                            .stroke(AppTheme.Colors.border, lineWidth: 1)
                    )
                    .shadow(color: AppTheme.Colors.accent.opacity(0.2), radius: 20, y: 10)
            } else {
                // High-resolution Artwork View
                GeometryReader { geo in
                    let size = min(geo.size.width, geo.size.height)
                    ZStack {
                        if let artworkURL = playerManager.currentSong?.artworkURL(size: 600) {
                            AsyncImage(url: artworkURL) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: size, height: size)
                                        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.xl, style: .continuous))
                                        .shadow(color: .black.opacity(0.6), radius: 24, y: 12)
                                case .empty:
                                    Rectangle()
                                        .fill(AppTheme.Colors.surfaceVariant)
                                        .frame(width: size, height: size)
                                        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.xl, style: .continuous))
                                        .overlay(ProgressView().tint(.white))
                                default:
                                    fallbackCover(size: size)
                                }
                            }
                        } else {
                            fallbackCover(size: size)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                }
                .aspectRatio(1.0, contentMode: .fit)
            }
        }
    }

    private func fallbackCover(size: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: AppTheme.CornerRadius.xl, style: .continuous)
            .fill(AppTheme.Colors.surfaceVariant)
            .frame(width: size, height: size)
            .overlay(
                Image(systemName: "music.note")
                    .font(.system(size: size * 0.3))
                    .foregroundColor(AppTheme.Colors.textTertiary)
            )
    }

    // MARK: - Media Mode Switcher (Audio / Video)

    private var mediaModePicker: some View {
        HStack(spacing: 4) {
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                    playerManager.showVideoPlayer = false
                }
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "music.note")
                        .font(.system(size: 11, weight: .bold))
                    Text("Song")
                        .font(.system(size: 12, weight: .bold))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(!playerManager.showVideoPlayer ? AppTheme.Colors.surfaceVariant : Color.clear)
                .foregroundColor(!playerManager.showVideoPlayer ? AppTheme.Colors.textPrimary : AppTheme.Colors.textSecondary)
                .clipShape(Capsule())
            }

            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                    playerManager.showVideoPlayer = true
                }
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "play.rectangle.fill")
                        .font(.system(size: 11, weight: .bold))
                    Text("Video")
                        .font(.system(size: 12, weight: .bold))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(playerManager.showVideoPlayer ? AppTheme.Colors.surfaceVariant : Color.clear)
                .foregroundColor(playerManager.showVideoPlayer ? AppTheme.Colors.textPrimary : AppTheme.Colors.textSecondary)
                .clipShape(Capsule())
            }
        }
        .padding(3)
        .background(AppTheme.Colors.surface)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(AppTheme.Colors.border, lineWidth: 1))
    }

    // MARK: - Track Info Section

    private var trackInfoSection: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text(playerManager.currentSong?.title ?? "No Track Playing")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                    .lineLimit(1)

                Text(playerManager.currentSong?.artist ?? "Raaga Music")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(AppTheme.Colors.textSecondary)
                    .lineLimit(1)
            }

            Spacer()

            if let song = playerManager.currentSong {
                Button(action: {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    libraryManager.toggleLike(song)
                }) {
                    Image(systemName: libraryManager.isLiked(song) ? "heart.fill" : "heart")
                        .font(.system(size: 22))
                        .foregroundColor(libraryManager.isLiked(song) ? AppTheme.Colors.accent : AppTheme.Colors.textSecondary)
                }
            }
        }
    }

    // MARK: - Timeline Section

    private var timelineSection: some View {
        VStack(spacing: 6) {
            GeometryReader { geo in
                let maxDuration = max(1.0, playerManager.duration)
                let activeTime = isScrubbing ? scrubTime : playerManager.currentTime
                let progress = min(1.0, max(0.0, activeTime / maxDuration))

                ZStack(alignment: .leading) {
                    // Track background
                    Capsule()
                        .fill(AppTheme.Colors.surfaceVariant)
                        .frame(height: 5)

                    // Active progress
                    Capsule()
                        .fill(AppTheme.Colors.accentGradient)
                        .frame(width: geo.size.width * CGFloat(progress), height: 5)

                    // Thumb
                    Circle()
                        .fill(Color.white)
                        .frame(width: isScrubbing ? 16 : 12, height: isScrubbing ? 16 : 12)
                        .shadow(radius: 4)
                        .offset(x: max(0, min(geo.size.width * CGFloat(progress) - 6, geo.size.width - 12)))
                }
                .frame(maxHeight: .infinity, alignment: .center)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            isScrubbing = true
                            let ratio = max(0.0, min(1.0, value.location.x / geo.size.width))
                            scrubTime = ratio * maxDuration
                        }
                        .onEnded { value in
                            let ratio = max(0.0, min(1.0, value.location.x / geo.size.width))
                            let target = ratio * maxDuration
                            playerManager.seek(to: target)
                            isScrubbing = false
                        }
                )
            }
            .frame(height: 20)

            HStack {
                let displayTime = isScrubbing ? scrubTime : playerManager.currentTime
                Text(TimeFormat.string(displayTime))
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(AppTheme.Colors.textTertiary)

                Spacer()

                Text(TimeFormat.string(playerManager.duration))
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(AppTheme.Colors.textTertiary)
            }
        }
    }

    // MARK: - Main Transport Controls

    private var transportControls: some View {
        HStack(spacing: 0) {
            // Shuffle
            Button(action: {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                playerManager.toggleShuffle()
            }) {
                Image(systemName: "shuffle")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(playerManager.isShuffled ? AppTheme.Colors.accent : AppTheme.Colors.textTertiary)
                    .frame(maxWidth: .infinity)
            }

            // Previous
            Button(action: {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                playerManager.previous()
            }) {
                Image(systemName: "backward.fill")
                    .font(.system(size: 26))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                    .frame(maxWidth: .infinity)
            }

            // Play / Pause / Loading
            Button(action: {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                playerManager.togglePlayPause()
            }) {
                ZStack {
                    Circle()
                        .fill(AppTheme.Colors.accentGradient)
                        .frame(width: 68, height: 68)
                        .shadow(color: AppTheme.Colors.accent.opacity(0.4), radius: 14, y: 6)

                    if playerManager.playbackState == .loading || playerManager.playbackState == .buffering {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(1.2)
                    } else {
                        Image(systemName: playerManager.playbackState == .playing ? "pause.fill" : "play.fill")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(.white)
                            .offset(x: playerManager.playbackState == .playing ? 0 : 2)
                    }
                }
                .frame(maxWidth: .infinity)
            }

            // Next
            Button(action: {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                playerManager.next()
            }) {
                Image(systemName: "forward.fill")
                    .font(.system(size: 26))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                    .frame(maxWidth: .infinity)
            }

            // Repeat
            Button(action: {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                playerManager.cycleRepeatMode()
            }) {
                Image(systemName: playerManager.repeatMode == .one ? "repeat.1" : "repeat")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(playerManager.repeatMode != .off ? AppTheme.Colors.accent : AppTheme.Colors.textTertiary)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Bottom Toolbar

    private var bottomToolbar: some View {
        HStack {
            Button(action: { showPlaylistPicker = true }) {
                Image(systemName: "plus.circle")
                    .font(.system(size: 20))
                    .foregroundColor(AppTheme.Colors.textSecondary)
            }

            Spacer()

            Button(action: { showQueueSheet = true }) {
                HStack(spacing: 6) {
                    Image(systemName: "list.bullet")
                        .font(.system(size: 16, weight: .bold))
                    Text("Queue (\(playerManager.queue.count))")
                        .font(.system(size: 13, weight: .semibold))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(AppTheme.Colors.surface)
                .foregroundColor(AppTheme.Colors.textPrimary)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(AppTheme.Colors.border, lineWidth: 1))
            }
        }
    }
}

// MARK: - Queue Sheet

struct QueueSheetView: View {
    @ObservedObject var playerManager: AudioPlayerManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.Colors.background.ignoresSafeArea()

                List {
                    Section {
                        if let current = playerManager.currentSong {
                            HStack(spacing: 12) {
                                songArtwork(current, size: 48)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(current.title)
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundColor(AppTheme.Colors.accent)
                                        .lineLimit(1)
                                    Text(current.artist)
                                        .font(.system(size: 13))
                                        .foregroundColor(AppTheme.Colors.textSecondary)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Image(systemName: "speaker.wave.2.fill")
                                    .foregroundColor(AppTheme.Colors.accent)
                            }
                            .listRowBackground(AppTheme.Colors.surface)
                        }
                    } header: {
                        Text("Now Playing")
                            .foregroundColor(AppTheme.Colors.textSecondary)
                    }

                    Section {
                        ForEach(Array(playerManager.queue.enumerated()), id: \.offset) { index, song in
                            if index != playerManager.queueIndex {
                                HStack(spacing: 12) {
                                    songArtwork(song, size: 42)
                                    VStack(alignment: .leading, spacing: 3) {
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
                                    if let duration = song.durationText {
                                        Text(duration)
                                            .font(.system(size: 12))
                                            .foregroundColor(AppTheme.Colors.textTertiary)
                                    }
                                }
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    playerManager.playQueue(songs: playerManager.queue, startAt: index)
                                }
                                .listRowBackground(AppTheme.Colors.background)
                            }
                        }
                        .onDelete { indexSet in
                            for idx in indexSet {
                                playerManager.removeQueueItem(at: idx)
                            }
                        }
                        .onMove { indices, newOffset in
                            playerManager.moveQueueItem(from: indices, to: newOffset)
                        }
                    } header: {
                        HStack {
                            Text("Up Next")
                            Spacer()
                            EditButton()
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(AppTheme.Colors.accent)
                        }
                        .foregroundColor(AppTheme.Colors.textSecondary)
                    }
                }
                .listStyle(.insetGrouped)
            }
            .navigationTitle("Play Queue")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(AppTheme.Colors.accent)
                }
            }
        }
    }

    private func songArtwork(_ song: Song, size: CGFloat) -> some View {
        AsyncImage(url: song.artworkURL(size: 128)) { phase in
            if let img = phase.image {
                img.resizable().scaledToFill()
            } else {
                Rectangle().fill(AppTheme.Colors.surfaceVariant)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

// MARK: - Add To Playlist Sheet

struct AddToPlaylistSheet: View {
    let song: Song
    @ObservedObject var libraryManager: LibraryManager
    @Environment(\.dismiss) private var dismiss
    @State private var newPlaylistName = ""
    @State private var showCreatePrompt = false

    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.Colors.background.ignoresSafeArea()

                List {
                    Section {
                        Button(action: { showCreatePrompt = true }) {
                            HStack {
                                Image(systemName: "plus.circle.fill")
                                    .foregroundColor(AppTheme.Colors.accent)
                                Text("New Playlist")
                                    .foregroundColor(AppTheme.Colors.textPrimary)
                                    .font(.system(size: 15, weight: .semibold))
                            }
                        }
                        .listRowBackground(AppTheme.Colors.surface)
                    }

                    Section(header: Text("Your Playlists").foregroundColor(AppTheme.Colors.textSecondary)) {
                        ForEach(libraryManager.playlists) { playlist in
                            Button(action: {
                                libraryManager.addSongToPlaylist(song, playlistId: playlist.id)
                                dismiss()
                            }) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(playlist.name)
                                            .font(.system(size: 15, weight: .semibold))
                                            .foregroundColor(AppTheme.Colors.textPrimary)
                                        Text("\(playlist.songs.count) songs")
                                            .font(.system(size: 12))
                                            .foregroundColor(AppTheme.Colors.textSecondary)
                                    }
                                    Spacer()
                                    Image(systemName: "plus")
                                        .foregroundColor(AppTheme.Colors.textTertiary)
                                }
                            }
                            .listRowBackground(AppTheme.Colors.surface)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
            .navigationTitle("Add to Playlist")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundColor(AppTheme.Colors.accent)
                }
            }
            .alert("New Playlist", isPresented: $showCreatePrompt) {
                TextField("Playlist Name", text: $newPlaylistName)
                Button("Create") {
                    let p = libraryManager.createPlaylist(name: newPlaylistName)
                    libraryManager.addSongToPlaylist(song, playlistId: p.id)
                    newPlaylistName = ""
                    dismiss()
                }
                Button("Cancel", role: .cancel) { newPlaylistName = "" }
            }
        }
    }
}
