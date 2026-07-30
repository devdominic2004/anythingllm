async function reformulateQuery(message, LLMConnector) {
  try {
    const prompt = `You are a query reformulation assistant.
Your task is to determine if the user's prompt contains multiple distinct questions that would require searching for different concepts in a document database.
If the prompt contains multiple distinct questions, separate them and return a JSON array of strings, where each string is a separate question.
If the prompt contains only a single question or concept, just return a JSON array containing the original prompt as a single string.
Only output a valid JSON array of strings. Do not include markdown formatting, backticks, or any other text.

User prompt: "${message}"`;

    const messages = [{ role: "user", content: prompt }];
    
    const response = await LLMConnector.getChatCompletion(messages, { temperature: 0.1 });
    const textResponse = typeof response === "string" ? response : (response.textResponse || "");

    // Extract JSON array from textResponse (in case of markdown ```json ... ```)
    const jsonMatch = textResponse.match(/\[.*\]/s);
    const jsonStr = jsonMatch ? jsonMatch[0] : textResponse;

    const queries = JSON.parse(jsonStr);
    
    if (Array.isArray(queries) && queries.length > 0) {
      // Filter out non-strings just in case
      return queries.filter(q => typeof q === "string");
    }
    
    return [message];
  } catch (error) {
    console.error("Query reformulation failed, falling back to original message", error);
    return [message];
  }
}

module.exports = {
  reformulateQuery
};
