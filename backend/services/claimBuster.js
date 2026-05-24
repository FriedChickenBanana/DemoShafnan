async function scoreClaimWorthiness(text) {
  // ClaimBuster unavailable — pass all claims through
  return 1.0;
}

module.exports = { scoreClaimWorthiness };
