export interface Player {
  id: string;
  name: string;
  level: number;
}

export interface ChatMessage {
  id: string;
  user: string;
  message: string;
  timestamp: Date;
}

export interface Lobby {
  id: string;
  title: string;
  players: Player[];
  maxPlayers: number;
  password?: string;
  isPrivate: boolean;
  createdAt: Date;
  chatMessages: ChatMessage[];
}

export interface WebSocketMessage {
  type: string;
  data: any;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private url: string;
  private eventHandlers: Map<string, Function[]> = new Map();
  private isConnecting = false;

  constructor(url: string = 'ws://localhost:8080') {
    this.url = url;
  }

  connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnecting = false;
          this.ws = null;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, this.reconnectInterval);
    }
  }

  private handleMessage(message: WebSocketMessage) {
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.data));
    }
  }

  on(eventType: string, handler: Function) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler?: Function) {
    if (handler) {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    } else {
      this.eventHandlers.delete(eventType);
    }
  }

  private send(type: string, data: any = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket not connected. Message not sent:', { type, data });
    }
  }

  // Player methods
  registerPlayer(name: string, level: number = 1) {
    this.send('register_player', { name, level });
  }

  // Lobby methods
  getLobbies() {
    this.send('get_lobbies');
  }

  createLobby(title: string, maxPlayers: number = 3) {
    this.send('create_lobby', { title, maxPlayers });
  }

  joinLobby(lobbyId: string) {
    this.send('join_lobby', { lobbyId });
  }

  leaveLobby() {
    this.send('leave_lobby');
  }

  delistLobby() {
    this.send('delist_lobby');
  }

  getLobbyDetails() {
    this.send('get_lobby_details');
  }

  // Chat methods
  sendChatMessage(message: string) {
    this.send('send_chat_message', { message });
  }

  // Lobby settings
  regeneratePassword() {
    this.send('regenerate_password');
  }

  togglePrivacy() {
    this.send('toggle_privacy');
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventHandlers.clear();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Global instance
export const wsService = new WebSocketService();