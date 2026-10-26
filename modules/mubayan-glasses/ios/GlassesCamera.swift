import ExpoModulesCore
import MWDATCamera
import MWDATCore

final class NotRegisteredException: Exception, @unchecked Sendable {
  override var reason: String { "The app isn't connected to Meta AI yet" }
}

final class CameraPermissionException: Exception, @unchecked Sendable {
  override var reason: String { "Camera access on the glasses hasn't been granted" }
}

final class GlassesUnavailableException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Glasses unavailable: \(param)" }
}

final class CaptureFailedException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Photo capture failed: \(param)" }
}

/// Owns the single `DeviceSession` + camera stream to the glasses. The stream is kept
/// open between captures so follow-up questions don't pay the connection cost again;
/// call `stop()` when the assistant screen closes.
@MainActor
final class GlassesCamera {
  static let shared = GlassesCamera()

  var onRegistrationChange: ((String) -> Void)?

  private var configured = false
  private var session: DeviceSession?
  private var camera: Camera?
  private var sessionState: DeviceSessionState = .idle
  private var streamState: StreamState = .stopped
  private var lastError: String?
  private var photoWaiter: CheckedContinuation<Data, Error>?
  private var photoTimeout: Task<Void, Never>?
  // `ListenerTokenBag.clear()` cancels asynchronously, so a cleared bag can still cancel
  // listeners stored right after it. Each session and stream gets a fresh bag instead.
  private var sessionTokens = ListenerTokenBag()
  private var streamTokens = ListenerTokenBag()
  private var registrationTask: Task<Void, Never>?
  // Created once so it is already tracking the glasses when the first capture comes in.
  private var deviceSelector: AutoDeviceSelector?
  private var activeDevice: DeviceIdentifier?
  private var deviceTask: Task<Void, Never>?

  func configure() {
    guard !configured else { return }
    do {
      try Wearables.configure()
    } catch {
      NSLog("[MubayanGlasses] configure failed: \(error)")
    }
    configured = true
    let selector = AutoDeviceSelector(wearables: Wearables.shared)
    deviceSelector = selector
    deviceTask = Task { [weak self] in
      for await device in selector.activeDeviceStream() {
        self?.activeDevice = device
      }
    }
    registrationTask = Task { [weak self] in
      for await state in Wearables.shared.registrationStateStream() {
        self?.onRegistrationChange?(Self.name(state))
      }
    }
  }

  var registrationState: String {
    configure()
    return Self.name(Wearables.shared.registrationState)
  }

  /// Opens Meta AI so the user can approve this app. Completion arrives through the URL
  /// callback and is reported via `onRegistrationChange`.
  func register() async throws {
    configure()
    try await Wearables.shared.startRegistration()
  }

  /// Opens Meta AI to grant camera access if needed; resolves when the user comes back.
  func requestCameraPermission() async throws -> String {
    configure()
    if try await Wearables.shared.checkPermissionStatus(.camera) == .granted { return "granted" }
    return try await Wearables.shared.requestPermission(.camera) == .granted ? "granted" : "denied"
  }

  func cameraPermission() async throws -> String {
    configure()
    return try await Wearables.shared.checkPermissionStatus(.camera) == .granted ? "granted" : "denied"
  }

  /// Takes a JPEG with the glasses camera and returns its file URL.
  func capturePhoto() async throws -> URL {
    configure()
    guard Wearables.shared.registrationState == .registered else { throw NotRegisteredException() }
    guard try await Wearables.shared.checkPermissionStatus(.camera) == .granted else {
      throw CameraPermissionException()
    }
    try await ensureStreaming()

    let data: Data = try await withCheckedThrowingContinuation { continuation in
      failPhoto("superseded")
      photoWaiter = continuation
      guard camera?.stream.capturePhoto(format: .jpeg) == true else {
        failPhoto("the glasses didn't start the capture")
        return
      }
      photoTimeout = Task { [weak self] in
        try? await Task.sleep(for: .seconds(12))
        guard !Task.isCancelled else { return }
        self?.failPhoto("timed out")
      }
    }

    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent("glasses-\(UUID().uuidString).jpg")
    try data.write(to: url)
    return url
  }

  func stop() {
    camera?.stop()
    session?.stop()
    clearStream()
    resetSessionTokens()
    session = nil
    sessionState = .idle
  }

  // MARK: - Session + stream

