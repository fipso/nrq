<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { wsService, type Lobby, type Player } from '../services/websocket';

const router = useRouter();

const lobbies = ref<Lobby[]>([]);
const isConnected = ref(false);

const joinLobby = (lobbyId: string) => {
  if (!isConnected.value) {
    alert('Not connected to server');
    return;
  }
  
  let playerName = localStorage.getItem('playerName');
  if (!playerName) {
    playerName = prompt('Enter your username:');
    if (playerName && playerName.trim()) {
      localStorage.setItem('playerName', playerName.trim());
    } else {
      alert('Username required');
      return;
    }
  }
  
  wsService.joinLobby(lobbyId, playerName);
};

const enterQueue = () => {
  if (!isConnected.value) {
    alert('Not connected to server');
    return;
  }
  
  const availableLobbies = lobbies.value.filter(lobby => lobby.players.length < lobby.maxPlayers);
  if (availableLobbies.length > 0) {
    const randomLobby = availableLobbies[Math.floor(Math.random() * availableLobbies.length)];
    joinLobby(randomLobby.id);
  } else {
    let playerName = localStorage.getItem('playerName');
    if (!playerName) {
      playerName = prompt('Enter your username:');
      if (playerName && playerName.trim()) {
        localStorage.setItem('playerName', playerName.trim());
      } else {
        alert('Username required');
        return;
      }
    }
    const lobbyTitle = `${playerName}'s Adventure`;
    wsService.createLobby(lobbyTitle, 3, playerName);
  }
};

const createLobby = () => {
  if (!isConnected.value) {
    alert('Not connected to server');
    return;
  }
  
  let playerName = localStorage.getItem('playerName');
  if (!playerName) {
    playerName = prompt('Enter your username:');
    if (playerName && playerName.trim()) {
      localStorage.setItem('playerName', playerName.trim());
    } else {
      alert('Username required');
      return;
    }
  }
  
  const title = prompt('Enter lobby title:');
  if (title) {
    wsService.createLobby(title, 3, playerName);
  }
};

const connectToServer = async () => {
  try {
    await wsService.connect();
    isConnected.value = true;
    
    // Set up event handlers
    wsService.on('lobbies_list', (data: any) => {
      lobbies.value = data.lobbies;
    });
    
    wsService.on('lobbies_updated', (data: any) => {
      lobbies.value = data.lobbies;
    });
    
    wsService.on('lobby_created', (data: any) => {
      router.push(`/lobbys/${data.lobby.id}`);
    });
    
    wsService.on('lobby_joined', (data: any) => {
      router.push(`/lobbys/${data.lobby.id}`);
    });
    
    wsService.on('error', (data: any) => {
      // If already in lobby, just redirect to lobby instead of showing error
      if (data.message === 'Already in lobby' && data.lobbyId) {
        router.push(`/lobbys/${data.lobbyId}`);
      } else {
        alert(data.message);
      }
    });
    
    wsService.on('current_lobby', (data: any) => {
      // User is already in a lobby, redirect there
      if (data.lobby) {
        router.push(`/lobbys/${data.lobby.id}`);
      }
    });
    
    // Check if user is already in a lobby
    const savedPlayerName = localStorage.getItem('playerName');
    if (savedPlayerName) {
      wsService.getCurrentLobby(savedPlayerName);
    }
    
    // Get lobbies list
    wsService.getLobbies();
    
  } catch (error) {
    console.error('Failed to connect to WebSocket server:', error);
    alert('Failed to connect to server. Please try again.');
  }
};

onMounted(() => {
  connectToServer();
});

onUnmounted(() => {
  // Clean up event handlers but don't disconnect the WebSocket
  wsService.off('lobbies_list');
  wsService.off('lobbies_updated');
  wsService.off('lobby_created');
  wsService.off('lobby_joined');
  wsService.off('current_lobby');
  wsService.off('error');
});
</script>

<template>
  <div class="matchmaking-container">
    <div class="main-content">
      <!-- Connection Status -->
      <div class="connection-status" :class="{ connected: isConnected, disconnected: !isConnected }">
        <span class="status-indicator"></span>
        {{ isConnected ? 'Connected to Server' : 'Connecting...' }}
      </div>

      <div class="lobbies-section">
        <div class="section-header">
          <h2 class="section-title">Open Lobbies</h2>
          <button @click="createLobby" class="create-lobby-btn" :disabled="!isConnected">
            ➕ Create Lobby
          </button>
        </div>
        
        <div v-if="lobbies.length === 0" class="no-lobbies">
          <p>No lobbies available. Create one or enter the queue!</p>
        </div>
        
        <div v-else class="lobbies-grid">
          <div 
            v-for="lobby in lobbies" 
            :key="lobby.id" 
            class="lobby-card"
            :class="{ 'full': lobby.players.length >= lobby.maxPlayers }"
          >
            <div class="lobby-header">
              <h3 class="lobby-title">{{ lobby.title }}</h3>
              <div class="header-actions">
                <span class="player-count">{{ lobby.players.length }}/{{ lobby.maxPlayers }}</span>
                <button 
                  v-if="lobby.players.length < lobby.maxPlayers"
                  @click="joinLobby(lobby.id)"
                  class="join-icon-btn"
                  title="Join Lobby"
                  :disabled="!isConnected"
                >
                  🪑
                </button>
                <div 
                  v-else
                  class="join-icon-btn disabled"
                  title="Lobby Full"
                >
                  🔒
                </div>
              </div>
            </div>
            
            <div class="players-list">
              <div 
                v-for="player in lobby.players" 
                :key="player.name" 
                class="player"
              >
                <span class="player-name">{{ player.name }}</span>
                <span class="player-level">Lv.{{ player.level }}</span>
              </div>
              
              <div 
                v-for="i in (lobby.maxPlayers - lobby.players.length)" 
                :key="`empty-${i}`" 
                class="player empty"
              >
                <span class="empty-slot">Empty Slot</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button class="enter-queue-btn" @click="enterQueue" :disabled="!isConnected">
        <span class="btn-text">ENTER QUEUE</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.matchmaking-container {
  position: relative;
  min-height: calc(100vh - 100px);
  max-width: 1200px;
  margin: 0 auto;
}

