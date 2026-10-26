import ExpoModulesCore
import UIKit

/// The glasses' live video. Shows nothing until the camera stream is running.
final class GlassesPreviewView: ExpoView, GlassesFrameObserver {
  private let imageView = UIImageView()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    imageView.contentMode = .scaleAspectFill
    imageView.frame = bounds
    imageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(imageView)
    MainActor.assumeIsolated { GlassesCamera.shared.addFrameObserver(self) }
  }

  func show(_ image: UIImage) {
    imageView.image = image
  }
}
