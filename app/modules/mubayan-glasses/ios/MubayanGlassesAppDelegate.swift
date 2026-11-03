import ExpoModulesCore
import MWDATCore

public class MubayanGlassesAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    MainActor.assumeIsolated { GlassesCamera.shared.configure() }
    return true
  }

  /// Meta AI calls back with `<scheme>://?metaWearablesAction=…` after registration and
  /// permission prompts. Claiming it here keeps it away from React Native's Linking, so
  /// Expo Router doesn't navigate away from the current screen.
  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    guard
      let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
      items.contains(where: { $0.name == "metaWearablesAction" })
    else { return false }
    Task { @MainActor in
      do {
        _ = try await Wearables.shared.handleUrl(url)
      } catch {
        NSLog("[MubayanGlasses] handleUrl failed: \(error)")
      }
    }
    return true
  }
}
