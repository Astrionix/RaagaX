import Foundation
import Combine
import MediaPlayer
import AVFoundation

enum PlaybackState: Equatable {
    case idle
    case loading
    case playing
    case paused
    case buffering
    case failed(String)
}

/// Central playback manager orchestrating the queue, track resolution,
/// lock screen now-playing metadata, and bridging with the YouTube IFrame player.
@MainActor
final class AudioPlayerManager: ObservableObject {
    static let shared = AudioPlayerManager()

    // MARK: - Published Properties

    @Published private(set) var currentSong: Song? = nil
    @Published private(set) var currentVideoId: String? = nil
    @Published private(set) var playbackState: PlaybackState = .idle
    @Published private(set) var queue: [Song] = []
    @Published private(set) var queueIndex: Int = 0

    @Published var currentTime: Double = 0
    @Published var duration: Double = 0
    @Published var isShuffled: Bool = false
    @Published var repeatMode: RepeatMode = .off
    @Published var showVideoPlayer: Bool = false // Toggle between Artwork and IFrame video

    // MARK: - Actions dispatched to YouTube WebView Player

    var onCommand: ((PlayerCommand) -> Void)?

    enum PlayerCommand {
        case load(videoId: String)
        case play
        case pause
        case seek(to: Double)
    }

    private var unShuffledQueue: [Song] = []
    private var isResolving = false

    private init() {
        configureAudioSession()
        setupRemoteCommands()
    }

    // MARK: - Playback Queue Management

    /// Play a single song directly, adding it to the queue.
    func play(song: Song) {
        queue = [song]
        unShuffledQueue = [song]
        queueIndex = 0
        loadCurrentTrack()
    }

    /// Play a playlist/album list starting at a specific index.
    func playQueue(songs: [Song], startAt index: Int = 0) {
        guard !songs.isEmpty else { return }
        unShuffledQueue = songs
        if isShuffled {
            var shuffled = songs
            let starting = songs.indices.contains(index) ? songs[index] : songs[0]
            shuffled.removeAll(where: { $0.id == starting.id })
            shuffled.shuffle()
            queue = [starting] + shuffled
            queueIndex = 0
        } else {
            queue = songs
            queueIndex = max(0, min(index, songs.count - 1))
        }
        loadCurrentTrack()
    }

    /// Insert song immediately after currently playing song.
    func playNext(song: Song) {
        if queue.isEmpty {
            play(song: song)
            return
        }
        let insertIndex = min(queueIndex + 1, queue.count)
        queue.insert(song, at: insertIndex)
        unShuffledQueue.append(song)
    }

    /// Append song to the end of queue.
    func addToQueue(song: Song) {
        if queue.isEmpty {
            play(song: song)
            return
        }
        queue.append(song)
        unShuffledQueue.append(song)
    }

    func removeQueueItem(at index: Int) {
        guard queue.indices.contains(index) else { return }
        let removed = queue.remove(at: index)
        unShuffledQueue.removeAll(where: { $0.id == removed.id })
        if index < queueIndex {
            queueIndex -= 1
        } else if index == queueIndex {
            if queue.isEmpty {
                stop()
            } else {
                queueIndex = min(queueIndex, queue.count - 1)
                loadCurrentTrack()
            }
        }
    }

    func moveQueueItem(from source: IndexSet, to destination: Int) {
        queue.move(fromOffsets: source, toOffset: destination)
    }

    // MARK: - Transport Controls

    func togglePlayPause() {
        switch playbackState {
        case .playing:
            playbackState = .paused
            onCommand?(.pause)
        case .paused:
            playbackState = .playing
            onCommand?(.play)
        case .idle:
            if let song = currentSong {
                play(song: song)
            }
        default:
            break
        }
        updateNowPlayingPlaybackInfo()
    }

    func next() {
        guard !queue.isEmpty else { return }
        if queueIndex + 1 < queue.count {
            queueIndex += 1
            loadCurrentTrack()
        } else if repeatMode == .all {
            queueIndex = 0
            loadCurrentTrack()
        } else {
            // Reached end of queue: fetch AutoPlay radio continuation!
            fetchAutoPlayContinuation()
        }
    }

    func previous() {
        if currentTime > 3.0 {
            seek(to: 0)
        } else if queueIndex > 0 {
            queueIndex -= 1
            loadCurrentTrack()
        } else {
            seek(to: 0)
        }
    }

    func seek(to seconds: Double) {
        currentTime = seconds
        onCommand?(.seek(to: seconds))
        updateNowPlayingPlaybackInfo()
    }

