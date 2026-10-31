# Apple Music (Android v7.0.0) Library Reverse Engineering Analysis

## 1. Executive Summary & Device Reconnaissance
- **Target Device**: POCO F6 (`24069PC21I`, codename `peridot`)
- **OS Version**: Android 16 (API 36 / VanillaIceCream+)
- **Display Resolution**: 1220 x 2712 px @ 480 dpi (Density factor 3.0x: 1dp = 3px, viewport width = 406.6dp, height = 904dp)
- **Target App**: Apple Music Android
- **Package**: `com.apple.android.music`
- **Version**: 7.0.0
- **Main Launcher Activity**: `com.apple.android.music/.common.MainActivity`

---

## 2. Screen-by-Screen Architectural Breakdown

### Screen 1: Main Library Screen
- **Header**:
  - Left: Large display title `"Library"` (~34sp bold white text).
  - Right: Two circular icon buttons:
    1. **New Playlist button** (`+` over playlist lines) at `bounds [872,161][1016,305]`.
    2. **Overflow menu button** (`...` three horizontal dots) at `bounds [1028,161][1172,305]`.
- **Pinned Collection**:
  - Horizontal carousel of pinned items. Default: **Favorite Songs** card (`120dp x 120dp` rounded card, `16dp` radius, pure white background, red star icon in center, subtitle "Favorite Songs" below card).
- **Library Categories Navigation List**:
  - Clean list rows with subtle horizontal dividers.
  - Height: ~48-52dp per row.
  - Elements: Left vector icon, text label (16sp medium white), right chevron.
  - Categories:
    1. **Playlists** (Icon: musical note over list lines)
    2. **Artists** (Icon: microphone)
    3. **Albums** (Icon: layered vinyl/album sleeve)
    4. **Songs** (Icon: musical note)
    5. **Made For You** (Icon: person silhouette in rounded square)
    6. **Downloaded** (Icon: circle with down arrow)
    7. **TV & Movies** (Icon: widescreen display)
- **Recently Added Section**:
  - Section title: `"Recently Added"` (20sp bold).
  - 2-Column Grid of albums / playlists:
    - Card: Square artwork with 12dp rounded corners.
    - Title: 14sp medium white (max 2 lines).
    - Subtitle: 12sp regular grey (artist or playlist curator).
- **Bottom Navigation**:
  - 5 tabs: Home, New, Radio, Library, Search.
  - Mini-player floats above bottom bar with current artwork, title, artist, and play/next controls.

---

### Screen 2: Library Customization Overflow Menu
Tapping `...` at the top right of the Library screen opens a native popup dropdown menu anchored below the button:
- **Edit Pins** (Icon: pushpin)
- **Edit Categories** (Icon: 3 horizontal list bars)
- *[Divider line]*
- **Settings**
- **Account**

---

### Screen 3: Edit Pins Mode
- **State Transition**:
  - Top right changes to a solid blue circular checkmark button `[✓]` (Done action).
  - Each pinned card displays a circular grey `-` (minus) unpin badge at its top-left corner (`bounds [24,333][168,477]`).
  - Items can be reordered via drag-and-drop.
  - Tapping `[✓]` commits the pin ordering and visibility to preferences.

---

### Screen 4: Edit Categories / Edit Sections Screen
- **Header**: Large "Library" title on left, blue circular checkmark `[✓]` on right.
- **List items**:
  - Left: Square checkbox (`[✓]` when active, `[ ]` when inactive).
  - Middle: Category icon + label (Playlists, Artists, Albums, Songs, Made For You, Music Videos, Genres, Compilations, Composers, Downloaded, TV & Movies).
  - Right: 4-bar drag handle (`≡≡`) for touch reordering.
- Tapping `[✓]` persists section visibility and custom ordering.

---

### Screen 5: New Playlist Creation Screen
- **Presentation**: Full modal sheet.
- **Header**: Close button `X` on top-left, Checkmark `✓` on top-right.
- **Hero Artwork Picker**:
  - Large rounded square placeholder (dark card background).
  - Circular camera icon in center for selecting custom cover photo.
- **Input Fields**:
  - Centered text input with underline: "Playlist Title" (placeholder).
  - Switch row: "Show on Profile and in Search" with toggle switch.

