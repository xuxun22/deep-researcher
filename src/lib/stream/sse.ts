export interface SSEEvent {
  type: string;
  data: unknown;
}

export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      closed = true;
    },
  });

  function send(event: SSEEvent) {
    if (closed || !controller) return;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    controller.enqueue(encoder.encode(payload));
  }

  function close() {
    if (closed || !controller) return;
    closed = true;
    send({ type: 'done', data: {} });
    controller.close();
  }

  function error(message: string) {
    if (closed || !controller) return;
    send({ type: 'error', data: { message } });
    close();
  }

  return { stream, send, close, error };
}
