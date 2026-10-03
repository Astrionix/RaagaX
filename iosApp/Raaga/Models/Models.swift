import Foundation

/// A playable track. Identified by canonical ids only — a YouTube video id
/// (played through the official IFrame player) and/or a JioSaavn song id
/// (metadata only). No media URLs are ever stored.
struct Song: Identifiable, Hashable, Codable {
    var videoId: String?
    var saavnId: String? = nil
    var title: String
    var artist: String
    var album: String? = nil
    var albumId: String? = nil
    var artistId: String? = nil
    var thumbnailURL: String? = nil
    var durationText: String? = nil

    /// Stable across resolution: a JioSaavn row keeps its id after a
    /// matching YouTube video id is attached to it for playback.
    var id: String {
        if let saavnId { return "saavn:\(saavnId)" }
        return videoId ?? "title:\(title)|\(artist)"
    }

    func artworkURL(size: Int = 544) -> URL? { Artwork.url(thumbnailURL, size: size) }

    var durationSeconds: Double? { TimeFormat.seconds(from: durationText) }

    var shareURL: URL? {
        videoId.flatMap { URL(string: "https://music.youtube.com/watch?v=\($0)") }
    }

    var subtitleLine: String {
        [artist, durationText ?? ""].filter { !$0.isEmpty }.joined(separator: " • ")
    }
}

enum CollectionKind: String, Codable, Hashable {
    case album, playlist, artist
}

struct MediaCollection: Identifiable, Hashable {
    var browseId: String
    var title: String
    var subtitle: String
    var thumbnailURL: String?
    var kind: CollectionKind

    var id: String { browseId }
}

enum MediaItem: Identifiable, Hashable {
    case song(Song)
    case collection(MediaCollection)

    var id: String {
        switch self {
        case .song(let s): return s.id
        case .collection(let c): return "c:\(c.browseId)"
        }
    }
}

enum ShelfStyle: Hashable {
    /// Horizontal cards (albums, playlists, videos).
    case carousel
    /// Songs laid out as rows, paged horizontally (YT Music "Quick picks").
    case quickPicks
    /// A vertical track list (album/playlist body, artist top songs).
    case list
}

struct Shelf: Identifiable {
    let id = UUID()
    var title: String
    var subtitle: String? = nil
    var items: [MediaItem]
    var style: ShelfStyle

    var songs: [Song] {
        items.compactMap { item -> Song? in
            if case .song(let s) = item { return s }
            return nil
        }
    }
}

struct BrowsePage {
    var title: String
    var subtitle: String?
    var thumbnailURL: String?
    var shelves: [Shelf]

    /// Every track in the page's list shelves, in order.
    var songs: [Song] { shelves.filter { $0.style == .list }.flatMap(\.songs) }
}

struct BrowseTarget: Hashable {
    var browseId: String
    var title: String
    var kind: CollectionKind
}

extension BrowseTarget {
    init(_ collection: MediaCollection) {
        self.init(browseId: collection.browseId, title: collection.title, kind: collection.kind)
    }
}

/// One entry in the play queue. The same song queued twice is two entries.
struct QueueItem: Identifiable, Hashable {
    let id: UUID
    var song: Song

    init(_ song: Song) {
        self.id = UUID()
        self.song = song
    }
}

struct UserPlaylist: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var name: String
    var songs: [Song] = []
    var createdAt: Date = Date()
}

enum RepeatMode: String {
    case off, all, one

    var next: RepeatMode {
        switch self {
        case .off: return .all
        case .all: return .one
        case .one: return .off
        }
    }
}
