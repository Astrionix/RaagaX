import SwiftUI

/// Floating mini player pinned above the bottom navigation bar.
/// Tap anywhere to expand the full-screen NowPlayingView.
struct MiniPlayerView: View {
    @ObservedObject var playerManager = AudioPlayerManager.shared
    @Binding var isExpanded: Bool

    var body: some View {
        if let currentSong = playerManager.currentSong {
            VStack(spacing: 0) {
                // Micro top progress line
                GeometryReader { geo in
                    let progress = playerManager.duration > 0
                        ? min(1.0, max(0.0, playerManager.currentTime / playerManager.duration))
                        : 0.0

                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color.white.opacity(0.1))
                        Rectangle()
                            .fill(AppTheme.Colors.accentGradient)
                            .frame(width: geo.size.width * CGFloat(progress))
                    }
                }
                .frame(height: 2.5)

                // Main body
                HStack(spacing: 12) {
                    // Artwork
                    AsyncImage(url: currentSong.artworkURL(size: 160)) { phase in
                        if let image = phase.image {
                            image
                                .resizable()
                                .scaledToFill()
                        } else {
                            Rectangle()
                                .fill(AppTheme.Colors.surfaceVariant)
                                .overlay(
                                    Image(systemName: "music.note")
                                        .font(.system(size: 16))
                                        .foregroundColor(AppTheme.Colors.textTertiary)
                                )
                        }
                    }
                    .frame(width: 44, height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.sm, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: AppTheme.CornerRadius.sm, style: .continuous)
                            .stroke(AppTheme.Colors.border, lineWidth: 0.5)
                    )

                    // Song Info
                    VStack(alignment: .leading, spacing: 2) {
                        Text(currentSong.title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(AppTheme.Colors.textPrimary)
                            .lineLimit(1)

                        Text(currentSong.artist)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    // Play / Pause Button
                    Button(action: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        playerManager.togglePlayPause()
                    }) {
                        ZStack {
                            if playerManager.playbackState == .loading || playerManager.playbackState == .buffering {
                                ProgressView()
                                    .tint(.white)
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: playerManager.playbackState == .playing ? "pause.fill" : "play.fill")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(AppTheme.Colors.textPrimary)
                            }
                        }
                        .frame(width: 38, height: 38)
                    }

                    // Next Button
                    Button(action: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        playerManager.next()
                    }) {
                        Image(systemName: "forward.fill")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                            .frame(width: 38, height: 38)
                    }
                }
                .padding(.horizontal, AppTheme.Spacing.md)
                .padding(.vertical, 8)
            }
            .background(
                AppTheme.Colors.surface
                    .opacity(0.96)
                    .background(.ultraThinMaterial)
            )
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.CornerRadius.lg, style: .continuous)
                    .stroke(AppTheme.Colors.border, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.4), radius: 12, y: 4)
            .contentShape(Rectangle())
            .onTapGesture {
                isExpanded = true
            }
            .padding(.horizontal, AppTheme.Spacing.md)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }
}
