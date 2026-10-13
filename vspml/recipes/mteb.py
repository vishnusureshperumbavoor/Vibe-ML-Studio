import json
from typing import Dict, Any, List

MTEB_BENCHMARK_RESULTS = [
    {
        "task": "BIOSSES",
        "category": "Semantic Textual Similarity (STS)",
        "metric": "Spearman Correlation",
        "score": "0.700 (69.96%)",
        "details": "Manhattan Spearman: 0.760 | Pearson: 0.682"
    },
    {
        "task": "SciDocsRR",
        "category": "Scientific Document Reranking",
        "metric": "MAP@100 / MRR@10",
        "score": "0.576 / 0.800",
        "details": "NDCG@10: 0.641 | Hit Rate@5: 94.0%"
    }
]

def generate_mteb_similarity_script(
    model_id: str = "vishnusureshperumbavoor/vsp-agent-biomed-embedding-a100",
    text1: str = "GLP-1 receptor agonists reduce cardiovascular mortality in type 2 diabetes.",
    text2: str = "Semaglutide demonstrates significant reduction in adverse cardiac events."
) -> str:
    clean_model = json.dumps(model_id)
    clean_t1 = json.dumps(text1)
    clean_t2 = json.dumps(text2)

    return f'''
import json
import time
from sentence_transformers import SentenceTransformer

model_id = {clean_model}
text1 = {clean_t1}
text2 = {clean_t2}

start = time.time()
model = SentenceTransformer(model_id)
load_time = time.time() - start

t0 = time.time()
emb = model.encode([text1, text2], normalize_embeddings=True)
infer_time_ms = (time.time() - t0) * 1000

sim = float(model.similarity(emb[0], emb[1]).item())
dim = int(emb.shape[1])

result = {{
    "model_id": model_id,
    "similarity": round(sim, 4),
    "dimension": dim,
    "latency_ms": round(infer_time_ms, 2),
    "text1": text1,
    "text2": text2
}}

print("###VSPML_MTEB_START###")
print(json.dumps(result))
print("###VSPML_MTEB_END###")
'''
