<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { wsService, type Lobby, type Player, type ChatMessage } from '../services/websocket';

const route = useRoute();
const router = useRouter();

const lobby = ref<Lobby | null>(null);
const isConnected = ref(false);
const lobbyPassword = ref('');
const chatMessage = ref('');
const isReady = ref(false);
const isPrivate = ref(false);
const chatMessages = ref<ChatMessage[]>([]);
const currentPlayerName = ref('');

const generatePassword = () => {
  wsService.regeneratePassword();
  // Optimistic update - will be overridden by server response if different
};

const sendMessage = () => {
  if (chatMessage.value.trim() && isConnected.value) {
    const message = chatMessage.value.trim();
    
    // Optimistic update - add message immediately to local state
    const newMessage: ChatMessage = {
      id: Date.now().toString(), // Temporary ID
      user: currentPlayerName.value || 'You',
      message: message,
      timestamp: new Date()
    };
    chatMessages.value.push(newMessage);
    
    wsService.sendChatMessage(message);
    chatMessage.value = '';
  }
};

const goBack = () => {
  router.push('/');
};

const toggleVoiceChat = () => {
  alert('Voice chat feature would be implemented here');
};

const toggleReady = () => {
  isReady.value = !isReady.value;
};

const delistLobby = () => {
  if (isConnected.value) {
    wsService.delistLobby();
  }
};

const togglePrivate = () => {
  if (isConnected.value) {
    // Optimistic update - toggle immediately
    isPrivate.value = !isPrivate.value;
    wsService.togglePrivacy();
  }
};

const leaveLobby = () => {
  if (isConnected.value) {
    wsService.leaveLobby();
  }
};

const connectToServer = async () => {
  try {
    await wsService.connect();
    isConnected.value = true;
    
    // Set up event handlers
    wsService.on('lobby_details', (data: any) => {
      lobby.value = data.lobby;
      lobbyPassword.value = data.lobby.password;
      isPrivate.value = data.lobby.isPrivate;
      chatMessages.value = data.lobby.chatMessages;
      
      // Find current player name (assuming we're in the lobby)
      if (data.currentPlayer) {
        currentPlayerName.value = data.currentPlayer.name;
      } else if (data.lobby.players.length > 0) {
        // Fallback: use first player as current player
        currentPlayerName.value = data.lobby.players[0].name;
      }
    });
    
    wsService.on('chat_message', (data: any) => {
      // Check if this message is from the current user and already exists (optimistic update)
      const isDuplicate = data.message.user === currentPlayerName.value && 
        chatMessages.value.some(msg => 
          msg.user === data.message.user && 
          msg.message === data.message.message && 
          Math.abs(new Date(msg.timestamp).getTime() - new Date(data.message.timestamp).getTime()) < 5000
        );
      
      if (!isDuplicate) {
        chatMessages.value.push(data.message);
      }
    });
    
    wsService.on('password_updated', (data: any) => {
      lobbyPassword.value = data.password;
    });
    
    wsService.on('privacy_updated', (data: any) => {
      isPrivate.value = data.isPrivate;
    });
    
    wsService.on('player_joined', (data: any) => {
      if (lobby.value) {
        lobby.value = data.lobby;
        chatMessages.value = data.lobby.chatMessages;
      }
    });
    
    wsService.on('player_left', (data: any) => {
      if (lobby.value) {
        lobby.value = data.lobby;
        chatMessages.value = data.lobby.chatMessages;
      }
    });
    
    wsService.on('lobby_left', () => {
      router.push('/');
    });
    
    wsService.on('lobby_delisted', () => {
      alert('Lobby has been delisted');
      router.push('/');
    });
    
    wsService.on('lobby_joined', (data: any) => {
      // Successfully joined lobby, update local state
      lobby.value = data.lobby;
      if (data.lobby) {
        lobbyPassword.value = data.lobby.password;
        isPrivate.value = data.lobby.isPrivate;
        chatMessages.value = data.lobby.chatMessages;
        // Set current player name
        if (data.currentPlayer) {
          currentPlayerName.value = data.currentPlayer.name;
        }
      }
    });
    
    wsService.on('error', (data: any) => {
      alert(data.message);
      // If error joining lobby, redirect to home
      if (data.message.includes('lobby') || data.message.includes('Lobby')) {
        router.push('/');
      }
    });
    
    // Extract lobby ID from route and fetch lobby details
    const lobbyId = route.params.id as string;
    if (lobbyId) {
      let playerName = localStorage.getItem('playerName');
      
      if (!playerName) {
        // First time - ask for username
        playerName = prompt('Enter your username:');
        if (playerName && playerName.trim()) {
          localStorage.setItem('playerName', playerName.trim());
          currentPlayerName.value = playerName.trim();
        } else {
          alert('Username required');
          router.push('/');
          return;
        }
      } else {
        currentPlayerName.value = playerName;
      }
      
      // Always just fetch lobby details - backend will handle if we need to join
      wsService.getLobbyDetails(lobbyId, currentPlayerName.value);
    } else {
      alert('No lobby ID provided');
      router.push('/');
    }
    
  } catch (error) {
    console.error('Failed to connect to WebSocket server:', error);
    alert('Failed to connect to server');
    router.push('/');
  }
};

