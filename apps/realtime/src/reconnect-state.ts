export interface ReconnectSource {
  reconnectKey: string;
  lobbySubscribed: boolean;
  roomIds: Iterable<string>;
}

export interface AggregatedReconnectState {
  reconnectKeys: string[];
  lobbySubscribed: boolean;
  roomIds: string[];
}

export function aggregateReconnectState(sources: ReconnectSource[]): AggregatedReconnectState {
  const keySet = new Set<string>();
  const roomSet = new Set<string>();
  let lobbySubscribed = false;

  for (const source of sources) {
    keySet.add(source.reconnectKey);
    if (source.lobbySubscribed) {
      lobbySubscribed = true;
    }
    for (const roomId of source.roomIds) {
      roomSet.add(roomId);
    }
  }

  return {
    reconnectKeys: Array.from(keySet),
    lobbySubscribed,
    roomIds: Array.from(roomSet)
  };
}
