import AVFoundation
import CoreML
import UIKit
import Vision

/// A parking-sensor for walking: estimates depth from the glasses video on the phone (Apple's
/// Depth Anything V2 Core ML model, ~30 ms a frame on the Neural Engine) and warns with beeps
/// that speed up as something gets closer, a haptic, and a short spoken direction. iOS's
/// built-in image classifier names what's in the way ("chair ahead, go left"). No network and
/// no language model, so a warning follows within a frame or two.
///
/// The model's depth is relative and normalized per frame (the nearest thing is always ~1), so
/// it can't be read as meters on its own. The floor at the bottom of the view is the ruler:
/// for someone standing it's always about a step and a half ahead, so an obstacle as close as
/// that floor is ~1.5 m away, and closer than it is within reach. Readings are that ratio;
/// the thresholds come from JS so they can be tuned without a rebuild.
@MainActor
final class ObstacleSensor {
  static let shared = ObstacleSensor()

  struct Options {
    /// Closeness relative to the floor for near, close and very close, ascending.
    let levels: [Float]
    let lang: String
  }

  /// Readings for the UI and for tuning: `level` 0–3, `side` of the nearest obstacle, and
  /// the raw left/center/right values.
  var onReading: (([String: Any]) -> Void)?

  private(set) var enabled = false
  private var options = Options(levels: [1.3, 1.6, 2], lang: "ar")
  private let worker = DepthWorker()

  // Smoothed left / center / right closeness.
  private var smoothed: [Float] = [0, 0, 0]
  private var level = 0
  private var side = 1
  private var lastReadingSent = Date.distantPast

  private var beepTimer: Timer?
  private var lastBeep = Date.distantPast
  private var beeper: AVAudioPlayer?
  private let haptic = UIImpactFeedbackGenerator(style: .heavy)
  private let speech = AVSpeechSynthesizer()
  private var lastSpoken = Date.distantPast
  private var spokenLevel = 0
  // A rise is acted on only after two readings in a row, so one odd frame doesn't beep.
  private var pendingLevel = 0
  private var pendingCount = 0
  private var inPassage = false
  private var lastPassageSpoken = Date.distantPast
  // What's in the path ahead: a label counts once it's seen in 2 of the last 3 frames.
  private var recentLabels: [String?] = []
  private var label: String?
  private var lastStairsSpoken = Date.distantPast

  func start(_ options: Options) {
    self.options = options
    enabled = true
    smoothed = [0, 0, 0]
    level = 0
    worker.load()
    worker.setActive(true)
    beeper = Self.makeBeep()
    haptic.prepare()
    beepTimer?.invalidate()
    beepTimer = Timer.scheduledTimer(withTimeInterval: 0.04, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated { self?.beepIfDue() }
    }
  }

  func stop() {
    enabled = false
    worker.setActive(false)
    beepTimer?.invalidate()
    beepTimer = nil
    beeper?.stop()
    speech.stopSpeaking(at: .immediate)
    level = 0
  }

  /// A decoded glasses frame. Called for every frame; the worker drops frames while busy.
  nonisolated func offer(_ image: CGImage) {
    worker.estimate(image) { [weak self] look in
      Task { @MainActor in self?.update(look) }
    }
  }

  // MARK: - Readings

