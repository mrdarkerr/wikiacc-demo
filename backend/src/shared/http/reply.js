export function ok(reply, data, meta) {
  return reply.send({ data, ...(meta ? { meta } : {}) });
}

export function created(reply, data) {
  return reply.code(201).send({ data });
}

export function noContent(reply) {
  return reply.code(204).send();
}
