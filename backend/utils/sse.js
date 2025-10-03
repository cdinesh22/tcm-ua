// Simple SSE manager for temple-specific streams
const clients = new Map(); // templeId -> Set<res>

function addClient(templeId, res) {
  if (!clients.has(templeId)) clients.set(templeId, new Set());
  clients.get(templeId).add(res);
}

function removeClient(templeId, res) {
  const set = clients.get(templeId);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(templeId);
  }
}

function broadcast(templeId, event, data) {
  const set = clients.get(String(templeId));
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch (_) {
      // Ignore write errors on broken connections
    }
  }
}

module.exports = { addClient, removeClient, broadcast };
