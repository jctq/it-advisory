import type { ReactElement } from 'react';

type JsonLdProps = {
  readonly data: Record<string, unknown> | readonly Record<string, unknown>[];
};

/**
 * Renders Schema.org JSON-LD for crawlers. Pass one object or multiple graph nodes.
 */
export function JsonLd(props: JsonLdProps): ReactElement {
  const payload = Array.isArray(props.data) ? props.data : [props.data];
  const serialized = JSON.stringify(payload.length === 1 ? payload[0] : payload);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialized }} />;
}