---

### Screen 6: Playlists Page
- **Header**:
  - Left: Back arrow `<-`.
  - Right: `[+]` New Playlist, `[≡]` Filter By, `[...]` Sort By.
- **Title**: Large "Playlists".
- **Search Bar**: Full-width rounded search pill: `"Search in Playlists"`.
- **List Items**:
  - Row height: ~72dp.
  - Left: Square artwork thumbnail (`56dp x 56dp`, rounded corners).
  - For Folders: Dedicated grey folder icon.
  - Collaborative indicator: Dual-person icon on the right for shared playlists.
  - Folder navigation: Opens child folder view.
- **Filter By Bottom Sheet**:
  - All Playlists `[✓]`
  - Favourites
- **Sort By Bottom Sheet**:
  - Title
  - Recently Added
  - Recently Played
  - Recently Updated
  - Playlist Type `[✓]`

---

### Screen 7: Playlist Details Screen
- **Header & Backdrop**:
  - Dynamic blurred backdrop gradient sampling cover art colors.
  - Top bar: Back arrow `<-`, Collaborators `+`, Share, Overflow `...`.
  - Big headline title + centered title.
  - Audio quality badges: `Dolby Atmos`, `Hi-Res Lossless`.
- **Action Bar**:
  - Circular `⇄` Shuffle button.
  - Large central `▶ Play` pill button (white background, black text/icon).
  - Circular `↓` Download button.
- **Playlist Description**: 13sp grey text.
- **Tracklist**:
  - Track artwork thumbnail, song title, artist subtitle, trailing `⋮` menu.

---

### Screen 8: Artists Page & Artist Details
- **Artists List**:
  - Circular artist avatars (`56dp` diameter).
  - Artist name (single line).
  - A-Z Alphabetical fast scroller on the right edge.
- **Artist Details**:
  - Hero header: Large circular artist photo centered with artist name.
  - Action row: Two side-by-side equal-width pill buttons: `▶ Play` and `⇄ Shuffle`.
  - Content: 2-column album grid (`Album artwork`, `Title`, `Year`).

---

### Screen 9: Albums Page & Album Details
- **Albums List**:
  - 2-column grid of album covers with rounded corners.
  - Header with `▶ Play` and `⇄ Shuffle` pill buttons.
- **Album Details**:
  - Immersive color gradient background matching artwork palette.
  - Large square album cover.
  - Title, Artist, `Genre • Year • Quality` metadata.
  - Track numbers (`1, 2, 3...`) next to song titles.
  - Album footer: Exact release date, song count, total duration, copyright notice.

---

### Screen 10: Songs Page
- **Layout**:
  - Full-width search bar: `"Search in Songs"`.
  - Action row: `▶ Play` and `⇄ Shuffle`.
  - Song list: Square artwork thumbnail, title, artist name, explicit badge `[E]`, trailing `⋮` context menu.
- **Song Context Menu**:
  - Play Next, Play After, Add to Playlist, Download, Favorite, Share, Go to Artist, Go to Album.

---

### Screen 11: Downloaded Music Page
- **Navigation**:
  - Dedicated subcategories: Artists, Albums, Songs, Playlists.
  - Recently Downloaded 2-column album grid.
  - Complete offline accessibility.

---

## 3. Key Design System Principles for Raaga Adaptation
1. **Color Palette**:
   - Background: AMOLED pure black `#000000`.
   - Card surfaces: `#121214` to `#1C1C1E`.
   - Primary Accent: Raaga pink/red (`Color(0xFFE53935)` / theme primary).
   - Text: Primary `#FFFFFF`, Secondary `#8E8E93`.
   - Separators: Subtle 0.5dp `#2C2C2E`.
2. **Typography**:
   - Screen Title: Display Large (32sp Bold).
   - Section Title: Headline Small (20sp Bold).
   - Row Title: Body Large (16sp Medium).
   - Subtitle/Metadata: Body Medium (13-14sp Regular).
3. **Corner Radii**:
   - Cards & Artwork: 12dp to 16dp.
   - Pinned Collection: 16dp.
   - Pill Buttons: 24dp (fully rounded).
   - Circular Badges/Avatars: CircleShape.

