import Foundation

// MARK: - Artwork

enum Artwork {
    /// Upscales the small thumbnails YouTube Music and JioSaavn hand out.
    static func url(_ raw: String?, size: Int = 544) -> URL? {
        guard var s = raw?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
        if s.hasPrefix("//") { s = "https:" + s }
        if s.hasPrefix("http://") { s = "https://" + s.dropFirst("http://".count) }

        if s.contains("googleusercontent.com") || s.contains("ggpht.com") {
            if let r = s.range(of: #"=w\d+-h\d+.*$"#, options: .regularExpression) {
                s.replaceSubrange(r, with: "=w\(size)-h\(size)-l90-rj")
            } else if let r = s.range(of: #"=s\d+.*$"#, options: .regularExpression) {
                s.replaceSubrange(r, with: "=s\(size)")
            }
        } else if s.contains("saavncdn.com") {
            s = s.replacingOccurrences(of: "150x150", with: "500x500")
                .replacingOccurrences(of: "50x50", with: "500x500")
        }
        return URL(string: s)
    }
}

// MARK: - Time

enum TimeFormat {
    static func string(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "0:00" }
        let total = Int(seconds.rounded(.down))
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0
            ? String(format: "%d:%02d:%02d", h, m, s)
            : String(format: "%d:%02d", m, s)
    }

    static func seconds(from text: String?) -> Double? {
        guard let text, !text.isEmpty else { return nil }
        let pieces = text.split(separator: ":")
        let numbers = pieces.compactMap { Double($0) }
        guard !numbers.isEmpty, numbers.count == pieces.count else { return nil }
        return numbers.reduce(0) { $0 * 60 + $1 }
    }
}

// MARK: - String helpers

extension String {
    func firstMatch(_ pattern: String, group: Int = 1) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(startIndex..., in: self)
        guard let match = regex.firstMatch(in: self, range: range),
              match.numberOfRanges > group,
              let r = Range(match.range(at: group), in: self) else { return nil }
        return String(self[r])
    }

    var htmlDecoded: String {
        guard contains("&") else { return self }
        let entities: [(String, String)] = [
            ("&quot;", "\""), ("&#039;", "'"), ("&#39;", "'"), ("&apos;", "'"),
            ("&lt;", "<"), ("&gt;", ">"), ("&nbsp;", " "), ("&amp;", "&"),
        ]
        var s = self
        for (entity, value) in entities { s = s.replacingOccurrences(of: entity, with: value) }
        return s
    }

    var nilIfEmpty: String? { isEmpty ? nil : self }

    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

// MARK: - Loose JSON walking

typealias JSONDict = [String: Any]

/// Innertube responses are deep, loosely-typed and change shape often, so
/// they are read by path with every step optional rather than decoded.
enum JSON {
    static func dig(_ obj: Any?, _ path: [Any]) -> Any? {
        var current = obj
        for step in path {
            if let key = step as? String {
                current = (current as? JSONDict)?[key]
            } else if let index = step as? Int {
                guard let array = current as? [Any], array.indices.contains(index) else { return nil }
                current = array[index]
            } else {
                return nil
            }
        }
        return current
    }

    static func dict(_ obj: Any?, _ path: Any...) -> JSONDict? { dig(obj, path) as? JSONDict }
    static func array(_ obj: Any?, _ path: Any...) -> [Any] { dig(obj, path) as? [Any] ?? [] }
    static func string(_ obj: Any?, _ path: Any...) -> String? { dig(obj, path) as? String }

    /// Text of a `{ runs: [...] }` or `{ simpleText: ... }` node.
    static func text(_ obj: Any?) -> String {
        guard let d = obj as? JSONDict else { return "" }
        if let simple = d["simpleText"] as? String { return simple }
        return runs(d).compactMap { $0["text"] as? String }.joined()
    }

    static func runs(_ obj: Any?) -> [JSONDict] {
        ((obj as? JSONDict)?["runs"] as? [Any])?.compactMap { $0 as? JSONDict } ?? []
    }

    /// Every value stored under `key`, without descending into a match.
    static func findAll(_ key: String, in obj: Any?) -> [JSONDict] {
        var out: [JSONDict] = []
        func walk(_ node: Any?) {
            if let d = node as? JSONDict {
                if let match = d[key] as? JSONDict {
                    out.append(match)
                    return
                }
                for value in d.values { walk(value) }
            } else if let a = node as? [Any] {
                for value in a { walk(value) }
            }
        }
        walk(obj)
        return out
    }

    /// The first value stored under any of `keys`.
    static func findFirst(_ keys: [String], in obj: Any?) -> JSONDict? {
        if let d = obj as? JSONDict {
            for key in keys {
                if let match = d[key] as? JSONDict { return match }
            }
            for value in d.values {
                if let found = findFirst(keys, in: value) { return found }
            }
        } else if let a = obj as? [Any] {
            for value in a {
                if let found = findFirst(keys, in: value) { return found }
            }
        }
        return nil
    }

    /// URL of the largest image in the first `thumbnails` array found.
    static func bestThumbnail(_ obj: Any?) -> String? {
        if let d = obj as? JSONDict {
            if let list = d["thumbnails"] as? [Any],
               let last = list.last as? JSONDict,
               let url = last["url"] as? String {
                return url
            }
            for value in d.values {
                if let url = bestThumbnail(value) { return url }
            }
        } else if let a = obj as? [Any] {
            for value in a {
                if let url = bestThumbnail(value) { return url }
            }
        }
        return nil
    }
}