.lobbies-section {
  padding-bottom: 100px;
}

.section-title {
  font-size: 1.5rem;
  color: #d4af37;
  margin-bottom: 2rem;
  text-align: left;
  font-weight: 600;
}

.lobbies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  padding: 0.5rem;
  border: 1px solid rgba(212, 175, 55, 0.1);
}

.lobby-card {
  background: rgba(42, 42, 42, 0.6);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.lobby-card:hover {
  border-color: rgba(212, 175, 55, 0.5);
  background: rgba(42, 42, 42, 0.8);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(212, 175, 55, 0.1);
}

.lobby-card.full {
  opacity: 0.6;
  border-color: #666;
}

.lobby-card.full {
  opacity: 0.6;
  border-color: rgba(102, 102, 102, 0.3);
}

.lobby-card.full:hover {
  border-color: rgba(136, 136, 136, 0.4);
  transform: none;
}

.lobby-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}

.lobby-title {
  color: #d4af37;
  font-size: 1.1rem;
  margin: 0;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.player-count {
  color: #d4af37;
  font-size: 0.85rem;
  background: rgba(212, 175, 55, 0.1);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-weight: 500;
  border: 1px solid rgba(212, 175, 55, 0.2);
}

.join-icon-btn {
  width: 32px;
  height: 32px;
  background: rgba(42, 42, 42, 0.8);
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.join-icon-btn:hover {
  background: rgba(212, 175, 55, 0.2);
  border-color: rgba(212, 175, 55, 0.6);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
}

.join-icon-btn.disabled {
  background: linear-gradient(135deg, #666, #555);
  cursor: not-allowed;
}

.join-icon-btn.disabled:hover {
  transform: none;
  box-shadow: none;
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.player {
  padding: 0.75rem 1rem;
  background: rgba(45, 45, 45, 0.4);
  border-radius: 8px;
  border: 1px solid rgba(212, 175, 55, 0.15);
  border-left: 3px solid #d4af37;
}

.player.empty {
  background: rgba(37, 37, 37, 0.3);
  border-left-color: #666;
  border-color: rgba(102, 102, 102, 0.1);
  opacity: 0.4;
}

.player-name {
  color: #ffffff;
  font-weight: 500;
  font-size: 0.95rem;
}


.empty-slot {
  color: #888;
  font-style: italic;
  font-size: 0.9rem;
}

.enter-queue-btn {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #d4af37, #b8941f);
  border: none;
  border-radius: 16px;
  padding: 1rem 2.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1a1a1a;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow: 0 8px 32px rgba(212, 175, 55, 0.3);
  backdrop-filter: blur(10px);
}

.enter-queue-btn:hover {
  background: linear-gradient(135deg, #ffd700, #d4af37);
  transform: translateX(-50%) translateY(-4px);
  box-shadow: 0 12px 40px rgba(212, 175, 55, 0.4);
}

.enter-queue-btn:active {
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 6px 24px rgba(212, 175, 55, 0.4);
}

.btn-text {
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

/* New styles for WebSocket integration */
.name-input-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: rgba(42, 42, 42, 0.95);
  border: 2px solid rgba(212, 175, 55, 0.3);
  border-radius: 16px;
  padding: 2rem;
  backdrop-filter: blur(20px);
  max-width: 400px;
  width: 90%;
}

.modal-content h2 {
  color: #d4af37;
  text-align: center;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.input-group {
  margin-bottom: 1rem;
}

.input-group label {
  display: block;
  color: #d4af37;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.name-input,
.level-input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(45, 45, 45, 0.6);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 8px;
  color: #ffffff;
  font-size: 1rem;
}

.name-input:focus,
.level-input:focus {
  outline: none;
  border-color: rgba(212, 175, 55, 0.5);
}

.register-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #d4af37, #b8941f);
  border: none;
  border-radius: 8px;
  color: #1a1a1a;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 1rem;
}

.register-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #ffd700, #d4af37);
}

.register-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
}

.connection-status.connected {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.2);
  color: #4ade80;
}

.connection-status.disconnected {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.create-lobby-btn {
  padding: 0.5rem 1rem;
  background: rgba(42, 42, 42, 0.6);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 8px;
  color: #d4af37;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  font-weight: 600;
}

.create-lobby-btn:hover:not(:disabled) {
  background: rgba(212, 175, 55, 0.1);
  border-color: rgba(212, 175, 55, 0.4);
}

.create-lobby-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-lobbies {
  text-align: center;
  padding: 3rem;
  color: #888;
  font-style: italic;
}

.player-level {
  color: #d4af37;
  font-size: 0.8rem;
  font-weight: 500;
}

.player {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.enter-queue-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: translateX(-50%);
}

.enter-queue-btn:disabled:hover {
  transform: translateX(-50%);
  box-shadow: 0 8px 32px rgba(212, 175, 55, 0.3);
}

.join-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

</style>
