import SwiftUI
import WebKit

/// Official YouTube IFrame Player wrapper view using WKWebView.
/// Strictly compliant with YouTube API Terms of Service & project rules.
struct YouTubePlayerView: UIViewRepresentable {
    @ObservedObject var playerManager: AudioPlayerManager

    func makeCoordinator() -> Coordinator {
        Coordinator(playerManager: playerManager)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        // Set up JavaScript bridge handler
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "playerBridge")
        configuration.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false

        context.coordinator.webView = webView

        // Wire up outbound player commands
        playerManager.onCommand = { [weak context] command in
            guard let coord = context?.coordinator else { return }
            coord.handleCommand(command)
        }

        // Load the official IFrame player template
        let html = playerHTML(videoId: playerManager.currentVideoId ?? "")
        webView.loadHTMLString(html, baseURL: URL(string: "https://www.youtube.com"))

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // State updates are handled via playerManager.onCommand closure
    }

    // MARK: - HTML Template

    private func playerHTML(videoId: String) -> String {
        """
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              background-color: #000000;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            #player {
              width: 100vw;
              height: 100vh;
              border: 0;
            }
          </style>
        </head>
        <body>
          <div id="player"></div>
          <script src="https://www.youtube.com/iframe_api"></script>
          <script>
            var player;
            var isReady = false;

            function onYouTubeIframeAPIReady() {
              player = new YT.Player('player', {
                videoId: '\(videoId)',
                playerVars: {
                  'autoplay': 1,
                  'playsinline': 1,
                  'controls': 1,
                  'rel': 0,
                  'modestbranding': 1,
                  'iv_load_policy': 3,
                  'fs': 0,
                  'disablekb': 1,
                  'origin': 'https://www.youtube.com'
                },
                events: {
                  'onReady': onPlayerReady,
                  'onStateChange': onPlayerStateChange,
                  'onError': onPlayerError
                }
              });
            }

            function onPlayerReady(event) {
              isReady = true;
              window.webkit.messageHandlers.playerBridge.postMessage({ type: 'ready' });
              startProgressLoop();
              event.target.playVideo();
            }

            function onPlayerStateChange(event) {
              window.webkit.messageHandlers.playerBridge.postMessage({
                type: 'state',
                state: event.data
              });
            }

            function onPlayerError(event) {
              window.webkit.messageHandlers.playerBridge.postMessage({
                type: 'error',
                code: event.data
              });
            }

            var progressInterval = null;
            function startProgressLoop() {
              if (progressInterval) clearInterval(progressInterval);
              progressInterval = setInterval(function() {
                if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
                  var cur = player.getCurrentTime() || 0;
                  var dur = player.getDuration() || 0;
                  window.webkit.messageHandlers.playerBridge.postMessage({
                    type: 'progress',
                    currentTime: cur,
                    duration: dur
                  });
                }
              }, 400);
            }

            function loadVideo(id) {
              if (player && typeof player.loadVideoById === 'function') {
                player.loadVideoById(id);
              }
            }

            function playVideo() {
              if (player && typeof player.playVideo === 'function') {
                player.playVideo();
              }
            }

            function pauseVideo() {
              if (player && typeof player.pauseVideo === 'function') {
                player.pauseVideo();
              }
            }

            function seekTo(sec) {
              if (player && typeof player.seekTo === 'function') {
                player.seekTo(sec, true);
              }
            }
          </script>
        </body>
        </html>
        """
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKScriptMessageHandler {
        private let playerManager: AudioPlayerManager
        weak var webView: WKWebView?

        init(playerManager: AudioPlayerManager) {
            self.playerManager = playerManager
        }

        func handleCommand(_ command: AudioPlayerManager.PlayerCommand) {
            DispatchQueue.main.async { [weak self] in
                guard let webView = self?.webView else { return }
                switch command {
                case .load(let videoId):
                    webView.evaluateJavaScript("loadVideo('\(videoId)')", completionHandler: nil)
                case .play:
                    webView.evaluateJavaScript("playVideo()", completionHandler: nil)
                case .pause:
                    webView.evaluateJavaScript("pauseVideo()", completionHandler: nil)
                case .seek(let seconds):
                    webView.evaluateJavaScript("seekTo(\(seconds))", completionHandler: nil)
                }
            }
        }

        // WKScriptMessageHandler
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let dict = message.body as? [String: Any],
                  let type = dict["type"] as? String else { return }

            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                switch type {
                case "ready":
                    self.playerManager.handlePlayerReady()
                case "state":
                    if let state = dict["state"] as? Int {
                        self.playerManager.handlePlayerStateChange(state)
                    }
                case "progress":
                    let cur = dict["currentTime"] as? Double ?? 0
                    let dur = dict["duration"] as? Double ?? 0
                    self.playerManager.handlePlayerProgress(currentTime: cur, duration: dur)
                case "error":
                    let code = dict["code"] as? Int ?? -1
                    self.playerManager.handlePlayerError(code: code)
                default:
                    break
                }
            }
        }
    }
}
