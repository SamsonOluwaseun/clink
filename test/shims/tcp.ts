import net from 'node:net';
function createServer(cb: (s: net.Socket) => void) {
  const s = net.createServer(cb);
  const host = (globalThis as any).__MY_IP;
  const listen = s.listen.bind(s);
  (s as any).listen = (o: any) => listen({ port: o.port, host });
  return s;
}
function createConnection(o: any, cb: () => void) {
  return net.createConnection({ host: o.host, port: o.port, timeout: o.connectTimeout }, cb);
}
export default { createServer, createConnection };
