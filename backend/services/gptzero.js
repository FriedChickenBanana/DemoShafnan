async function detectAiWritten(text) {
  // GPTZero bypassed — return null result
  return { is_ai_written: null, probability: null };
}

module.exports = { detectAiWritten };
