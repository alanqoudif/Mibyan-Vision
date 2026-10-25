import ExpoModulesCore

public class MubayanGlassesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MubayanGlasses")

    Events("onRegistrationChange")

    OnCreate {
      Task { @MainActor [weak self] in
        GlassesCamera.shared.onRegistrationChange = { state in
          self?.sendEvent("onRegistrationChange", ["state": state])
        }
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

    OnDestroy {
      Task { @MainActor in
        GlassesCamera.shared.onRegistrationChange = nil
        GlassesCamera.shared.stop()
      }
    }
  }
}
