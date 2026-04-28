export const AGENT_PROMPT = `
INSTRUCTIONS FOR AGENT MODE:
- Generate 4-6 functional cells (Markdown + Python Code).
- The first code cell MUST include any necessary '!pip install' commands.
- Python cells MUST contain actual implementation logic (data loading, model def, plotting), not just placeholders.
- Code must be robust and ready to run.
`;
