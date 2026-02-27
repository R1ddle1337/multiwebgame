import type {
  AuthResponse,
  BlockDTO,
  BoardGameType,
  InvitationDTO,
  MatchDTO,
  RatingFormulaDTO,
  RatingDTO,
  ReportDTO,
  RoomDTO,
  UserDTO
} from '@multiwebgame/shared-types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiClient {
  constructor(private readonly token: string | null) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Request failed: ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  authGuest(displayName?: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ displayName })
    });
  }

  authRegister(params: { displayName: string; email: string; password: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  authLogin(params: { email: string; password: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  upgradeGuest(params: { displayName: string; email: string; password: string }): Promise<{ user: UserDTO }> {
    return this.request('/auth/upgrade', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  me(): Promise<{ user: UserDTO }> {
    return this.request('/me');
  }

  listRatings(): Promise<{ ratings: RatingDTO[] }> {
    return this.request('/ratings/me');
  }

  listRatingFormulas(): Promise<{ formulas: RatingFormulaDTO[] }> {
    return this.request('/ratings/formula');
  }

  listRooms(): Promise<{ rooms: RoomDTO[] }> {
    return this.request('/rooms');
  }

  createRoom(gameType: BoardGameType | 'single_2048', maxPlayers?: number): Promise<{ room: RoomDTO }> {
    return this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify({ gameType, maxPlayers })
    });
  }

  getRoom(roomId: string): Promise<{ room: RoomDTO }> {
    return this.request(`/rooms/${roomId}`);
  }

  joinRoom(roomId: string, asSpectator = false): Promise<{ room: RoomDTO }> {
    return this.request(`/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ asSpectator })
    });
  }

  leaveRoom(roomId: string): Promise<{ room: RoomDTO | null }> {
    return this.request(`/rooms/${roomId}/leave`, {
      method: 'POST'
    });
  }

  listInvitations(): Promise<{ invitations: InvitationDTO[] }> {
    return this.request('/invitations');
  }

  createInvitation(roomId: string, toUserId: string): Promise<{ invitation: InvitationDTO }> {
    return this.request('/invitations', {
      method: 'POST',
      body: JSON.stringify({ roomId, toUserId })
    });
  }

  respondInvitation(
    invitationId: string,
    action: 'accept' | 'decline'
  ): Promise<{ invitation: InvitationDTO }> {
    return this.request(`/invitations/${invitationId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  }

  matchHistory(limit = 20): Promise<{ matches: MatchDTO[] }> {
    return this.request(`/matches/history?limit=${limit}`);
  }

  getMatch(matchId: string): Promise<{ match: MatchDTO }> {
    return this.request(`/matches/${matchId}`);
  }

  listBlocks(): Promise<{ blocks: BlockDTO[] }> {
    return this.request('/moderation/blocks');
  }

  blockUser(params: { userId: string; reason?: string }): Promise<{ block: BlockDTO }> {
    return this.request('/moderation/blocks', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  reportUser(params: {
    targetUserId?: string;
    matchId?: string;
    reason: string;
    details?: string;
  }): Promise<{ ok: true }> {
    return this.request('/moderation/reports', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  listReports(params?: { status?: ReportDTO['status']; limit?: number }): Promise<{ reports: ReportDTO[] }> {
    const query = new URLSearchParams();
    if (params?.status) {
      query.set('status', params.status);
    }
    if (typeof params?.limit === 'number') {
      query.set('limit', String(params.limit));
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/moderation/reports${suffix}`);
  }

  resolveReport(
    reportId: string,
    status: Exclude<ReportDTO['status'], 'open'>
  ): Promise<{ report: ReportDTO }> {
    return this.request(`/moderation/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }
}

export const storage = {
  tokenKey: 'mwg_token',
  reconnectKey: 'mwg_reconnect_key',
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  },
  setToken(token: string | null): void {
    if (!token) {
      localStorage.removeItem(this.tokenKey);
      return;
    }
    localStorage.setItem(this.tokenKey, token);
  },
  getReconnectKey(): string | null {
    return localStorage.getItem(this.reconnectKey);
  },
  setReconnectKey(value: string | null): void {
    if (!value) {
      localStorage.removeItem(this.reconnectKey);
      return;
    }
    localStorage.setItem(this.reconnectKey, value);
  }
};
