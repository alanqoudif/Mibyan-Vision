import CoreImage
import CoreMedia
import UIKit
import VideoToolbox

/// Decodes the glasses' HEVC (hvc1) video frames into images, following Meta's CameraAccess
/// sample. Not thread-safe: call `decode(_:)` from one serial queue.
final class FrameDecoder: @unchecked Sendable {
  private var session: VTDecompressionSession?
  private var format: CMFormatDescription?
  private var awaitingKeyframe = true
  private var failures = 0
  private let context = CIContext()

  func decode(_ sample: CMSampleBuffer) -> UIImage? {
    guard CMSampleBufferGetDataBuffer(sample) != nil,
      let sampleFormat = CMSampleBufferGetFormatDescription(sample)
    else { return nil }

    if let format, !CMFormatDescriptionEqual(format, otherFormatDescription: sampleFormat) { reset() }
    if let session, !VTDecompressionSessionCanAcceptFormatDescription(session, formatDescription: sampleFormat) {
      reset()
    }
    if session == nil {
      // Software decoding survives backgrounding; a hardware session is torn down and
      // stalls until the next keyframe.
      let spec = [kVTVideoDecoderSpecification_EnableHardwareAcceleratedVideoDecoder as String: false] as CFDictionary
      let attrs = [kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA] as CFDictionary
      VTDecompressionSessionCreate(
        allocator: kCFAllocatorDefault,
        formatDescription: sampleFormat,
        decoderSpecification: spec,
        imageBufferAttributes: attrs,
        outputCallback: nil,
        decompressionSessionOut: &session)
      format = sampleFormat
      awaitingKeyframe = true
    }
    guard let session else { return nil }

    let keyframe = Self.isKeyframe(sample)
    if awaitingKeyframe && !keyframe { return nil }

    // No async flag: the handler runs synchronously on this thread.
    nonisolated(unsafe) var output: CVPixelBuffer?
    let status = VTDecompressionSessionDecodeFrame(session, sampleBuffer: sample, flags: [], infoFlagsOut: nil) {
      status, _, buffer, _, _ in
      if status == noErr { output = buffer }
    }
    guard status == noErr, let output else {
      failures += 1
      if failures >= 3 { reset() }
      return nil
    }
    failures = 0
    if keyframe { awaitingKeyframe = false }

    let image = CIImage(cvPixelBuffer: output)
    guard let cgImage = context.createCGImage(image, from: image.extent) else { return nil }
    return UIImage(cgImage: cgImage)
  }

  func reset() {
    if let session { VTDecompressionSessionInvalidate(session) }
    session = nil
    format = nil
    awaitingKeyframe = true
    failures = 0
  }

  private static func isKeyframe(_ sample: CMSampleBuffer) -> Bool {
    guard
      let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: false) as? [[CFString: Any]],
      let first = attachments.first
    else { return true }
    return first[kCMSampleAttachmentKey_NotSync] as? Bool != true
  }
}