onMounted(() => {
  connectToServer();
});

onUnmounted(() => {
  // Clean up event handlers but don't disconnect the WebSocket
  wsService.off('lobby_details');
  wsService.off('chat_message');
  wsService.off('password_updated');
  wsService.off('privacy_updated');
  wsService.off('player_joined');
  wsService.off('player_left');
  wsService.off('lobby_left');
  wsService.off('lobby_delisted');
  wsService.off('lobby_joined');
  wsService.off('error');
});
</script>

<template>
  <div v-if="lobby" class="lobby-detail">
    <div class="lobby-header">
      <button @click="goBack" class="back-btn">← Back to Lobbies</button>
      <h1 class="lobby-title">{{ lobby.title }}</h1>
      <div class="header-actions">
        <button @click="delistLobby" class="header-btn secondary">Delist</button>
        <button @click="leaveLobby" class="header-btn secondary">Leave</button>
      </div>
    </div>

    <div class="lobby-content">
      <!-- Left side - Players -->
      <div class="players-panel">
        <div class="players-section">
          <h3>Players ({{ lobby.players.length }}/{{ lobby.maxPlayers }})</h3>
          <div class="players-list">
            <div
              v-for="player in lobby.players"
              :key="player.name"
              class="player-item"
            >
              <div class="player-avatar">{{ player.name.charAt(0) }}</div>
              <div class="player-info">
                <span class="player-name">{{ player.name }}</span>
                <span class="player-level">Lv.{{ player.level }}</span>
              </div>
            </div>
            <div
              v-for="i in (lobby.maxPlayers - lobby.players.length)"
              :key="`empty-${i}`"
              class="player-item empty"
            >
              <div class="player-avatar empty">?</div>
              <span class="player-name">Waiting...</span>
            </div>
          </div>
        </div>

        <!-- Voice Chat -->
        <div class="voice-section">
          <h3>Voice Chat</h3>
          <div class="voice-controls">
            <button @click="toggleVoiceChat" class="voice-btn">
              🎤 Join Voice Chat
            </button>
            <div class="voice-status">
              <span class="status-indicator"></span>
              Voice chat ready
            </div>
          </div>
        </div>
      </div>

      <!-- Center - Chat -->
      <div class="chat-panel">
        <div class="chat-section">
          <h3>Chat</h3>
          <div class="chat-messages">
            <div
              v-for="(msg, index) in chatMessages"
              :key="index"
              class="chat-message"
            >
              <span class="message-user">{{ msg.user }}:</span>
              <span class="message-text">{{ msg.message }}</span>
            </div>
          </div>
          <div class="chat-input">
            <input
              v-model="chatMessage"
              @keyup.enter="sendMessage"
              placeholder="Type a message..."
              class="message-input"
            />
            <button @click="sendMessage" class="send-btn">Send</button>
          </div>
        </div>
      </div>

      <!-- Right side - Lobby Info -->
      <div class="info-panel">
        <div class="lobby-info">
          <h3>Lobby Information</h3>

          <div class="info-item">
            <label>Lobby Password:</label>
            <code class="password">{{ lobbyPassword }}</code>
            <a @click="generatePassword()" class="regenerate-link">Generate new password</a>
          </div>

          <div class="info-item">
            <label>Visibility:</label>
            <div class="toggle-container">
              <button
                @click="togglePrivate"
                class="toggle-btn"
                :class="{ active: isPrivate }"
              >
                {{ isPrivate ? '🔒 Private' : '🌐 Public' }}
              </button>
            </div>
          </div>

          <div class="info-item">
            <label>Status:</label>
            <span class="status">{{ lobby.players.length < lobby.maxPlayers ? 'Waiting for players' : 'Ready to start' }}</span>
          </div>

          <div class="info-item">
            <label>Game Mode:</label>
            <span class="game-mode">Co-op Adventure</span>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby-detail {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
}

.lobby-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.header-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn.secondary {
  background: rgba(42, 42, 42, 0.6);
  border: 1px solid rgba(212, 175, 55, 0.2);
  color: #d4af37;
}

.header-btn.secondary:hover {
  background: rgba(212, 175, 55, 0.1);
  border-color: rgba(212, 175, 55, 0.4);
}

.back-btn {
  padding: 0.5rem 1rem;
  background: rgba(42, 42, 42, 0.6);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 8px;
  color: #d4af37;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.back-btn:hover {
  background: rgba(212, 175, 55, 0.1);
  border-color: rgba(212, 175, 55, 0.4);
}

.lobby-title {
  font-size: 2rem;
  color: #d4af37;
  margin: 0;
  font-weight: 600;
}

.lobby-content {
  display: grid;
  grid-template-columns: 250px 1fr 300px;
  gap: 1.5rem;
  min-height: calc(100vh - 200px);
}

.players-panel {
  display: flex;
  flex-direction: column;
  gap: 1em;
}

.chat-panel {
  display: flex;
  flex-direction: column;
}

