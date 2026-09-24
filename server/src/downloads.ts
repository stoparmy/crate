import archiver from "archiver";
import type { Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

type Body = NonNullable<globalThis.Response["body"]>;

function fromBody(body: Body) {
  // DOM fetch and Node stream typings differ; both use the same Web Stream at runtime.
  return Readable.fromWeb(body as unknown as NodeReadableStream);
}

// Keep fetches and streaming within the request's promise/error boundary.
export async function withDownload(res: Response, download: (signal: AbortSignal) => Promise<void>) {
  const controller = new AbortController();
  const close = () => controller.abort();
  res.once("close", close);
  try {
    if (res.destroyed) controller.abort();
    controller.signal.throwIfAborted();
    await download(controller.signal);
  } finally {
    controller.abort();
    res.off("close", close);
  }
}

export async function streamBody(body: Body, res: Response, signal: AbortSignal) {
  await pipeline(fromBody(body), res, { signal });
}

export async function streamZip(
  entries: AsyncIterable<{ name: string; body: Body }>,
  res: Response,
  signal: AbortSignal,
) {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const sources = new Set<Readable>();
  const delivery = pipeline(archive, res, { signal });
  // Observe delivery immediately, including while waiting for upstream headers.
  const populate = async () => {
    for await (const entry of entries) {
      const source = fromBody(entry.body);
      sources.add(source);
      source.once("close", () => sources.delete(source));
      source.on("error", (error) => archive.destroy(error));
      if (signal.aborted || archive.destroyed) {
        source.destroy();
        throw new Error("Attachment download interrupted");
      }
      archive.append(source, { name: entry.name });
    }
    await archive.finalize();
  };
  try {
    await Promise.all([delivery, populate()]);
  } finally {
    // Archiver does not drain or cancel appended sources when aborted.
    archive.abort();
    archive.destroy();
    for (const source of sources) source.destroy();
  }
}