  private func update(_ look: Look) {
    guard enabled else { return }
    recentLabels = (recentLabels + [look.label]).suffix(3)
    label = recentLabels.compactMap { $0 }.first { l in recentLabels.filter { $0 == l }.count >= 2 }
    // Stairs and escalators don't look close to a depth sensor, so they're called out by name.
    if let label, label == "stairs" || label == "escalator", Date().timeIntervalSince(lastStairsSpoken) > 8 {
      lastStairsSpoken = Date()
      say(options.lang != "en" ? "انتبه، \(Self.name(label, ar: true)) قدامك" : "Careful, \(Self.name(label, ar: false)) ahead")
    }

    let regions = look.regions
    // All zeros: the floor wasn't a usable ruler (looking up, or blocked). Keep what we had.
    guard regions.count == 3, regions.contains(where: { $0 > 0 }) else { return }
    for i in 0..<3 { smoothed[i] = smoothed[i] * 0.4 + regions[i] * 0.6 }
    let levels = options.levels
    func levelOf(_ v: Float) -> Int { levels.lastIndex(where: { v >= $0 }).map { $0 + 1 } ?? 0 }
    let left = levelOf(smoothed[0]), center = levelOf(smoothed[1]), right = levelOf(smoothed[2])

    // A doorway or corridor: both sides close and the way ahead open. That's walking right.
    let passage = center == 0 && left >= 2 && right >= 2
    if passage && !inPassage { speakPassage() }
    inPassage = passage

    // Only the path ahead beeps. Something beside them gets a soft beep only when it's
    // about to touch, and not in a doorway.
    var raw = center
    side = 1
    if raw == 0 && !passage && max(left, right) == 3 {
      raw = 1
      side = left > right ? 0 : 2
    }
    if raw > level {
      if raw == pendingLevel { pendingCount += 1 } else { pendingLevel = raw; pendingCount = 1 }
      if pendingCount >= 2 { level = raw }
    } else {
      level = raw
      pendingLevel = raw
      pendingCount = 0
    }

    if level >= 2 && side == 1 { speakDirection(left: left, right: right) } else if level == 0 { spokenLevel = 0 }

    if Date().timeIntervalSince(lastReadingSent) > 0.25 {
      lastReadingSent = Date()
      onReading?([
        "level": level,
        "side": ["left", "center", "right"][side],
        "label": label.map { Self.name($0, ar: options.lang != "en") } ?? "",
        "values": smoothed.map { Double($0) },
      ])
    }
  }

  // MARK: - Beeps and haptics

  private func beepIfDue() {
    guard enabled, level > 0, let beeper else { return }
    let interval: TimeInterval = [0, 0.7, 0.35, 0.12][level]
    guard Date().timeIntervalSince(lastBeep) >= interval else { return }
    lastBeep = Date()
    // Panned toward the obstacle, so the ears hear where it is.
    beeper.pan = [-0.8, 0, 0.8][side]
    beeper.rate = [1, 1, 1.25, 1.5][level]
    beeper.currentTime = 0
    beeper.play()
    if level == 3 { haptic.impactOccurred() }
  }

  /// A short spoken hint when something ahead gets close: which way is clear, or stop.
  private func speakDirection(left: Int, right: Int) {
    let now = Date()
    // Speak when it gets worse; while it stays very close, remind now and then.
    guard level > spokenLevel || (level == 3 && now.timeIntervalSince(lastSpoken) > 6) else { return }
    lastSpoken = now
    spokenLevel = level
    let ar = options.lang != "en"
    // Named when the classifier knows what it is ("chair ahead"), else "something".
    let thing = label.map { Self.name($0, ar: ar) } ?? (ar ? "شي" : "something")
    let text: String
    if left < right && left <= 1 {
      text = ar ? "\(thing) قدامك، روح يسار" : "\(thing.capitalized) ahead, go left"
    } else if right < left && right <= 1 {
      text = ar ? "\(thing) قدامك، روح يمين" : "\(thing.capitalized) ahead, go right"
    } else {
      text = ar ? "وقف، \(thing) قدامك" : "Stop, \(thing) ahead"
    }
    say(text)
  }

