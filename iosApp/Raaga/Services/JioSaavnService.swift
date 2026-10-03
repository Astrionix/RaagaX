import Foundation

/// JioSaavn catalog & metadata provider.
/// Strictly metadata/catalog lookup only per AGENTS.md rules.
actor JioSaavnService {
    static let shared = JioSaavnService()

    // Base URL decoded: https://www.jiosaavn.com/api.php
    private let baseURL = URL(string: "https://www.jiosaavn.com/api.php")!

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 8
        config.timeoutIntervalForResource = 15
        config.httpAdditionalHeaders = [
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
            "Accept-Language": "en-IN,en;q=0.9",
            "Cookie": "explicit_content=1"
        ]
        return URLSession(configuration: config)
    }()

    private init() {}

    // MARK: - API Calls

    /// Search for songs matching a query.
    func searchSongs(query: String) async -> [Song] {
        guard let url = buildURL(params: [
            "__call": "search.getResults",
            "_format": "json",
            "_marker": "0",
            "api_version": "4",
            "ctx": "android",
            "q": query,
            "p": "1",
            "n": "25"
        ]) else { return [] }

        do {
            let (data, response) = try await session.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return [] }
            guard let json = try? JSONSerialization.jsonObject(with: data) as? JSONDict else { return [] }
            let results = (json["results"] as? [Any])?.compactMap { $0 as? JSONDict } ?? []
            return results.compactMap(parseSaavnSong)
        } catch {
            return []
        }
    }

    /// Trending songs for a specific language (telugu, hindi, english, etc.)
    func getTrendingSongs(language: String = "telugu") async -> [Song] {
        let query = "\(language) top hits"
        return await searchSongs(query: query)
    }

    /// Get album details by album ID or token
    func getAlbum(albumId: String) async -> (collection: MediaCollection?, songs: [Song]) {
        guard let url = buildURL(params: [
            "__call": "content.getAlbumDetails",
            "_format": "json",
            "_marker": "0",
            "api_version": "4",
            "albumid": albumId
        ]) else { return (nil, []) }

        do {
            let (data, response) = try await session.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return (nil, []) }
            guard let json = try? JSONSerialization.jsonObject(with: data) as? JSONDict else { return (nil, []) }

            let title = (json["title"] as? String)?.htmlDecoded ?? "Album"
            let artist = (json["primary_artists"] as? String)?.htmlDecoded ?? ""
            let image = json["image"] as? String
            let rawSongs = (json["list"] as? [Any])?.compactMap { $0 as? JSONDict } ?? []
            let songs = rawSongs.compactMap(parseSaavnSong)

            let collection = MediaCollection(
                browseId: "saavn_album:\(albumId)",
                title: title,
                subtitle: artist,
                thumbnailURL: image,
                kind: .album
            )
            return (collection, songs)
        } catch {
            return (nil, [])
        }
    }

    // MARK: - Parsing

    private func parseSaavnSong(_ dict: JSONDict) -> Song? {
        guard let id = dict["id"] as? String, !id.isEmpty else { return nil }
        let title = (dict["title"] as? String)?.htmlDecoded.trimmed ?? "Unknown Title"
        let image = dict["image"] as? String

        let moreInfo = dict["more_info"] as? JSONDict ?? [:]
        let album = (moreInfo["album"] as? String)?.htmlDecoded.trimmed
        let albumId = moreInfo["album_id"] as? String

        // Extract artists from artistMap or direct string
        var artist = (dict["subtitle"] as? String)?.htmlDecoded.trimmed ?? ""
        if artist.isEmpty, let artistMap = moreInfo["artistMap"] as? JSONDict {
            let primary = (artistMap["primary_artists"] as? [Any])?.compactMap { $0 as? JSONDict } ?? []
            artist = primary.compactMap { ($0["name"] as? String)?.htmlDecoded }.joined(separator: ", ")
        }
        if artist.isEmpty {
            artist = (moreInfo["singers"] as? String)?.htmlDecoded.trimmed ?? "Unknown Artist"
        }

        let durationSeconds = (moreInfo["duration"] as? String).flatMap(Double.init)
            ?? (dict["duration"] as? String).flatMap(Double.init)
        let durationText = durationSeconds.map(TimeFormat.string)

        return Song(
            videoId: nil, // Will be resolved via YouTube search when queued/played
            saavnId: id,
            title: title,
            artist: artist,
            album: album,
            albumId: albumId,
            thumbnailURL: image,
            durationText: durationText
        )
    }

    private func buildURL(params: [String: String]) -> URL? {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        components?.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        return components?.url
    }
}
