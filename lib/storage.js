import {
  mkdir,
  readFile,
  writeFile,
  link,
  unlink,
  readdir,
} from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

// O mesmo contrato é usado pelo disco local e pelo Vercel Blob.
export function storageMode(env = process.env) {
  const mode = env.STORAGE_MODE || (env.VERCEL === "1" ? "blob" : "local");
  if (!["local", "blob"].includes(mode))
    throw new Error("STORAGE_MODE deve ser local ou blob.");
  if (env.VERCEL === "1" && mode === "local")
    throw new Error(
      "Na Vercel use STORAGE_MODE=blob. O disco não é persistente.",
    );
  return mode;
}
export function createLocalStorage(directory) {
  const root = resolve(directory);
  function file(key) {
    const p = resolve(root, key);
    if (!p.startsWith(root + sep)) throw new Error("Caminho inválido.");
    return p;
  }
  return {
    async get(key) {
      try {
        return JSON.parse(await readFile(file(key), "utf8"));
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async create(key, value) {
      const target = file(key);
      await mkdir(dirname(target), { recursive: true });
      const temp = target + "." + randomUUID() + ".tmp";
      // O link publica somente o JSON completo e falha se o destino já existir.
      await writeFile(temp, JSON.stringify(value, null, 2), "utf8");
      try {
        await link(temp, target);
        return true;
      } catch (e) {
        if (e.code === "EEXIST") return false;
        throw e;
      } finally {
        await unlink(temp).catch(() => {});
      }
    },
    async list(prefix) {
      const keys = [];
      async function walk(folder) {
        let entries;
        try {
          entries = await readdir(folder, { withFileTypes: true });
        } catch (e) {
          if (e.code === "ENOENT") return;
          throw e;
        }
        for (const entry of entries) {
          const p = resolve(folder, entry.name);
          if (entry.isDirectory()) await walk(p);
          else if (entry.name.endsWith(".json")) {
            const key = p
              .slice(root.length + 1)
              .split(sep)
              .join("/");
            if (key.startsWith(prefix)) keys.push(key);
          }
        }
      }
      await walk(root);
      return keys;
    },
  };
}
export function createBlobStorage(sdk, namespace = "cidade-acessivel-v3/") {
  return {
    async get(key) {
      const result = await sdk.get(namespace + key, {
        access: "private",
        useCache: false,
      });
      if (!result) return null;
      if (result.statusCode !== 200)
        throw new Error("Falha ao ler JSON do Blob.");
      return new Response(result.stream).json();
    },
    async create(key, value) {
      try {
        await sdk.put(namespace + key, JSON.stringify(value), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: "application/json",
          cacheControlMaxAge: 60,
        });
        return true;
      } catch (e) {
        const existing = await sdk
          .get(namespace + key, { access: "private", useCache: false })
          .catch(() => null);
        if (existing?.statusCode === 200) {
          await existing.stream?.cancel();
          return false;
        }
        throw e;
      }
    },
    async list(prefix) {
      const keys = [];
      let cursor;
      do {
        const page = await sdk.list({
          prefix: namespace + prefix,
          limit: 1000,
          cursor,
        });
        keys.push(...page.blobs.map((b) => b.pathname.slice(namespace.length)));
        cursor = page.hasMore ? page.cursor : undefined;
        if (page.hasMore && !cursor)
          throw new Error("Paginação inválida do Blob.");
      } while (cursor);
      return keys;
    },
  };
}
let singleton;
export async function getStorage() {
  if (singleton) return singleton;
  if (storageMode() === "local")
    return (singleton = createLocalStorage(process.env.DATA_DIR || "data"));
  if (
    !process.env.BLOB_READ_WRITE_TOKEN &&
    !(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  )
    throw Object.assign(
      new Error(
        "Conecte um Blob privado ao projeto Vercel ou configure BLOB_READ_WRITE_TOKEN.",
      ),
      { status: 503 },
    );
  const sdk = await import("@vercel/blob");
  return (singleton = createBlobStorage(sdk));
}