  /// Spoken names for the classifier labels the worker looks for.
  nonisolated static let names: [String: (ar: String, en: String)] = [
    "door": ("باب", "door"), "stairs": ("درج", "stairs"), "escalator": ("درج متحرك", "escalator"),
    "elevator": ("مصعد", "elevator"), "chair": ("كرسي", "chair"), "table": ("طاولة", "table"),
    "desk": ("مكتب", "desk"), "sofa": ("كنبة", "sofa"), "bed": ("سرير", "bed"),
    "cabinet": ("خزانة", "cabinet"), "refrigerator": ("ثلاجة", "fridge"), "car": ("سيارة", "car"),
    "vehicle": ("سيارة", "vehicle"), "bus": ("باص", "bus"), "truck": ("شاحنة", "truck"),
    "motorcycle": ("دراجة نارية", "motorbike"), "bicycle": ("دراجة", "bicycle"), "people": ("ناس", "people"),
    "adult": ("شخص", "person"), "crowd": ("زحمة ناس", "crowd"), "dog": ("كلب", "dog"),
    "pole": ("عمود", "pole"), "lamppost": ("عمود إنارة", "lamppost"), "tree": ("شجرة", "tree"),
    "plant": ("زرع", "plant"), "bench": ("مقعد", "bench"), "fence": ("سور", "fence"),
    "trash_can": ("سلة زبالة", "bin"), "stroller": ("عربية طفل", "stroller"), "cart": ("عربة", "cart"),
    "traffic_light": ("إشارة مرور", "traffic light"), "street_sign": ("لوحة", "sign"), "window": ("شباك", "window"),
  ]

  nonisolated static func name(_ label: String, ar: Bool) -> String {
    guard let n = names[label] else { return label }
    return ar ? n.ar : n.en
  }

  private func speakPassage() {
    guard Date().timeIntervalSince(lastPassageSpoken) > 8 else { return }
    lastPassageSpoken = Date()
    say(options.lang != "en" ? "باب قدامك، امش سيدة" : "Doorway ahead, walk straight")
  }

  private func say(_ text: String) {
    let ar = options.lang != "en"
    speech.stopSpeaking(at: .immediate)
    let utterance = AVSpeechUtterance(string: text)
    utterance.voice = Self.bestVoice(ar ? "ar" : "en")
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 1.15
    speech.speak(utterance)
  }

  private static func bestVoice(_ lang: String) -> AVSpeechSynthesisVoice? {
    let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix(lang) }
    return voices.max { $0.quality.rawValue < $1.quality.rawValue } ?? AVSpeechSynthesisVoice(language: lang)
  }

  /// A 70 ms, 1.1 kHz tone with soft edges, as a WAV in memory.
  private static func makeBeep() -> AVAudioPlayer? {
    let rate = 44_100, count = rate * 70 / 1000
    var samples = [Int16](repeating: 0, count: count)
    for i in 0..<count {
      let edge = min(1, Double(min(i, count - i)) / 200)
      samples[i] = Int16(sin(2 * .pi * 1100 * Double(i) / Double(rate)) * 0.6 * edge * 32_767)
    }
    var wav = Data()
    func add<T>(_ value: T) { withUnsafeBytes(of: value) { wav.append(contentsOf: $0) } }
    let bytes = UInt32(count * 2)
    wav.append(contentsOf: "RIFF".utf8); add(UInt32(36 + bytes).littleEndian)
    wav.append(contentsOf: "WAVEfmt ".utf8); add(UInt32(16).littleEndian); add(UInt16(1).littleEndian)
    add(UInt16(1).littleEndian); add(UInt32(rate).littleEndian); add(UInt32(rate * 2).littleEndian)
    add(UInt16(2).littleEndian); add(UInt16(16).littleEndian)
    wav.append(contentsOf: "data".utf8); add(bytes.littleEndian)
    samples.withUnsafeBytes { wav.append(contentsOf: $0) }
    let player = try? AVAudioPlayer(data: wav)
    player?.enableRate = true
    player?.prepareToPlay()
    return player
  }
}

/// One analyzed frame: closeness of the left / center / right of the way ahead, and what the
/// classifier sees in the middle of it, if it's something worth naming.
struct Look: Sendable {
  let regions: [Float]
  let label: String?
}

