import os
import sys
import re
import json
import chromadb

# Enforce UTF-8 for Windows terminal compatibility
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any

class VMLRecursiveSplitter:
    """
    A native, high-performance recursive text splitter for VML Studio.
    Splits text by a hierarchy of separators to maintain semantic context.
    """
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", ". ", " ", ""]

    def split_text(self, text: str) -> List[str]:
        return self._recursive_split(text, self.separators)

    def _recursive_split(self, text: str, separators: List[str]) -> List[str]:
        final_chunks = []
        
        # Base case: text is small enough
        if len(text) <= self.chunk_size:
            return [text]

        # Find the best separator to use
        separator = separators[-1] # default to empty string
        for s in separators:
            if s in text:
                separator = s
                break
        
        # Split by the chosen separator
        parts = text.split(separator)
        
        current_chunk = ""
        for p in parts:
            # If adding this part exceeds chunk size, save current and start new
            if len(current_chunk) + len(separator) + len(p) > self.chunk_size:
                if current_chunk:
                    final_chunks.append(current_chunk)
                
                # Handle edge case where a single part is larger than chunk_size
                if len(p) > self.chunk_size:
                    # Recursively split the long part with remaining separators
                    if len(separators) > 1:
                        sub_chunks = self._recursive_split(p, separators[separators.index(separator)+1:])
                        final_chunks.extend(sub_chunks[:-1])
                        current_chunk = sub_chunks[-1]
                    else:
                        # Hard cut as last resort
                        current_chunk = p[:self.chunk_size]
                else:
                    current_chunk = p
            else:
                if current_chunk:
                    current_chunk += separator + p
                else:
                    current_chunk = p

        if current_chunk:
            final_chunks.append(current_chunk)

        return final_chunks

class VMLKnowledgeManager:
    """
    Manages the local Vector DB (ChromaDB) and Semantic Embeddings.
    """
    def __init__(self):
        # Path: server/data/vectors
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.db_path = os.path.join(base_dir, "data", "vectors")
        os.makedirs(self.db_path, exist_ok=True)
        
        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(path=self.db_path)
        self._model = None

    def _get_model(self):
        """Lazy-load the embedding model."""
        if self._model is None:
            print("📥 Initializing VML Semantic Encoder (BGE-Small)...")
            self._model = SentenceTransformer("BAAI/bge-small-en-v1.5")
            print("✅ Semantic Encoder Ready.")
        return self._model

    def get_or_create_collection(self, name: str):
        # Slugify name for Chroma compatibility
        slug = re.sub(r'[^a-zA-Z0-9_-]', '_', name.lower())
        return self.client.get_or_create_collection(name=slug)

    def add_documents(self, collection_name: str, documents: List[str], metadatas: List[Dict[str, Any]], ids: List[str]):
        collection = self.get_or_create_collection(collection_name)
        
        # Generate embeddings in batch
        embeddings = self._get_model().encode(documents).tolist()
        
        collection.add(
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )

    def search(self, collection_name: str, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        collection = self.get_or_create_collection(collection_name)
        
        query_embedding = self._get_model().encode([query]).tolist()
        
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=limit
        )
        
        # Format results for easier UI consumption
        formatted = []
        if results['documents']:
            for i in range(len(results['documents'][0])):
                formatted.append({
                    "content": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i],
                    "distance": results['distances'][0][i] if 'distances' in results else 0
                })
        return formatted

    def list_collections(self):
        collections = self.client.list_collections()
        results = []
        for c in collections:
            count = c.count()
            results.append({
                "name": c.name,
                "count": count
            })
        return results

    def get_storage_stats(self):
        """Calculates size of the vector store on disk in MB."""
        total_size = 0
        if os.path.exists(self.db_path):
            for dirpath, dirnames, filenames in os.walk(self.db_path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    total_size += os.path.getsize(fp)
        return round(total_size / (1024 * 1024), 2)

    def explore_collection(self, name: str, limit: int = 50):
        """Fetch raw documents from the collection for the Knowledge Explorer."""
        try:
            collection = self.client.get_collection(name=name)
            data = collection.get(limit=limit, include=['documents', 'metadatas'])
            formatted = []
            if data['documents']:
                for i in range(len(data['documents'])):
                    formatted.append({
                        "id": data['ids'][i],
                        "content": data['documents'][i],
                        "metadata": data['metadatas'][i] if data['metadatas'] else {}
                    })
            return formatted
        except Exception:
            return []

    def delete_collection(self, name: str):
        self.client.delete_collection(name=name)

# Singleton instance
knowledge_manager = VMLKnowledgeManager()
splitter = VMLRecursiveSplitter()
