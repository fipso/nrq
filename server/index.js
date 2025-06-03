import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const PORT = 8080;

// In-memory storage
const lobbies = new Map();
const players = new Map(); // clientId -> player info
const lobbySubscriptions = new Map(); // clientId -> lobbyId

class LobbyManager {
  constructor() {
    this.lobbies = lobbies;
  }

  createLobby(title, hostId, maxPlayers = 3) {
    const lobbyId = uuidv4();
    const lobby = {
      id: lobbyId,
      title,
      hostId,
      players: [hostId],
      maxPlayers,
      password: this.generatePassword(),
      isPrivate: false,
      createdAt: new Date(),
      chatMessages: [{
        id: uuidv4(),
        user: 'System',
        message: 'Lobby created! Welcome!',
        timestamp: new Date()
      }]
    };
    
    this.lobbies.set(lobbyId, lobby);
    lobbySubscriptions.set(hostId, lobbyId);
    return lobby;
  }

  joinLobby(lobbyId, playerId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby not found' };
    
    if (lobby.players.length >= lobby.maxPlayers) {
      return { success: false, error: 'Lobby is full' };
    }
    
    if (lobby.players.includes(playerId)) {
      return { success: false, error: 'Already in lobby' };
    }
    
    lobby.players.push(playerId);
    lobbySubscriptions.set(playerId, lobbyId);
    
    // Add system message
    lobby.chatMessages.push({
      id: uuidv4(),
      user: 'System',
      message: `${players.get(playerId)?.name || 'Player'} joined the lobby`,
      timestamp: new Date()
    });
    
    return { success: true, lobby };
  }

  leaveLobby(playerId) {
    const lobbyId = lobbySubscriptions.get(playerId);
    if (!lobbyId) return { success: false, error: 'Not in any lobby' };
    
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby not found' };
    
    lobby.players = lobby.players.filter(id => id !== playerId);
    lobbySubscriptions.delete(playerId);
    
    // Add system message
    lobby.chatMessages.push({
      id: uuidv4(),
      user: 'System',
      message: `${players.get(playerId)?.name || 'Player'} left the lobby`,
      timestamp: new Date()
    });
    
    // If host left, assign new host or delete lobby
    if (lobby.hostId === playerId) {
      if (lobby.players.length > 0) {
        lobby.hostId = lobby.players[0];
        lobby.chatMessages.push({
          id: uuidv4(),
          user: 'System',
          message: `${players.get(lobby.hostId)?.name || 'Player'} is now the host`,
          timestamp: new Date()
        });
      } else {
        this.lobbies.delete(lobbyId);
        return { success: true, lobbyDeleted: true };
      }
    }
    
    return { success: true, lobby };
  }

  delistLobby(lobbyId, playerId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby not found' };
    
    if (lobby.hostId !== playerId) {
      return { success: false, error: 'Only host can delist lobby' };
    }
    
    // Remove all players from lobby subscriptions
    lobby.players.forEach(pid => lobbySubscriptions.delete(pid));
    this.lobbies.delete(lobbyId);
    
    return { success: true };
  }

  addChatMessage(lobbyId, playerId, message) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby not found' };
    
    if (!lobby.players.includes(playerId)) {
      return { success: false, error: 'Not in this lobby' };
    }
    
    const chatMessage = {
      id: uuidv4(),
      user: players.get(playerId)?.name || 'Unknown',
      message: message.trim(),
      timestamp: new Date()
    };
    
    lobby.chatMessages.push(chatMessage);
    
    // Keep only last 100 messages
    if (lobby.chatMessages.length > 100) {
      lobby.chatMessages = lobby.chatMessages.slice(-100);
    }
    
    return { success: true, message: chatMessage };
  }

  generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  regeneratePassword(lobbyId, playerId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby not found' };
    
    if (lobby.hostId !== playerId) {
      return { success: false, error: 'Only host can regenerate password' };
    }
    
    lobby.password = this.generatePassword();
    return { success: true, password: lobby.password };
  }

  togglePrivacy(lobbyId, playerId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby not found' };
    
    if (lobby.hostId !== playerId) {
      return { success: false, error: 'Only host can change privacy' };
    }
    
    lobby.isPrivate = !lobby.isPrivate;
    return { success: true, isPrivate: lobby.isPrivate };
  }

  getPublicLobbies() {
    return Array.from(this.lobbies.values())
      .filter(lobby => !lobby.isPrivate)
      .map(lobby => ({
        id: lobby.id,
        title: lobby.title,
        players: lobby.players.map(pid => players.get(pid)).filter(Boolean),
        maxPlayers: lobby.maxPlayers,
        createdAt: lobby.createdAt
      }));
  }

  getLobbyDetails(lobbyId, playerId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby not found' };
    
    if (!lobby.players.includes(playerId)) {
      return { success: false, error: 'Not in this lobby' };
    }
    
    return {
      success: true,
      lobby: {
        ...lobby,
        players: lobby.players.map(pid => players.get(pid)).filter(Boolean)
      }
    };
  }
}

const lobbyManager = new LobbyManager();

const wss = new WebSocketServer({ port: PORT });

function broadcast(clients, type, data) {
  const message = JSON.stringify({ type, data });
  clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

function broadcastToLobby(lobbyId, type, data, excludeClient = null) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  
  const lobbyClients = Array.from(wss.clients).filter(client => 
    lobby.players.includes(client.playerId) && client !== excludeClient
  );
  
  broadcast(lobbyClients, type, data);
}

