# RAG Consistency Rules

**Rule 1: Grounding First**
If a retrieved context does not contain the answer, the agent must state "I don't know based on the provided documents" rather than hallucinating.

**Rule 2: Chunk Integrity**
Never split a paragraph in a way that loses semantic meaning. Use overlap (minimum 10%) to maintain context between chunks.

**Rule 3: Citation Format**
Always provide the source filename or ID in brackets (e.g., [source_v1.pdf]) when quoting retrieved knowledge.
