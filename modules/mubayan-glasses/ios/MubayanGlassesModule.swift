import ExpoModulesCore

/// Set by the App Intents in the app target (plugins/with-shortcuts.js) when Siri, the
/// Shortcuts app or the Action button opens a screen.
private let pendingShortcutKey = "mubayan.pendingShortcut"
private let shortcutNotification = Notification.Name("MubayanShortcut")

public class MubayanGlassesModule: Module {
  private var shortcutObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("MubayanGlasses")

    Events("onRegistrationChange", "onShortcut", "onLiveEvent", "onObstacle")

    OnCreate {
      Task { @MainActor [weak self] in
        GlassesCamera.shared.onRegistrationChange = { state in
          self?.sendEvent("onRegistrationChange", ["state": state])
        }
        LiveSession.shared.onEvent = { event in
          self?.sendEvent("onLiveEvent", event)
        }
        ObstacleSensor.shared.onReading = { reading in
          self?.sendEvent("onObstacle", reading)
        }
      }
      self.shortcutObserver = NotificationCenter.default.addObserver(
        forName: shortcutNotification, object: nil, queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onShortcut", [:])
      }
    }

    AsyncFunction("getRegistrationState") { () async -> String in
      await GlassesCamera.shared.registrationState
    }

    AsyncFunction("register") { () async throws in
      try await GlassesCamera.shared.register()
    }

    AsyncFunction("needsAppUpdate") { () async -> Bool in
      await GlassesCamera.shared.needsAppUpdate
    }

    AsyncFunction("openAppUpdate") { () async throws in
      try await GlassesCamera.shared.openAppUpdate()
    }

    AsyncFunction("getCameraPermission") { () async throws -> String in
      try await GlassesCamera.shared.cameraPermission()
    }

    AsyncFunction("requestCameraPermission") { () async throws -> String in
      try await GlassesCamera.shared.requestCameraPermission()
    }

    AsyncFunction("capturePhoto") { () async throws -> String in
      try await GlassesCamera.shared.capturePhoto().absoluteString
    }

    AsyncFunction("captureFrame") { () async throws -> String in
      try await GlassesCamera.shared.captureFrame().absoluteString
    }

    View(GlassesPreviewView.self) {}

    AsyncFunction("liveStart") { (endpoint: String, apiKey: String, lang: String, directions: String) async throws in
      guard let url = URL(string: endpoint) else { throw LiveError("bad endpoint") }
      try await LiveSession.shared.start(.init(endpoint: url, apiKey: apiKey, lang: lang, directions: directions))
    }

    AsyncFunction("obstacleStart") { (levels: [Double], lang: String) async in
      await ObstacleSensor.shared.start(.init(levels: levels.map { Float($0) }, lang: lang))
    }

    AsyncFunction("obstacleStop") { () async in
      await ObstacleSensor.shared.stop()
    }

    AsyncFunction("liveSay") { (text: String) async in
      await LiveSession.shared.say(text)
    }

    AsyncFunction("liveStop") { () async in
      await LiveSession.shared.stop()
    }

    AsyncFunction("livePause") { (paused: Bool) async in
      await LiveSession.shared.setPaused(paused)
    }

    AsyncFunction("liveSendFrame") { (base64: String) async in
      await LiveSession.shared.sendPhoneFrame(base64)
    }

    AsyncFunction("stop") { () async in
      await GlassesCamera.shared.stop()
    }

    AsyncFunction("recognizeText") { (uri: String, languages: [String]) async throws -> String in
      try await TextReader.read(uri, languages: languages)
    }

    /// The route a shortcut asked for, once: reading it clears it.
    Function("takePendingShortcut") { () -> String? in
      let defaults = UserDefaults.standard
      let route = defaults.string(forKey: pendingShortcutKey)
      defaults.removeObject(forKey: pendingShortcutKey)
      return route
    }

    OnDestroy {
      if let observer = self.shortcutObserver { NotificationCenter.default.removeObserver(observer) }
      Task { @MainActor in
        GlassesCamera.shared.onRegistrationChange = nil
        GlassesCamera.shared.stop()
        LiveSession.shared.onEvent = nil
        LiveSession.shared.stop()
        ObstacleSensor.shared.onReading = nil
        ObstacleSensor.shared.stop()
      }
    }
  }
}