  private func ensureStreaming() async throws {
    if session == nil || sessionState == .stopped {
      resetSessionTokens()
      clearStream()
      lastError = nil
      guard let selector = deviceSelector else { throw GlassesUnavailableException("the SDK isn't configured") }
      try await waitForDevice(selector)
      let newSession = try Wearables.shared.createSession(deviceSelector: selector)
      session = newSession
      newSession.statePublisher.listen { [weak self] state in
        Task { @MainActor in self?.sessionStateChanged(state) }
      }.store(in: sessionTokens)
      newSession.errorPublisher.listen { [weak self] error in
        Task { @MainActor in self?.lastError = error.localizedDescription }
      }.store(in: sessionTokens)
      sessionState = .starting
      try newSession.start()
    }
    try await waitUntil("connecting to the glasses", failed: { $0.session == nil }) { $0.sessionState == .started }

    if camera == nil, let session {
      // Low frame rate: we only need stills, and fewer frames leave more Bluetooth
      // bandwidth for image quality.
      let config = StreamConfiguration(videoCodec: .raw, resolution: .high, frameRate: 7)
      guard let newCamera = try session.addCamera(config: config) else {
        throw GlassesUnavailableException("couldn't open the camera")
      }
      camera = newCamera
      let stream = newCamera.stream
      stream.statePublisher.listen { [weak self] state in
        Task { @MainActor in self?.streamStateChanged(state) }
      }.store(in: streamTokens)
      stream.errorPublisher.listen { [weak self] error in
        Task { @MainActor in
          self?.lastError = error.localizedDescription
          self?.failPhoto(error.localizedDescription)
        }
      }.store(in: streamTokens)
      stream.photoDataPublisher.listen { [weak self] photo in
        Task { @MainActor in self?.receivePhoto(photo.data) }
      }.store(in: streamTokens)
      streamState = .starting
      stream.start()
    }
    try await waitUntil("starting the camera", failed: { $0.camera == nil }) { $0.streamState == .streaming }
  }

  /// Fails fast when no glasses are connected (off, folded, or out of range), so callers
  /// fall back to the phone camera instead of waiting out the session timeout.
  private func waitForDevice(_ selector: AutoDeviceSelector) async throws {
    let deadline = Date().addingTimeInterval(5)
    while (activeDevice ?? selector.activeDevice) == nil {
      if Date() > deadline {
        throw GlassesUnavailableException("no glasses connected; check they're on, unfolded and paired in Meta AI")
      }
      try await Task.sleep(for: .milliseconds(100))
    }
  }

  private func waitUntil(
    _ step: String,
    failed: (GlassesCamera) -> Bool,
    _ done: (GlassesCamera) -> Bool
  ) async throws {
    let deadline = Date().addingTimeInterval(15)
    while !done(self) {
      if failed(self) {
        throw GlassesUnavailableException(lastError ?? "\(step) stopped")
      }
      if streamState == .paused {
        throw GlassesUnavailableException("the stream is paused; tap the glasses touchpad to resume")
      }
      if Date() > deadline {
        throw GlassesUnavailableException(lastError ?? "timed out \(step)")
      }
      try await Task.sleep(for: .milliseconds(100))
    }
  }

  private func sessionStateChanged(_ state: DeviceSessionState) {
    sessionState = state
    if state == .stopped {
      clearStream()
      resetSessionTokens()
      session = nil
    }
  }

  private func streamStateChanged(_ state: StreamState) {
    streamState = state
    if state == .stopped { clearStream() }
  }

  private func resetSessionTokens() {
    sessionTokens.clear()
    sessionTokens = ListenerTokenBag()
  }

  private func clearStream() {
    streamTokens.clear()
    streamTokens = ListenerTokenBag()
    camera?.stop()
    camera = nil
    streamState = .stopped
    failPhoto(lastError ?? "the camera stopped")
  }

  private func receivePhoto(_ data: Data) {
    photoTimeout?.cancel()
    photoTimeout = nil
    photoWaiter?.resume(returning: data)
    photoWaiter = nil
  }

  private func failPhoto(_ message: String) {
    photoTimeout?.cancel()
    photoTimeout = nil
    photoWaiter?.resume(throwing: CaptureFailedException(message))
    photoWaiter = nil
  }

  private static func name(_ state: RegistrationState) -> String {
    switch state {
    case .registered: return "registered"
    case .registering: return "registering"
    case .available: return "available"
    case .unavailable: return "unavailable"
    @unknown default: return "unavailable"
    }
  }
}
