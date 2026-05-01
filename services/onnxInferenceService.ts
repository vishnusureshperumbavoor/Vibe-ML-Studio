import * as ort from 'onnxruntime-web';

export interface DownloadProgress {
  total: number;
  loaded: number;
  percentage: number;
}

class OnnxInferenceService {
  private session: ort.InferenceSession | null = null;
  private modelCache: Map<string, ArrayBuffer> = new Map();
  private dbName = "VML_Models_DB";
  private storeName = "models";

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveToDB(key: string, data: ArrayBuffer): Promise<void> {
    const db = await this.initDB();
    const tx = db.transaction(this.storeName, "readwrite");
    tx.objectStore(this.storeName).put(data, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async getFromDB(key: string): Promise<ArrayBuffer | null> {
    const db = await this.initDB();
    const tx = db.transaction(this.storeName, "readonly");
    const request = tx.objectStore(this.storeName).get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Checks if a model exists in memory or IndexedDB
   */
  async isModelReady(slug: string): Promise<boolean> {
    if (this.modelCache.has(slug)) return true;
    const inDB = await this.getFromDB(slug);
    if (inDB) {
      this.modelCache.set(slug, inDB);
      return true;
    }
    return false;
  }

  /**
   * Downloads a model file and tokenizer with progress tracking
   */
  async downloadModel(
    slug: string, 
    onProgress: (progress: DownloadProgress) => void
  ): Promise<boolean> {
    try {
      const possibleNames = ['model_quantized.onnx', 'model.onnx'];
      let modelFileName = '';
      let totalSize = 0;

      // Check if already in DB
      if (await this.isModelReady(slug)) {
        onProgress({ total: 1, loaded: 1, percentage: 100 });
        return true;
      }

      for (const name of possibleNames) {
        const resp = await fetch(`http://127.0.0.1:2000/onnx_models/${slug}/${name}`, { method: 'HEAD' });
        if (resp.ok) {
          modelFileName = name;
          totalSize += parseInt(resp.headers.get('content-length') || '0', 10);
          break;
        }
      }

      if (!modelFileName) throw new Error("Could not find an .onnx model file.");

      const tokResp = await fetch(`http://127.0.0.1:2000/onnx_models/${slug}/tokenizer.json`, { method: 'HEAD' });
      if (tokResp.ok) {
        totalSize += parseInt(tokResp.headers.get('content-length') || '0', 10);
      }

      const filesToDownload = [modelFileName, 'tokenizer.json'];
      let totalLoaded = 0;
      let finalModelBuffer: ArrayBuffer | null = null;

      for (const fileName of filesToDownload) {
        const url = `http://127.0.0.1:2000/onnx_models/${slug}/${fileName}`;
        const response = await fetch(url);
        if (!response.ok) continue;

        const reader = response.body?.getReader();
        if (!reader) continue;

        const chunks: Uint8Array[] = [];
        while(true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLoaded += value.length;
          
          onProgress({
            total: totalSize,
            loaded: totalLoaded,
            percentage: Math.round((totalLoaded / totalSize) * 100)
          });
        }
        
        const blob = new Blob(chunks);
        const buffer = await blob.arrayBuffer();
        if (fileName.endsWith('.onnx')) {
            finalModelBuffer = buffer;
            this.modelCache.set(slug, buffer);
        }
      }

      // Persist the model buffer to IndexedDB
      if (finalModelBuffer) {
        await this.saveToDB(slug, finalModelBuffer);
      }

      return true;
    } catch (error) {
      console.error("Download failed:", error);
      return false;
    }
  }

  async initSession(slug: string): Promise<boolean> {
    try {
      let modelData = this.modelCache.get(slug);
      if (!modelData) {
        modelData = await this.getFromDB(slug) || undefined;
      }
      if (!modelData) throw new Error("Model data not found.");

      this.session = await ort.InferenceSession.create(modelData, {
        executionProviders: ['webgpu', 'wasm'],
        graphOptimizationLevel: 'all'
      });
      return true;
    } catch (error) {
      console.error("Session initialization failed:", error);
      return false;
    }
  }

  async generate(prompt: string, onToken: (token: string) => void): Promise<void> {
    if (!this.session) throw new Error("Session not initialized");
    onToken("Local ONNX inference with IndexedDB storage is ready.");
  }
}

export const onnxService = new OnnxInferenceService();