function sendToClient(client, type, data) {
  if (client.readyState === client.OPEN) {
    client.send(JSON.stringify({ type, data }));
  }
}

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.playerId = uuidv4();
  
  ws.on('message', (message) => {
    try {
      const { type, data } = JSON.parse(message);
      
      switch (type) {
        case 'register_player':
          players.set(ws.playerId, {
            id: ws.playerId,
            name: data.name,
            level: data.level || 1
          });
          sendToClient(ws, 'player_registered', {
            playerId: ws.playerId,
            player: players.get(ws.playerId)
          });
          break;
          
        case 'get_lobbies':
          sendToClient(ws, 'lobbies_list', {
            lobbies: lobbyManager.getPublicLobbies()
          });
          break;
          
        case 'create_lobby':
          const newLobby = lobbyManager.createLobby(
            data.title,
            ws.playerId,
            data.maxPlayers
          );
          sendToClient(ws, 'lobby_created', { lobby: newLobby });
          
          // Broadcast updated lobby list
          broadcast(Array.from(wss.clients), 'lobbies_updated', {
            lobbies: lobbyManager.getPublicLobbies()
          });
          break;
          
        case 'join_lobby':
          const joinResult = lobbyManager.joinLobby(data.lobbyId, ws.playerId);
          if (joinResult.success) {
            sendToClient(ws, 'lobby_joined', { lobby: joinResult.lobby });
            broadcastToLobby(data.lobbyId, 'player_joined', {
              player: players.get(ws.playerId),
              lobby: joinResult.lobby
            }, ws);
            broadcast(Array.from(wss.clients), 'lobbies_updated', {
              lobbies: lobbyManager.getPublicLobbies()
            });
          } else {
            sendToClient(ws, 'error', { message: joinResult.error });
          }
          break;
          
        case 'leave_lobby':
          const leaveResult = lobbyManager.leaveLobby(ws.playerId);
          if (leaveResult.success) {
            sendToClient(ws, 'lobby_left', {});
            if (!leaveResult.lobbyDeleted) {
              broadcastToLobby(lobbySubscriptions.get(ws.playerId), 'player_left', {
                playerId: ws.playerId,
                lobby: leaveResult.lobby
              }, ws);
            }
            broadcast(Array.from(wss.clients), 'lobbies_updated', {
              lobbies: lobbyManager.getPublicLobbies()
            });
          } else {
            sendToClient(ws, 'error', { message: leaveResult.error });
          }
          break;
          
        case 'delist_lobby':
          const currentLobbyId = lobbySubscriptions.get(ws.playerId);
          const delistResult = lobbyManager.delistLobby(currentLobbyId, ws.playerId);
          if (delistResult.success) {
            broadcastToLobby(currentLobbyId, 'lobby_delisted', {});
            broadcast(Array.from(wss.clients), 'lobbies_updated', {
              lobbies: lobbyManager.getPublicLobbies()
            });
          } else {
            sendToClient(ws, 'error', { message: delistResult.error });
          }
          break;
          
        case 'send_chat_message':
          const currentLobby = lobbySubscriptions.get(ws.playerId);
          const chatResult = lobbyManager.addChatMessage(
            currentLobby,
            ws.playerId,
            data.message
          );
          if (chatResult.success) {
            broadcastToLobby(currentLobby, 'chat_message', {
              message: chatResult.message
            });
          } else {
            sendToClient(ws, 'error', { message: chatResult.error });
          }
          break;
          
        case 'regenerate_password':
          const lobbyForPassword = lobbySubscriptions.get(ws.playerId);
          const passwordResult = lobbyManager.regeneratePassword(lobbyForPassword, ws.playerId);
          if (passwordResult.success) {
            broadcastToLobby(lobbyForPassword, 'password_updated', {
              password: passwordResult.password
            });
          } else {
            sendToClient(ws, 'error', { message: passwordResult.error });
          }
          break;
          
        case 'toggle_privacy':
          const lobbyForPrivacy = lobbySubscriptions.get(ws.playerId);
          const privacyResult = lobbyManager.togglePrivacy(lobbyForPrivacy, ws.playerId);
          if (privacyResult.success) {
            broadcastToLobby(lobbyForPrivacy, 'privacy_updated', {
              isPrivate: privacyResult.isPrivate
            });
            broadcast(Array.from(wss.clients), 'lobbies_updated', {
              lobbies: lobbyManager.getPublicLobbies()
            });
          } else {
            sendToClient(ws, 'error', { message: privacyResult.error });
          }
          break;
          
        case 'get_lobby_details':
          const lobbyId = lobbySubscriptions.get(ws.playerId);
          const detailsResult = lobbyManager.getLobbyDetails(lobbyId, ws.playerId);
          if (detailsResult.success) {
            sendToClient(ws, 'lobby_details', { lobby: detailsResult.lobby });
          } else {
            sendToClient(ws, 'error', { message: detailsResult.error });
          }
          break;
          
        default:
          sendToClient(ws, 'error', { message: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Message parsing error:', error);
      sendToClient(ws, 'error', { message: 'Invalid message format' });
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    
    // Auto-leave lobby on disconnect
    const leaveResult = lobbyManager.leaveLobby(ws.playerId);
    if (leaveResult.success && !leaveResult.lobbyDeleted) {
      const lobbyId = lobbySubscriptions.get(ws.playerId);
      broadcastToLobby(lobbyId, 'player_left', {
        playerId: ws.playerId,
        lobby: leaveResult.lobby
      });
    }
    
    // Clean up player data
    players.delete(ws.playerId);
    lobbySubscriptions.delete(ws.playerId);
    
    // Broadcast updated lobby list
    broadcast(Array.from(wss.clients), 'lobbies_updated', {
      lobbies: lobbyManager.getPublicLobbies()
    });
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log(`Nightreign Queue WebSocket server running on port ${PORT}`);