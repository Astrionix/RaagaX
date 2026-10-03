import Foundation
import Combine

/// Manages local user data: Liked Songs, Custom Playlists, and Playback History.
@MainActor
final class LibraryManager: ObservableObject {
    static let shared = LibraryManager()

    @Published private(set) var likedSongs: [Song] = []
    @Published private(set) var playlists: [UserPlaylist] = []
    @Published private(set) var history: [Song] = []

    private let likedSongsKey = "raaga_liked_songs"
    private let playlistsKey = "raaga_user_playlists"
    private let historyKey = "raaga_playback_history"

    init() {
        loadData()
    }

    // MARK: - Likes

    func isLiked(_ song: Song) -> Bool {
        likedSongs.contains(where: { $0.id == song.id })
    }

    func toggleLike(_ song: Song) {
        if isLiked(song) {
            likedSongs.removeAll(where: { $0.id == song.id })
        } else {
            likedSongs.insert(song, at: 0)
        }
        saveLikes()
    }

    // MARK: - Playlists

    func createPlaylist(name: String) -> UserPlaylist {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalName = trimmed.isEmpty ? "New Playlist" : trimmed
        let playlist = UserPlaylist(name: finalName)
        playlists.insert(playlist, at: 0)
        savePlaylists()
        return playlist
    }

    func deletePlaylist(id: UUID) {
        playlists.removeAll(where: { $0.id == id })
        savePlaylists()
    }

    func addSongToPlaylist(_ song: Song, playlistId: UUID) {
        guard let index = playlists.firstIndex(where: { $0.id == playlistId }) else { return }
        if !playlists[index].songs.contains(where: { $0.id == song.id }) {
            playlists[index].songs.append(song)
            savePlaylists()
        }
    }

    func removeSongFromPlaylist(songId: String, playlistId: UUID) {
        guard let index = playlists.firstIndex(where: { $0.id == playlistId }) else { return }
        playlists[index].songs.removeAll(where: { $0.id == songId })
        savePlaylists()
    }

    func removeSongAtIndex(index: Int, playlistId: UUID) {
        guard let pIndex = playlists.firstIndex(where: { $0.id == playlistId }) else { return }
        if playlists[pIndex].songs.indices.contains(index) {
            playlists[pIndex].songs.remove(at: index)
            savePlaylists()
        }
    }

    // MARK: - History

    func recordPlay(_ song: Song) {
        history.removeAll(where: { $0.id == song.id })
        history.insert(song, at: 0)
        if history.count > 100 {
            history = Array(history.prefix(100))
        }
        saveHistory()
    }

    func clearHistory() {
        history.removeAll()
        saveHistory()
    }

    // MARK: - Persistence

    private func loadData() {
        if let data = UserDefaults.standard.data(forKey: likedSongsKey),
           let songs = try? JSONDecoder().decode([Song].self, from: data) {
            likedSongs = songs
        }
        if let data = UserDefaults.standard.data(forKey: playlistsKey),
           let list = try? JSONDecoder().decode([UserPlaylist].self, from: data) {
            playlists = list
        }
        if let data = UserDefaults.standard.data(forKey: historyKey),
           let hist = try? JSONDecoder().decode([Song].self, from: data) {
            history = hist
        }
    }

    private func saveLikes() {
        if let data = try? JSONEncoder().encode(likedSongs) {
            UserDefaults.standard.set(data, forKey: likedSongsKey)
        }
    }

    private func savePlaylists() {
        if let data = try? JSONEncoder().encode(playlists) {
            UserDefaults.standard.set(data, forKey: playlistsKey)
        }
    }

    private func saveHistory() {
        if let data = try? JSONEncoder().encode(history) {
            UserDefaults.standard.set(data, forKey: historyKey)
        }
    }
}
