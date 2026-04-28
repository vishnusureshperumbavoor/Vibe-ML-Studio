import os
import sys
import requests
import fitz # PyMuPDF
from bs4 import BeautifulSoup
from rag_service import knowledge_manager, splitter
import uuid

# Enforce UTF-8 for Windows terminal compatibility
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def ingest_pdf(file_path: str, collection_name: str):
    """
    Parses a PDF, chunks it page-by-page, and embeds into ChromaDB.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF not found at {file_path}")

    doc = fitz.open(file_path)
    file_name = os.path.basename(file_path)
    
    all_chunks = []
    all_metadatas = []
    all_ids = []

    print(f"📖 Mining PDF: {file_name} ({len(doc)} pages)")
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text().strip()
        
        if not text:
            continue
            
        # Split page text into chunks
        chunks = splitter.split_text(text)
        
        for i, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            all_metadatas.append({
                "source": file_name,
                "page": page_num + 1,
                "chunk_idx": i
            })
            all_ids.append(f"{file_name}_p{page_num+1}_c{i}_{uuid.uuid4().hex[:8]}")

    # Add to ChromaDB in one batch
    if all_chunks:
        knowledge_manager.add_documents(collection_name, all_chunks, all_metadatas, all_ids)
        print(f"✅ Indexed {len(all_chunks)} chunks from {file_name}")
    
    return {
        "chunks": len(all_chunks),
        "chars": sum(len(c) for c in all_chunks),
        "snippets": all_chunks[:3],
        "source": file_name,
        "type": "pdf"
    }

def ingest_link(url: str, collection_name: str):
    """
    Scrapes a web link, cleans the HTML, and embeds into ChromaDB.
    """
    print(f"🌐 Mining Link: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'lxml') # use lxml installed earlier
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()

        # Get text
        text = soup.get_text()

        # Break into lines and remove leading/trailing whitespace
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines
        clean_text = "\n".join(chunk for chunk in chunks if chunk)
        
        # Split into semantic chunks
        final_chunks = splitter.split_text(clean_text)
        
        metadatas = [{"source": url, "type": "web"} for _ in final_chunks]
        ids = [f"web_{uuid.uuid4().hex[:12]}" for _ in final_chunks]
        
        if final_chunks:
            knowledge_manager.add_documents(collection_name, final_chunks, metadatas, ids)
            print(f"✅ Indexed {len(final_chunks)} chunks from {url}")
            
        return {
            "chunks": len(final_chunks),
            "chars": sum(len(c) for c in final_chunks),
            "snippets": final_chunks[:3],
            "source": url,
            "type": "web"
        }
    except Exception as e:
        print(f"❌ Failed to mine link {url}: {e}")
        return {"error": str(e), "chunks": 0}