    func toggleShuffle() {
        isShuffled.toggle()
        guard let current = currentSong else { return }
        if isShuffled {
            var rest = queue
            rest.removeAll(where: { $0.id == current.id })
            rest.shuffle()
            queue = [current] + rest
            queueIndex = 0
        } else {
            queue = unShuffledQueue
            if let idx = queue.firstIndex(where: { $0.id == current.id }) {
                queueIndex = idx
            }
        }
    }

    func cycleRepeatMode() {
        repeatMode = repeatMode.next
    }

    func stop() {
        currentSong = nil
        currentVideoId = nil
        playbackState = .idle
        currentTime = 0
        duration = 0
        onCommand?(.pause)
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    // MARK: - Private Track Resolution & Loading

    private func loadCurrentTrack() {
        guard queue.indices.contains(queueIndex) else { return }
        let song = queue[queueIndex]
        currentSong = song
        currentTime = 0
        duration = song.durationSeconds ?? 0
        playbackState = .loading

        Task {
            isResolving = true
            var targetVideoId = song.videoId

            // If videoId is missing (e.g. JioSaavn discovery), resolve via YouTube
            if targetVideoId == nil || targetVideoId?.isEmpty == true {
                targetVideoId = await YouTubeMusicService.shared.resolveVideoId(for: song)
            }

            guard let finalVideoId = targetVideoId, !finalVideoId.isEmpty else {
                self.playbackState = .failed("Song video ID could not be resolved")
                self.isResolving = false
                return
            }

            self.currentVideoId = finalVideoId
            self.isResolving = false
            self.onCommand?(.load(videoId: finalVideoId))

            // Update local history
            LibraryManager.shared.recordPlay(song)

            // Update lock screen metadata
            self.updateNowPlayingMetadata(song: song)
        }
    }

    private func fetchAutoPlayContinuation() {
        guard let videoId = currentVideoId else { return }
        Task {
            let nextSongs = await YouTubeMusicService.shared.fetchNextRadio(videoId: videoId)
            // Filter out songs already in queue
            let unique = nextSongs.filter { s in !self.queue.contains(where: { $0.id == s.id }) }
            if !unique.isEmpty {
                self.queue.append(contentsOf: unique)
                self.unShuffledQueue.append(contentsOf: unique)
                self.queueIndex += 1
                self.loadCurrentTrack()
            }
        }
    }

    // MARK: - Bridge Callbacks from WKWebView

    func handlePlayerReady() {
        if let videoId = currentVideoId {
            onCommand?(.load(videoId: videoId))
        }
    }

    func handlePlayerStateChange(_ state: Int) {
        switch state {
        case -1: // Unstarted
            break
        case 0:  // Ended
            if repeatMode == .one {
                seek(to: 0)
                onCommand?(.play)
            } else {
                next()
            }
        case 1:  // Playing
            playbackState = .playing
            updateNowPlayingPlaybackInfo()
        case 2:  // Paused
            playbackState = .paused
            updateNowPlayingPlaybackInfo()
        case 3:  // Buffering
            playbackState = .buffering
        default:
            break
        }
    }

    func handlePlayerProgress(currentTime: Double, duration: Double) {
        self.currentTime = currentTime
        if duration > 0 {
            self.duration = duration
        }
        updateNowPlayingPlaybackInfo()
    }

    func handlePlayerError(code: Int) {
        // If track fails, try advancing to next track
        playbackState = .failed("Playback error (\(code))")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.next()
        }
    }

    // MARK: - Audio Session & Lock Screen Metadata

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            print("Failed to configure audio session: \(error)")
        }
    }

    private func setupRemoteCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()

        commandCenter.playCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.togglePlayPause()
            return .success
        }

        commandCenter.pauseCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.togglePlayPause()
            return .success
        }

        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.next()
            return .success
        }

        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            self.previous()
            return .success
        }

        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let self = self, let event = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            self.seek(to: event.positionTime)
            return .success
        }
    }

    private func updateNowPlayingMetadata(song: Song) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: song.title,
            MPMediaItemPropertyArtist: song.artist,
            MPNowPlayingInfoPropertyPlaybackRate: playbackState == .playing ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime
        ]

        if let album = song.album {
            info[MPMediaItemPropertyAlbumTitle] = album
        }
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        // Asynchronously fetch artwork
        if let artURL = song.artworkURL(size: 512) {
            Task {
                if let (data, _) = try? await URLSession.shared.data(from: artURL),
                   let image = UIImage(data: data) {
                    var currentInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                    let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                    currentInfo[MPMediaItemPropertyArtwork] = artwork
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = currentInfo
                }
            }
        }
    }

    private func updateNowPlayingPlaybackInfo() {
        guard var info = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        info[MPNowPlayingInfoPropertyPlaybackRate] = playbackState == .playing ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
}
