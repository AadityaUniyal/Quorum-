import sys
import os
import logging

# Ensure project root is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.database import SessionLocal
from app.models.document import Document
from app.services.vector_store import add_document_to_vector_store, chroma_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("reindex_embeddings")

def main():
    logger.info("Initializing ChromaDB collection reset for re-indexing...")
    
    # Reset existing collection
    try:
        chroma_client.delete_collection(name="document_intelligence")
        logger.info("Deleted existing collection 'document_intelligence'")
    except Exception as e:
        logger.info(f"No existing collection to delete: {e}")
        
    # Re-create collection
    collection = chroma_client.get_or_create_collection(name="document_intelligence")
    logger.info(f"Re-created collection 'document_intelligence' with provider={settings.EMBEDDING_PROVIDER}")

    db = SessionLocal()
    try:
        documents = db.query(Document).filter(Document.ocr_text.isnot(None), Document.ocr_text != "").all()
        logger.info(f"Found {len(documents)} processed documents in Postgres. Starting re-indexing...")
        
        for doc in documents:
            logger.info(f"Re-indexing document ID: {doc.id} ({doc.filename})")
            metadata = {
                "filename": doc.filename,
                "category": doc.category.value if hasattr(doc.category, 'value') else str(doc.category),
                "status": doc.status.value if hasattr(doc.status, 'value') else str(doc.status),
            }
            add_document_to_vector_store(document_id=str(doc.id), ocr_text=doc.ocr_text, metadata=metadata)
            
        logger.info("✓ Re-indexing completed successfully!")
    except Exception as e:
        logger.error(f"Re-indexing failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