/// Runs the depth model and the classifier off the main thread, one frame at a time.
private final class DepthWorker: @unchecked Sendable {
  private let queue = DispatchQueue(label: "mubayan.obstacles", qos: .userInitiated)
  private var request: VNCoreMLRequest?
  private let classify: VNClassifyImageRequest = {
    let request = VNClassifyImageRequest()
    // The middle of the view ahead, where whatever they'd walk into is.
    request.regionOfInterest = CGRect(x: 0.2, y: 0.3, width: 0.6, height: 0.5)
    return request
  }()
  private var busy = false
  private var active = false
  private let lock = NSLock()

  func setActive(_ on: Bool) {
    lock.lock()
    active = on
    lock.unlock()
  }

  func load() {
    queue.async { [self] in
      guard request == nil,
        let url = Bundle.main.url(forResource: "DepthAnythingV2SmallF16P8", withExtension: "mlmodelc")
      else { return }
      do {
        let config = MLModelConfiguration()
        config.computeUnits = .all
        let model = try VNCoreMLModel(for: MLModel(contentsOf: url, configuration: config))
        let request = VNCoreMLRequest(model: model)
        request.imageCropAndScaleOption = .scaleFill
        // From body height ahead down to the floor in front of the feet, skipping the sky or
        // ceiling at the top. Vision's origin is bottom-left.
        request.regionOfInterest = CGRect(x: 0, y: 0.05, width: 1, height: 0.65)
        self.request = request
      } catch {
        NSLog("[MubayanObstacles] model failed to load: \(error)")
      }
    }
  }

  func estimate(_ image: CGImage, done: @escaping @Sendable (Look) -> Void) {
    lock.lock()
    if busy || !active {
      lock.unlock()
      return
    }
    busy = true
    lock.unlock()
    queue.async { [self] in
      defer {
        lock.lock()
        busy = false
        lock.unlock()
      }
      guard let request else { return }
      do {
        try VNImageRequestHandler(cgImage: image).perform([request, classify])
        guard let depth = (request.results?.first as? VNPixelBufferObservation)?.pixelBuffer else { return }
        let label = classify.results?
          .first { ObstacleSensor.names[$0.identifier] != nil && $0.confidence >= 0.3 }?
          .identifier
        done(Look(regions: Self.regions(depth), label: label))
      } catch {
        NSLog("[MubayanObstacles] depth failed: \(error)")
      }
    }
  }

  /// Closeness of the left, center and right thirds of the band ahead (top 55% of the crop,
  /// 90th percentile) relative to the floor in front of the feet (bottom 12%, center, median).
  /// Zeros when the floor isn't a usable ruler (looking up, or nothing below).
  private static func regions(_ buffer: CVPixelBuffer) -> [Float] {
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else { return [0, 0, 0] }
    let width = CVPixelBufferGetWidth(buffer), height = CVPixelBufferGetHeight(buffer)
    let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
    var columns: [[Float]] = [[], [], []]
    var floor: [Float] = []
    let bandEnd = height * 55 / 100, floorStart = height * 88 / 100
    for y in stride(from: 0, to: height, by: 4) where y < bandEnd || y >= floorStart {
      let row = (base + y * rowBytes).assumingMemoryBound(to: Float16.self)
      for x in stride(from: 0, to: width, by: 4) {
        if y < bandEnd {
          columns[min(2, x * 3 / width)].append(Float(row[x]))
        } else if x > width / 3 && x < width * 2 / 3 {
          floor.append(Float(row[x]))
        }
      }
    }
    let ruler = percentile(floor, 0.5)
    guard ruler > 0.3 else { return [0, 0, 0] }
    return columns.map { percentile($0, 0.9) / ruler }
  }

  private static func percentile(_ values: [Float], _ p: Double) -> Float {
    guard !values.isEmpty else { return 0 }
    let sorted = values.sorted()
    return sorted[Int(Double(sorted.count - 1) * p)]
  }
}
