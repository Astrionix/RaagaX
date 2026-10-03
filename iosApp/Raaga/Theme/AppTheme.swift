import SwiftUI

// MARK: - Raaga design tokens

enum AppTheme {
    enum Colors {
        static let background     = Color(hex: "#0A0A0F")
        static let surface        = Color(hex: "#13131A")
        static let surfaceVariant = Color(hex: "#1E1E2A")
        static let border         = Color(hex: "#2A2A3A")

        static let primary      = Color(hex: "#7B5CF0")
        static let primaryLight = Color(hex: "#9B7FF8")
        static let primaryDark  = Color(hex: "#5A3DC8")
        static let accent       = Color(hex: "#E040FB")
        static let accentBlue   = Color(hex: "#40C4FF")

        static let textPrimary   = Color.white
        static let textSecondary = Color(hex: "#A0A0B2")
        static let textTertiary  = Color(hex: "#6C6C80")

        static let onBackground   = Color.white
        static let onSurface      = Color(hex: "#E8E8F0")
        static let onSurfaceMuted = Color(hex: "#8E8EA3")
        static let onSurfaceFaint = Color(hex: "#4A4A60")

        static let accentGradient = LinearGradient(
            colors: [Color(hex: "#7B5CF0"), Color(hex: "#E040FB")],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        static let primaryGradient = LinearGradient(
            colors: [primary, accent],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        static let coolGradient = LinearGradient(
            colors: [accentBlue, primary],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
    }

    enum CornerRadius {
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 28
        static let full: CGFloat = 9999
    }

    enum Typography {
        static let displayLarge  = Font.system(size: 34, weight: .heavy, design: .rounded)
        static let displayMedium = Font.system(size: 26, weight: .bold, design: .rounded)
        static let titleLarge    = Font.system(size: 22, weight: .bold, design: .rounded)
        static let titleMedium   = Font.system(size: 18, weight: .semibold, design: .rounded)
        static let titleSmall    = Font.system(size: 15, weight: .semibold)
        static let bodyLarge     = Font.system(size: 15, weight: .regular)
        static let bodyMedium    = Font.system(size: 14, weight: .regular)
        static let bodySmall     = Font.system(size: 12.5, weight: .regular)
        static let labelMedium   = Font.system(size: 12, weight: .semibold)
        static let labelSmall    = Font.system(size: 11, weight: .medium)
    }

    enum Animation {
        static let fast   = SwiftUI.Animation.spring(response: 0.3, dampingFraction: 0.75)
        static let medium = SwiftUI.Animation.spring(response: 0.45, dampingFraction: 0.85)
    }
}

// MARK: - Player geometry

enum PlayerLayout {
    static let headerHeight: CGFloat = 56
    static let mini: CGFloat = 200
    static let miniControls: CGFloat = 46
    static let tabBar: CGFloat = 49

    static func expandedVideoHeight(_ width: CGFloat) -> CGFloat {
        max(200, (width - 32) * 9 / 16)
    }
}

// MARK: - Color from hex

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let a, r, g, b: UInt64
        switch cleaned.count {
        case 6: (a, r, g, b) = (255, value >> 16, value >> 8 & 0xFF, value & 0xFF)
        case 8: (a, r, g, b) = (value >> 24, value >> 16 & 0xFF, value >> 8 & 0xFF, value & 0xFF)
        default: (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(.sRGB,
                  red: Double(r) / 255,
                  green: Double(g) / 255,
                  blue: Double(b) / 255,
                  opacity: Double(a) / 255)
    }
}

// MARK: - Shimmer

struct ShimmerEffect: ViewModifier {
    @State private var phase: CGFloat = -0.4

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: phase - 0.3),
                        .init(color: .white.opacity(0.10), location: phase),
                        .init(color: .clear, location: phase + 0.3),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    phase = 1.4
                }
            }
    }
}

extension View {
    func shimmer() -> some View { modifier(ShimmerEffect()) }

    /// Clear list row chrome so rows sit directly on the app background.
    func plainListRow(insets: EdgeInsets = EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16)) -> some View {
        self
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listRowInsets(insets)
    }
}