.players-section,
.voice-section,
.chat-section {
  background: rgba(42, 42, 42, 0.6);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 12px;
  padding: 1rem;
  backdrop-filter: blur(10px);
}

.players-section {
  max-height: 280px;
  overflow-y: auto;
}

.voice-section {
  flex-shrink: 0;
}

.players-section h3,
.voice-section h3,
.chat-section h3 {
  color: #d4af37;
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: rgba(45, 45, 45, 0.4);
  border-radius: 8px;
  border: 1px solid rgba(212, 175, 55, 0.1);
}

.player-item.empty {
  opacity: 0.5;
  border-color: rgba(102, 102, 102, 0.1);
}

.player-avatar {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #d4af37, #b8941f);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  color: #1a1a1a;
}

.player-avatar.empty {
  background: linear-gradient(135deg, #666, #555);
  color: #999;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.player-name {
  color: #ffffff;
  font-weight: 500;
}

.player-level {
  color: #d4af37;
  font-size: 0.8rem;
  font-weight: 400;
}

.voice-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.voice-btn {
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #d4af37, #b8941f);
  border: none;
  border-radius: 8px;
  color: #1a1a1a;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.voice-btn:hover {
  background: linear-gradient(135deg, #ffd700, #d4af37);
  transform: translateY(-1px);
}

.voice-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #888;
  font-size: 0.9rem;
}

.status-indicator {
  width: 8px;
  height: 8px;
  background: #4ade80;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.chat-section {
  height: calc(100vh - 250px);
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  margin-bottom: 1rem;
  padding-right: 0.5rem;
}

.chat-message {
  padding: 0.5rem;
  background: rgba(45, 45, 45, 0.3);
  border-radius: 6px;
  font-size: 0.9rem;
}

.message-user {
  color: #d4af37;
  font-weight: 600;
  margin-right: 0.5rem;
}

.message-text {
  color: #ffffff;
}

.chat-input {
  display: flex;
  gap: 0.5rem;
}

.message-input {
  flex: 1;
  padding: 0.75rem;
  background: rgba(45, 45, 45, 0.4);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 8px;
  color: #ffffff;
  font-size: 0.9rem;
}

.message-input:focus {
  outline: none;
  border-color: rgba(212, 175, 55, 0.5);
}

.send-btn {
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #d4af37, #b8941f);
  border: none;
  border-radius: 8px;
  color: #1a1a1a;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.send-btn:hover {
  background: linear-gradient(135deg, #ffd700, #d4af37);
}

.info-panel {
  display: flex;
  flex-direction: column;
}

.lobby-info {
  background: rgba(42, 42, 42, 0.6);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 12px;
  padding: 1.5rem;
  backdrop-filter: blur(10px);
}

.lobby-info h3 {
  color: #d4af37;
  margin: 0 0 1.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.info-item {
  margin-bottom: 1rem;
}

.info-item label {
  display: block;
  color: #d4af37;
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.password {
  background: rgba(45, 45, 45, 0.6);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  color: #d4af37;
  font-family: 'Courier New', monospace;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 2px;
  display: block;
  width: 100%;
  margin-bottom: 0.5rem;
}

.regenerate-link {
  color: #d4af37;
  font-size: 0.85rem;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: rgba(212, 175, 55, 0.3);
  transition: all 0.2s ease;
}

.regenerate-link:hover {
  color: #ffd700;
  text-decoration-color: rgba(255, 215, 0, 0.5);
}

.status,
.game-mode {
  color: #ffffff;
  font-size: 0.9rem;
}

.lobby-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-btn {
  padding: 1rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-btn.ready {
  background: linear-gradient(135deg, #4ade80, #22c55e);
  color: #1a1a1a;
}

.action-btn.ready:hover {
  background: linear-gradient(135deg, #6ee7b7, #4ade80);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 222, 128, 0.3);
}

.action-btn:not(.ready):not(.secondary) {
  background: linear-gradient(135deg, #d4af37, #b8941f);
  color: #1a1a1a;
}

.action-btn:not(.ready):not(.secondary):hover {
  background: linear-gradient(135deg, #ffd700, #d4af37);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
}

.toggle-container {
  display: flex;
  gap: 0.5rem;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  background: rgba(42, 42, 42, 0.8);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 8px;
  color: #d4af37;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.toggle-btn.active {
  background: rgba(212, 175, 55, 0.2);
  border-color: rgba(212, 175, 55, 0.5);
}

.toggle-btn:hover {
  background: rgba(212, 175, 55, 0.1);
  border-color: rgba(212, 175, 55, 0.4);
}

.action-btn.secondary {
  background: rgba(42, 42, 42, 0.6);
  border: 1px solid rgba(212, 175, 55, 0.2);
  color: #d4af37;
}

.action-btn.secondary:hover {
  background: rgba(212, 175, 55, 0.1);
  border-color: rgba(212, 175, 55, 0.4);
}

@media (max-width: 1024px) {
  .lobby-content {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .info-panel {
    order: -1;
  }

  .chat-section {
    height: 400px;
  }
}
</style>
