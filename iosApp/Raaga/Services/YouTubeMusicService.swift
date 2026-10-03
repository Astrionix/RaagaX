import Foundation

/// YouTube Music Innertube client for discovery, search, browse, and video ID resolution.
/// Playback is always executed strictly through the official YouTube IFrame Player API.
actor YouTubeMusicService {
    static let shared = YouTubeMusicService()

    private let musicBase = URL(string: "https://music.youtube.com/youtubei/v1")!
    private let clientVersion = "1.20250101.01.00"
    private let clientId = "67"

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 20
        return URLSession(configuration: config)
    }()

    private init() {}

    // MARK: - Filter Types

    enum SearchFilter: String, CaseIterable, Identifiable {
        case all = "All"
        case songs = "Songs"
        case videos = "Videos"
        case albums = "Albums"
        case artists = "Artists"

        var id: String { rawValue }

        var param: String? {
            switch self {
            case .all: return nil
            case .songs: return "EgWKAQIIAWoMEAMQBBAJEAoQBRAV"
            case .videos: return "EgWKAQIQAWoMEAMQBBAJEAoQBRAV"
            case .albums: return "EgWKAQIYAWoMEAMQBBAJEAoQBRAV"
            case .artists: return "EgWKAQIgAWoMEAMQBBAJEAoQBRAV"
            }
        }
    }

    // MARK: - Public API

    /// Fetch search suggestions as user types.
    func searchSuggestions(query: String) async -> [String] {
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else { return [] }
        let payload: JSONDict = ["input": query]
        guard let json = await postMusic(endpoint: "music/get_search_suggestions", body: payload) else {
            return []
        }

        // Parse search suggestions
        let contents = JSON.findAll("searchSuggestionRenderer", in: json)
        return contents.compactMap { d -> String? in
            let runs = JSON.runs(d["suggestion"])
            let text = runs.compactMap { $0["text"] as? String }.joined()
            return text.isEmpty ? nil : text
        }
    }

    /// Search YouTube Music for tracks, albums, artists.
    func search(query: String, filter: SearchFilter = .all) async -> (songs: [Song], collections: [MediaCollection]) {
        var payload: JSONDict = ["query": query]
        if let param = filter.param {
            payload["params"] = param
        }

        guard let json = await postMusic(endpoint: "search", body: payload) else {
            return ([], [])
        }

        return parseSearchContents(json)
    }

    /// Resolve a playable YouTube video ID for a song (if it only has JioSaavn metadata or missing ID).
    func resolveVideoId(for song: Song) async -> String? {
        if let existing = song.videoId, !existing.isEmpty {
            return existing
        }

        let searchQuery = "\(song.title) \(song.artist) audio"
        let (songs, _) = await search(query: searchQuery, filter: .songs)

        // Find the closest matching track
        if let best = songs.first(where: { track in
            let titleSim = track.title.lowercased().contains(song.title.lowercased()) ||
                           song.title.lowercased().contains(track.title.lowercased())
            return titleSim && track.videoId != nil
        }) {
            return best.videoId
        }

        return songs.first?.videoId
    }

    /// Get Home feed shelves (Trending, Quick Picks, Recommended).
    func browseHome() async -> [Shelf] {
        let payload: JSONDict = ["browseId": "FEmusic_home"]
        guard let json = await postMusic(endpoint: "browse", body: payload) else {
            return []
        }

        return parseBrowseShelves(json)
    }

    /// Browse playlist, album, or artist page.
    func browse(browseId: String) async -> (collection: MediaCollection?, songs: [Song]) {
        let payload: JSONDict = ["browseId": browseId]
        guard let json = await postMusic(endpoint: "browse", body: payload) else {
            return (nil, [])
        }

        // Header collection info
        var collection: MediaCollection? = nil
        if let header = JSON.findFirst(["musicDetailHeaderRenderer", "musicResponsiveHeaderRenderer", "musicVisualHeaderRenderer"], in: json) {
            let title = JSON.text(header["title"])
            let subtitle = JSON.text(header["subtitle"])
            let thumb = JSON.bestThumbnail(header)
            let kind: CollectionKind = browseId.hasPrefix("MPREb_") || browseId.hasPrefix("FEmusic_album") ? .album :
                                      (browseId.hasPrefix("UC") || browseId.hasPrefix("FEmusic_artist") ? .artist : .playlist)
            collection = MediaCollection(
                browseId: browseId,
                title: title.isEmpty ? "Collection" : title,
                subtitle: subtitle,
                thumbnailURL: thumb,
                kind: kind
            )
        }

        // Songs inside the page
        let songRows = JSON.findAll("musicResponsiveListItemRenderer", in: json)
        let songs = songRows.compactMap(parseListItemRenderer)

        return (collection, songs)
    }

    /// Fetch YouTube Music "RDAMVM" radio queue continuation for AutoPlay.
    func fetchNextRadio(videoId: String) async -> [Song] {
        let payload: JSONDict = [
            "videoId": videoId,
            "playlistId": "RDAMVM\(videoId)",
            "isAudioOnly": true
        ]
        guard let json = await postMusic(endpoint: "next", body: payload) else {
            return []
        }

        let renderers = JSON.findAll("playlistPanelVideoRenderer", in: json)
        return renderers.compactMap(parsePlaylistPanelVideoRenderer)
    }

    // MARK: - Private Innertube Networking

    private func postMusic(endpoint: String, body: JSONDict) async -> JSONDict? {
        guard let url = URL(string: endpoint, relativeTo: musicBase) else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("https://music.youtube.com", forHTTPHeaderField: "Origin")
        request.setValue("https://music.youtube.com/", forHTTPHeaderField: "Referer")
        request.setValue(clientId, forHTTPHeaderField: "X-YouTube-Client-Name")
        request.setValue(clientVersion, forHTTPHeaderField: "X-YouTube-Client-Version")
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", forHTTPHeaderField: "User-Agent")
        request.setValue("en-US,en;q=0.9", forHTTPHeaderField: "Accept-Language")

        var fullPayload = body
        fullPayload["context"] = [
            "client": [
                "clientName": "WEB_REMIX",
                "clientVersion": clientVersion,
                "hl": "en",
                "gl": "IN"
            ]
        ]

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: fullPayload)
            let (data, response) = try await session.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            return try JSONSerialization.jsonObject(with: data) as? JSONDict
        } catch {
            return nil
        }
    }

    // MARK: - Parsing Helpers

    private func parseSearchContents(_ json: JSONDict) -> (songs: [Song], collections: [MediaCollection]) {
        var songs: [Song] = []
        var collections: [MediaCollection] = []

        let items = JSON.findAll("musicResponsiveListItemRenderer", in: json)
        for item in items {
            let navEndpoint = JSON.findFirst(["navigationEndpoint", "doubleTapCommand", "playNavigationEndpoint"], in: item)
            let browseId = JSON.string(navEndpoint, "browseEndpoint", "browseId")

            if let song = parseListItemRenderer(item) {
                songs.append(song)
            } else if let browseId = browseId, !browseId.isEmpty {
                let columns = (item["flexColumns"] as? [Any])?.compactMap { $0 as? JSONDict } ?? []
                var title = ""
                var subtitle = ""
                if columns.count > 0 {
                    title = JSON.text(JSON.dig(columns[0], ["musicResponsiveListItemFlexColumnRenderer", "text"]))
                }
                if columns.count > 1 {
                    subtitle = JSON.text(JSON.dig(columns[1], ["musicResponsiveListItemFlexColumnRenderer", "text"]))
                }
                let thumb = JSON.bestThumbnail(item)
                let kind: CollectionKind = browseId.hasPrefix("MPREb_") ? .album :
                                          (browseId.hasPrefix("UC") ? .artist : .playlist)
                collections.append(MediaCollection(
                    browseId: browseId,
                    title: title.isEmpty ? "Collection" : title,
                    subtitle: subtitle,
                    thumbnailURL: thumb,
                    kind: kind
                ))
            }
        }

        return (songs, collections)
    }

    private func parseListItemRenderer(_ item: JSONDict) -> Song? {
        let flexCols = (item["flexColumns"] as? [Any])?.compactMap { $0 as? JSONDict } ?? []
        guard !flexCols.isEmpty else { return nil }

        let firstCol = flexCols[0]["musicResponsiveListItemFlexColumnRenderer"] as? JSONDict
        let titleRuns = JSON.runs(firstCol?["text"])
        let title = titleRuns.compactMap { $0["text"] as? String }.joined().trimmed
        guard !title.isEmpty else { return nil }

        // Video ID from play navigation endpoint or menu
        var videoId: String? = nil
        if let nav = JSON.findFirst(["watchEndpoint"], in: item) {
            videoId = nav["videoId"] as? String
        }
        if videoId == nil, let overlay = JSON.findFirst(["playNavigationEndpoint"], in: item) {
            videoId = JSON.string(overlay, "watchEndpoint", "videoId")
        }

        // Subtitle & details
        var artist = "Unknown Artist"
        var album: String? = nil
        var durationText: String? = nil

        if flexCols.count > 1 {
            let secondCol = flexCols[1]["musicResponsiveListItemFlexColumnRenderer"] as? JSONDict
            let runs = JSON.runs(secondCol?["text"])
            let tokens = runs.compactMap { ($0["text"] as? String)?.trimmed }.filter { $0 != "•" && !$0.isEmpty }
            if !tokens.isEmpty {
                artist = tokens[0]
            }
            if tokens.count > 1 {
                album = tokens[1]
            }
            if let last = tokens.last, last.contains(":") {
                durationText = last
            }
        }

        // Fixed column duration fallback
        if durationText == nil, let fixed = (item["fixedColumns"] as? [Any])?.first as? JSONDict {
            let fixedCol = fixed["musicResponsiveListItemFixedColumnRenderer"] as? JSONDict
            durationText = JSON.text(fixedCol?["text"]).trimmed.nilIfEmpty
        }

        let thumbnail = JSON.bestThumbnail(item)

        return Song(
            videoId: videoId,
            title: title,
            artist: artist,
            album: album,
            thumbnailURL: thumbnail,
            durationText: durationText
        )
    }

    private func parsePlaylistPanelVideoRenderer(_ item: JSONDict) -> Song? {
        guard let videoId = item["videoId"] as? String, !videoId.isEmpty else { return nil }
        let title = JSON.text(item["title"]).trimmed
        let subtitle = JSON.text(item["longBylineText"]).trimmed
        let thumb = JSON.bestThumbnail(item)
        let duration = JSON.text(item["lengthText"]).trimmed

        return Song(
            videoId: videoId,
            title: title.isEmpty ? "Track" : title,
            artist: subtitle.isEmpty ? "Artist" : subtitle,
            thumbnailURL: thumb,
            durationText: duration.nilIfEmpty
        )
    }

    private func parseBrowseShelves(_ json: JSONDict) -> [Shelf] {
        var shelves: [Shelf] = []
        let sectionRenderers = JSON.findAll("musicCarouselShelfRenderer", in: json)

        for shelfDict in sectionRenderers {
            let header = JSON.findFirst(["musicCarouselShelfBasicHeaderRenderer"], in: shelfDict)
            let title = JSON.text(header?["title"]).trimmed
            let subtitle = JSON.text(header?["strapline"]).trimmed.nilIfEmpty

            let contents = (shelfDict["contents"] as? [Any])?.compactMap { $0 as? JSONDict } ?? []
            var items: [MediaItem] = []

            for content in contents {
                if let itemRenderer = content["musicResponsiveListItemRenderer"] as? JSONDict,
                   let song = parseListItemRenderer(itemRenderer) {
                    items.append(.song(song))
                } else if let cardRenderer = content["musicTwoRowItemRenderer"] as? JSONDict {
                    let title = JSON.text(cardRenderer["title"]).trimmed
                    let subtitle = JSON.text(cardRenderer["subtitle"]).trimmed
                    let thumb = JSON.bestThumbnail(cardRenderer)

                    let nav = JSON.findFirst(["navigationEndpoint"], in: cardRenderer)
                    if let watchVideoId = JSON.string(nav, "watchEndpoint", "videoId") {
                        let song = Song(
                            videoId: watchVideoId,
                            title: title,
                            artist: subtitle,
                            thumbnailURL: thumb
                        )
                        items.append(.song(song))
                    } else if let browseId = JSON.string(nav, "browseEndpoint", "browseId") {
                        let kind: CollectionKind = browseId.hasPrefix("MPREb_") ? .album :
                                                  (browseId.hasPrefix("UC") ? .artist : .playlist)
                        items.append(.collection(MediaCollection(
                            browseId: browseId,
                            title: title,
                            subtitle: subtitle,
                            thumbnailURL: thumb,
                            kind: kind
                        )))
                    }
                }
            }

            if !items.isEmpty {
                let style: ShelfStyle = items.allSatisfy { if case .song = $0 { return true }; return false } ? .quickPicks : .carousel
                shelves.append(Shelf(
                    title: title.isEmpty ? "Featured" : title,
                    subtitle: subtitle,
                    items: items,
                    style: style
                ))
            }
        }

        return shelves
    }
}
