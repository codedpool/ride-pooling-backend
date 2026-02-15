// Redis disabled for local stability
// In production, use managed Redis (Upstash, ElastiCache)

module.exports = {
  getClient: () => null,
  isReady: () => false
};
