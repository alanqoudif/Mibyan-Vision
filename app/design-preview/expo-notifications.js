// Design-preview stub for web only (VISION_DESIGN_PREVIEW=1). Native builds never load this.
const noop = () => {};
module.exports = {
  setNotificationHandler: noop,
  getLastNotificationResponse: () => null,
  clearLastNotificationResponse: noop,
  addNotificationResponseReceivedListener: () => ({ remove: noop }),
  requestPermissionsAsync: async () => ({ granted: false, status: 'denied' }),
  getExpoPushTokenAsync: async () => ({ data: '' }),
};
