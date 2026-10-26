import AVFoundation
import UIKit

/// Realtime live mode on the Gemini Live API: streams the mic (16 kHz PCM) and one camera
/// frame a second to Gemini over a WebSocket and plays its spoken answers (24 kHz PCM) as they
/// arrive. The token and the session setup come from the `mata-live` edge function; a new
/// token is fetched whenever the connection has to be reopened (Google closes each
/// connection after ~10 minutes and the session resumes on the next one).
@MainActor
final class LiveSession {
  static let shared = LiveSession()

  /// `state` (connecting / live / reconnecting / stopped), `user` and `model` (what was
  /// said), `speaking` (the model's voice started or stopped) and `error`.
  var onEvent: (([String: Any]) -> Void)?

  struct Config {
    let endpoint: URL
    let apiKey: String
    let lang: String
    let directions: String
  }

  private var config: Config?
  private var running = false
  private var paused = false
  private var socket: URLSessionWebSocketTask?
  private var connection = 0
  private var resumeHandle: String?
  private var sayPrefix = ""
  private var retries = 0

  private let engine = AVAudioEngine()
  private let player = AVAudioPlayerNode()
  private let playFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 24_000, channels: 1, interleaved: false)!
  private let micFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: true)!
  private var micBuffer = Data()

  private var queuedBuffers = 0
  private var turnDone = false
  private var modelSpeaking = false
  private var modelText = ""
  private var userText = ""

  private var phoneFrame: (data: Data, at: Date)?
  private var ticker: Timer?

  // MARK: - Control

  func start(_ config: Config) async throws {
    stop()
    self.config = config
    running = true
    paused = false
    resumeHandle = nil
    retries = 0
    try startAudio()
    // Opens the glasses camera stream if the glasses are there; the phone camera covers the rest.
    Task { _ = try? await GlassesCamera.shared.captureFrame() }
    ticker = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated { self?.tick() }
    }
    await connect()
  }

  func stop() {
    let wasRunning = running
    running = false
    ticker?.invalidate()
    ticker = nil
    connection += 1
    socket?.cancel(with: .normalClosure, reason: nil)
    socket = nil
    stopAudio()
    phoneFrame = nil
    modelSpeaking = false
    if wasRunning { emit(["type": "state", "state": "stopped"]) }
  }

  func setPaused(_ paused: Bool) {
    self.paused = paused
    if paused { interruptPlayback() }
  }

  /// Has Gemini say an alert (spotted by the app) in its voice, word for word.
  func say(_ text: String) {
    guard running, !paused, let socket else { return }
    send(["realtimeInput": ["text": sayPrefix + text]], on: socket)
  }

  /// A phone-camera frame (base64 JPEG), used when the glasses aren't sending video.
  func sendPhoneFrame(_ base64: String) {
    guard let data = Data(base64Encoded: base64) else { return }
    phoneFrame = (data, Date())
  }

  // MARK: - Connection

  private struct Session {
    let url: URL
    let setup: [String: Any]
    let say: String
  }

  private func connect() async {
    guard running, let config else { return }
    connection += 1
    let mine = connection
    emit(["type": "state", "state": retries == 0 && resumeHandle == nil ? "connecting" : "reconnecting"])
    do {
      let session = try await fetchSession(config)
      guard running, mine == connection else { return }
      sayPrefix = session.say
      var setup = session.setup
      if let resumeHandle { setup["sessionResumption"] = ["handle": resumeHandle] }
      let task = URLSession.shared.webSocketTask(with: session.url)
      task.maximumMessageSize = 16 * 1024 * 1024
      socket = task
      task.resume()
      try await task.send(.string(Self.json(["setup": setup])))
      receive(task, connection: mine)
    } catch {
      guard running, mine == connection else { return }
      reconnectLater(error.localizedDescription)
    }
  }

  private func fetchSession(_ config: Config) async throws -> Session {
    var request = URLRequest(url: config.endpoint)
    request.httpMethod = "POST"
    request.setValue("Bearer \(config.apiKey)", forHTTPHeaderField: "Authorization")
    request.setValue(config.apiKey, forHTTPHeaderField: "apikey")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = Self.json(["lang": config.lang, "directions": config.directions]).data(using: .utf8)
    let (data, response) = try await URLSession.shared.data(for: request)
    let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    guard (response as? HTTPURLResponse)?.statusCode == 200,
      let urlString = body["url"] as? String, let url = URL(string: urlString),
      let setup = body["setup"] as? [String: Any]
    else {
      throw LiveError(body["error"] as? String ?? "couldn't start the live session")
    }
    return Session(url: url, setup: setup, say: body["say"] as? String ?? "")
  }

  private func receive(_ task: URLSessionWebSocketTask, connection mine: Int) {
    Task { [weak self] in
      while true {
        let message: URLSessionWebSocketTask.Message
        do {
          message = try await task.receive()
        } catch {
          guard let self, self.running, mine == self.connection else { return }
          self.reconnectLater(task.closeReason.flatMap { String(data: $0, encoding: .utf8) } ?? error.localizedDescription)
          return
        }
        guard let self, self.running, mine == self.connection else { return }
        let data: Data?
        switch message {
        case .string(let text): data = text.data(using: .utf8)
        case .data(let bytes): data = bytes
        @unknown default: data = nil
        }
        if let data, let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
          self.handle(object)
        }
      }
    }
  }

  private func reconnectLater(_ reason: String) {
    socket = nil
    retries += 1
    if retries > 5 {
      emit(["type": "error", "message": reason])
      stop()
      return
    }
    NSLog("[MubayanLive] reconnecting (\(retries)): \(reason)")
    let delay = min(Double(retries) * 0.7, 3)
    Task { [weak self] in
      try? await Task.sleep(for: .seconds(delay))
      await self?.connect()
    }
  }

  private func handle(_ message: [String: Any]) {
    if message["setupComplete"] != nil {
      retries = 0
      emit(["type": "state", "state": "live"])
      return
    }
    if let update = message["sessionResumptionUpdate"] as? [String: Any],
      update["resumable"] as? Bool == true, let handle = update["newHandle"] as? String, !handle.isEmpty
    {
      resumeHandle = handle
    }
    if message["goAway"] != nil {
      // The connection is about to close: move to a new one now, resuming the session.
      socket?.cancel(with: .normalClosure, reason: nil)
      socket = nil
      Task { await connect() }
      return
    }
    guard let content = message["serverContent"] as? [String: Any] else { return }

    if let input = (content["inputTranscription"] as? [String: Any])?["text"] as? String, !input.isEmpty {
      userText += input
    }
    if content["interrupted"] as? Bool == true {
      interruptPlayback()
      flushModelText()
    }
    if let output = (content["outputTranscription"] as? [String: Any])?["text"] as? String {
      modelText += output
    }
    if let parts = (content["modelTurn"] as? [String: Any])?["parts"] as? [[String: Any]] {
      for part in parts {
        if let inline = part["inlineData"] as? [String: Any], let b64 = inline["data"] as? String,
          let pcm = Data(base64Encoded: b64)
        {
          play(pcm)
        }
      }
    }
    if content["turnComplete"] as? Bool == true {
      turnDone = true
      flushUserText()
      flushModelText()
      if queuedBuffers == 0 { setSpeaking(false) }
    }
  }

  private func flushUserText() {
    let text = userText.trimmingCharacters(in: .whitespacesAndNewlines)
    userText = ""
    if !text.isEmpty { emit(["type": "user", "text": text]) }
  }

  private func flushModelText() {
    let text = modelText.trimmingCharacters(in: .whitespacesAndNewlines)
    modelText = ""
    if !text.isEmpty { emit(["type": "model", "text": text]) }
  }

  // MARK: - A frame every second

  private func tick() {
    guard running, !paused, let socket else { return }
    if let frame = GlassesCamera.shared.freshFrame(maxAge: 1.5)?.jpegData(compressionQuality: 0.6) {
      send(["realtimeInput": ["video": ["data": frame.base64EncodedString(), "mimeType": "image/jpeg"]]], on: socket)
    } else if let phoneFrame, Date().timeIntervalSince(phoneFrame.at) < 2 {
      send(["realtimeInput": ["video": ["data": phoneFrame.data.base64EncodedString(), "mimeType": "image/jpeg"]]], on: socket)
    }
  }

  private func send(_ object: [String: Any], on task: URLSessionWebSocketTask) {
    task.send(.string(Self.json(object))) { error in
      if let error { NSLog("[MubayanLive] send failed: \(error.localizedDescription)") }
    }
  }

  // MARK: - Audio

  private func startAudio() throws {
    let audio = AVAudioSession.sharedInstance()
    // voiceChat turns on echo cancellation, so the mic doesn't hear our own voice; Bluetooth
    // HFP routes both the mic and the voice through the glasses when they're connected.
    try audio.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
    try audio.setActive(true)

    let input = engine.inputNode
    try input.setVoiceProcessingEnabled(true)
    let inputFormat = input.outputFormat(forBus: 0)
    guard let converter = AVAudioConverter(from: inputFormat, to: micFormat) else {
      throw LiveError("unsupported microphone format")
    }
    micBuffer = Data()
    input.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { [weak self] buffer, _ in
      guard let pcm = Self.convertMic(buffer, with: converter) else { return }
      Task { @MainActor in self?.queueMic(pcm) }
    }

    engine.attach(player)
    engine.connect(player, to: engine.mainMixerNode, format: playFormat)
    engine.prepare()
    try engine.start()
    player.play()
  }

  private func stopAudio() {
    engine.inputNode.removeTap(onBus: 0)
    player.stop()
    engine.stop()
    if engine.attachedNodes.contains(player) { engine.detach(player) }
    queuedBuffers = 0
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  /// Runs on the audio thread: resamples a mic buffer to 16 kHz mono Int16.
  nonisolated private static func convertMic(_ buffer: AVAudioPCMBuffer, with converter: AVAudioConverter) -> Data? {
    let ratio = 16_000 / buffer.format.sampleRate
    let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 32
    guard let out = AVAudioPCMBuffer(pcmFormat: converter.outputFormat, frameCapacity: capacity) else { return nil }
    nonisolated(unsafe) var fed = false
    var error: NSError?
    converter.convert(to: out, error: &error) { _, status in
      if fed {
        status.pointee = .noDataNow
        return nil
      }
      fed = true
      status.pointee = .haveData
      return buffer
    }
    guard error == nil, out.frameLength > 0, let samples = out.int16ChannelData else { return nil }
    return Data(bytes: samples[0], count: Int(out.frameLength) * 2)
  }

  private func queueMic(_ pcm: Data) {
    guard running, !paused, let socket else { return }
    micBuffer.append(pcm)
    // ~100 ms per message.
    guard micBuffer.count >= 3200 else { return }
    let chunk = micBuffer
    micBuffer = Data()
    send(["realtimeInput": ["audio": ["data": chunk.base64EncodedString(), "mimeType": "audio/pcm;rate=16000"]]], on: socket)
  }

  private func play(_ pcm: Data) {
    guard !paused else { return }
    let count = pcm.count / 2
    guard count > 0, let buffer = AVAudioPCMBuffer(pcmFormat: playFormat, frameCapacity: AVAudioFrameCount(count)),
      let channel = buffer.floatChannelData?[0]
    else { return }
    buffer.frameLength = AVAudioFrameCount(count)
    pcm.withUnsafeBytes { raw in
      let samples = raw.bindMemory(to: Int16.self)
      for i in 0..<count { channel[i] = Float(Int16(littleEndian: samples[i])) / 32_768 }
    }
    if queuedBuffers == 0 {
      turnDone = false
      setSpeaking(true)
    }
    queuedBuffers += 1
    let generation = connection
    player.scheduleBuffer(buffer) { [weak self] in
      Task { @MainActor in
        guard let self, generation == self.connection else { return }
        self.queuedBuffers = max(0, self.queuedBuffers - 1)
        if self.queuedBuffers == 0 && self.turnDone { self.setSpeaking(false) }
      }
    }
    if !player.isPlaying { player.play() }
  }

  /// The user started talking (or paused): cut the voice off at once.
  private func interruptPlayback() {
    player.stop()
    queuedBuffers = 0
    if running { player.play() }
    setSpeaking(false)
  }

  private func setSpeaking(_ speaking: Bool) {
    guard speaking != modelSpeaking else { return }
    modelSpeaking = speaking
    emit(["type": "speaking", "speaking": speaking])
  }

  // MARK: - Helpers

  private func emit(_ event: [String: Any]) {
    onEvent?(event)
  }

  private static func json(_ object: [String: Any]) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: object) else { return "{}" }
    return String(decoding: data, as: UTF8.self)
  }
}

struct LiveError: LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}
