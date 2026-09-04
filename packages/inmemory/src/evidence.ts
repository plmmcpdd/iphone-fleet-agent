import type { EvidenceRecord, EvidenceSink } from "@iphone-fleet/application";
import type { JobId } from "@iphone-fleet/contracts";

export class InMemoryEvidenceSink implements EvidenceSink {
  private readonly records: EvidenceRecord[] = [];

  public async append(record: EvidenceRecord): Promise<void> {
    this.records.push(structuredClone(record));
  }

  public async listByJob(jobId: JobId): Promise<readonly EvidenceRecord[]> {
    return this.records
      .filter((record) => record.context.jobId === jobId)
      .map((record) => structuredClone(record));
  }
}
