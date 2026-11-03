require 'json'

# React Native ships `spm_dependency`, which lets a pod pull in a Swift package.
# Meta only publishes the Wearables Device Access Toolkit through SPM.
require File.join(
  File.dirname(`node --print "require.resolve('react-native/package.json')"`),
  'scripts/react_native_pods'
)

Pod::Spec.new do |s|
  s.name           = 'MubayanGlasses'
  s.version        = '1.0.0'
  s.summary        = 'Ray-Ban Meta camera access via the Meta Wearables Device Access Toolkit'
  s.author         = ''
  s.homepage       = 'https://github.com/facebook/meta-wearables-dat-ios'
  s.license        = { type: 'MIT' }
  s.platforms      = { ios: '17.2' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  spm_dependency(s,
    url: 'https://github.com/facebook/meta-wearables-dat-ios',
    requirement: { kind: 'upToNextMinorVersion', minimumVersion: '1.0.1' },
    products: ['MWDATCore', 'MWDATCamera']
  )

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
  # Apple's Depth Anything V2 Small (Core ML, 8-bit palettized), precompiled, for ObstacleSensor.
  s.resources = 'Models/*.mlmodelc'
end
