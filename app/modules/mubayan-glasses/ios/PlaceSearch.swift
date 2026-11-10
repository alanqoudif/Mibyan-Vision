import ExpoModulesCore
import Foundation
import MapKit

final class PlaceSearchFailedException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Place search failed: \(param)" }
}

/// "The nearest pharmacy": Apple Maps' own points of interest around a coordinate. Fast, free,
/// and with good Arabic names in the Gulf. `categories` are `MKPointOfInterestCategory` raw
/// values ("MKPOICategoryPharmacy"); when empty the text query alone decides (used for mosques,
/// which have no category).
enum PlaceSearch {
  static func search(
    query: String,
    categories: [String],
    latitude: Double,
    longitude: Double,
    radius: Double
  ) async throws -> [[String: Any]] {
    let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    let request = MKLocalSearch.Request()
    request.naturalLanguageQuery = query
    request.region = MKCoordinateRegion(center: center, latitudinalMeters: radius * 2, longitudinalMeters: radius * 2)
    request.resultTypes = .pointOfInterest
    if !categories.isEmpty {
      request.pointOfInterestFilter = MKPointOfInterestFilter(including: categories.map { MKPointOfInterestCategory(rawValue: $0) })
    }
    do {
      let response = try await MKLocalSearch(request: request).start()
      return response.mapItems.map { item in
        let placemark = item.placemark
        return [
          "name": item.name ?? "",
          "latitude": placemark.coordinate.latitude,
          "longitude": placemark.coordinate.longitude,
          "street": placemark.thoroughfare ?? "",
        ]
      }
    } catch let error as MKError where error.code == .placemarkNotFound {
      return []
    } catch {
      throw PlaceSearchFailedException(error.localizedDescription)
    }
  }
}
