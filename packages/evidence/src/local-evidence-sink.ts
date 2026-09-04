import { createHash, randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EvidenceRecord, EvidenceSink } from "@iphone-fleet/application";
import { type JobId, parseExecutionContext } from "@iphone-fleet/contracts";

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

function safeSegment(value: string, label: string): string {
  if (!SAFE_SEGMENT.test(value)) {
    throw new Error(`${label} contains unsafe filesystem characters`);
  }
  return value;
}

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export class LocalEvidenceSink implements EvidenceSink {
  readonly root: string;

  public constructor(root: string) {
    this.root = resolve(root);
  }

  public async append(record: EvidenceRecord): Promise<void> {
    const context = parseExecutionContext(record.context);
    const jobId = safeSegment(context.jobId, "jobId");
    const evidenceId = safeSegment(record.evidenceId, "evidenceId");
    if (record.artifactPath || record.artifactDigest) {
      throw new Error("artifact path and digest are owned by LocalEvidenceSink");
    }

    const jobDirectory = resolve(this.root, jobId);
    const finalDirectory = resolve(jobDirectory, evidenceId);
    const temporaryDirectory = resolve(jobDirectory, `.tmp-${evidenceId}-${randomUUID()}`);
    const artifactBytes = Buffer.from(`${JSON.stringify(record.details, null, 2)}\n`, "utf8");
    const artifactDigest = digest(artifactBytes);
    const artifactPath = `${jobId}/${evidenceId}/artifact.json`;
    const stored: EvidenceRecord = { ...record, context, artifactPath, artifactDigest };

    await mkdir(temporaryDirectory, { recursive: true });
    try {
      await writeFile(resolve(temporaryDirectory, "artifact.json"), artifactBytes, { flag: "wx" });
      await writeFile(
        resolve(temporaryDirectory, "record.json"),
        `${JSON.stringify(stored, null, 2)}\n`,
        {
          encoding: "utf8",
          flag: "wx",
        },
      );
      await mkdir(jobDirectory, { recursive: true });
      await rename(temporaryDirectory, finalDirectory);
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  public async listByJob(jobIdInput: JobId): Promise<readonly EvidenceRecord[]> {
    const jobId = safeSegment(jobIdInput, "jobId");
    const jobDirectory = resolve(this.root, jobId);
    let entries: Dirent[];
    try {
      entries = await readdir(jobDirectory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const records: EvidenceRecord[] = [];
    for (const entry of entries.filter(
      (item) => item.isDirectory() && !item.name.startsWith(".tmp-"),
    )) {
      const metadata = JSON.parse(
        await readFile(resolve(jobDirectory, entry.name, "record.json"), "utf8"),
      ) as EvidenceRecord;
      parseExecutionContext(metadata.context);
      if (metadata.context.jobId !== jobId) throw new Error("evidence job context mismatch");
      await this.verifyArtifact(metadata);
      records.push(metadata);
    }
    return records.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  public async verifyArtifact(record: EvidenceRecord): Promise<void> {
    if (!record.artifactPath || !record.artifactDigest) {
      throw new Error("evidence artifact metadata is missing");
    }
    const expectedPrefix = `${safeSegment(record.context.jobId, "jobId")}/${safeSegment(record.evidenceId, "evidenceId")}/`;
    if (!record.artifactPath.startsWith(expectedPrefix)) {
      throw new Error("evidence artifact path does not match its context");
    }
    const bytes = await readFile(resolve(this.root, ...record.artifactPath.split("/")));
    if (digest(bytes) !== record.artifactDigest) {
      throw new Error("evidence artifact digest mismatch");
    }
  }
}
