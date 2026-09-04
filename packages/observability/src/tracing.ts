import type { ExecutionContext } from "@iphone-fleet/contracts";
import { type Attributes, SpanStatusCode, trace } from "@opentelemetry/api";

export type TraceContext = Partial<ExecutionContext>;

function contextAttributes(context: TraceContext): Attributes {
  const attributes: Attributes = {};
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) attributes[`fleet.${key}`] = value;
  }
  return attributes;
}

export async function withFleetSpan<T>(
  name: string,
  context: TraceContext,
  attributes: Attributes,
  operation: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer("iphone-fleet-agent", "0.1.0");
  return tracer.startActiveSpan(
    name,
    { attributes: { ...contextAttributes(context), ...attributes } },
    async (span) => {
      try {
        const result = await operation();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const exception = error instanceof Error ? error : new Error(String(error));
        span.recordException(exception);
        span.setStatus({ code: SpanStatusCode.ERROR, message: exception.message });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
