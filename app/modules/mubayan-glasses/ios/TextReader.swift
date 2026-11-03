import ExpoModulesCore
import Foundation
import Vision

final class TextReadFailedException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Text recognition failed: \(param)" }
}

/// On-device text recognition (Apple Vision), used when the assistant can't be reached.
/// Lines come back top to bottom, joined with newlines; an empty string means no text.
enum TextReader {
  static func read(_ uri: String, languages: [String]) async throws -> String {
    guard let url = URL(string: uri) else { throw TextReadFailedException("bad uri") }
    return try await Task.detached(priority: .userInitiated) {
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      let supported = (try? request.supportedRecognitionLanguages()) ?? []
      let wanted = languages.filter { supported.contains($0) }
      if wanted.isEmpty {
        request.automaticallyDetectsLanguage = true
      } else {
        request.recognitionLanguages = wanted
      }
      do {
        try VNImageRequestHandler(url: url).perform([request])
      } catch {
        throw TextReadFailedException(error.localizedDescription)
      }
      return (request.results ?? [])
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: "\n")
    }.value
  }
}
