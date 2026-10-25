import ExpoModulesCore

/// Set by the App Intents in the app target (plugins/with-shortcuts.js) when Siri, the
/// Shortcuts app or the Action button opens a screen.
private let pendingShortcutKey = "mubayan.pendingShortcut"
private let shortcutNotification = Notification.Name("MubayanShortcut")

public class MubayanGlassesModule: Module {
  private var shortcutObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("MubayanGlasses")

    Events("onRegistrationChange", "onShortcut")

    OnCreate {
      Task { @MainActor [weak self] in
        GlassesCamera.shared.onRegistrationChange = { state in
          self?.sendEvent("onRegistrationChange", ["state": state])
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

    AsyncFunction("getCameraPermission") { () async throws -> String in
      try await GlassesCamera.shared.cameraPermission()
    }

    AsyncFunction("requestCameraPermission") { () async throws -> String in
      try await GlassesCamera.shared.requestCameraPermission()
    }

    AsyncFunction("capturePhoto") { () async throws -> String in
      try await GlassesCamera.shared.capturePhoto().absoluteString
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
      }
    }
  }
}
