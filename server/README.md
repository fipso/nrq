# Nightreign Queue Server

WebSocket server for the Nightreign Queue application, handling lobby creation, management, and chat functionality.

## Features

- **Lobby Management**: Create, join, leave, and delist lobbies
- **Real-time Chat**: Send and receive messages within lobbies
- **Player Management**: Track player information and lobby membership
- **Password Generation**: Automatic lobby password generation with regeneration
- **Privacy Controls**: Toggle lobby visibility (public/private)
- **Queue System**: Automatic matchmaking and lobby assignment

## API

### WebSocket Messages

#### Client → Server

- `register_player` - Register a player with name and level
- `get_lobbies` - Get list of public lobbies
- `create_lobby` - Create a new lobby
- `join_lobby` - Join an existing lobby
- `leave_lobby` - Leave current lobby
- `delist_lobby` - Delist lobby (host only)
- `send_chat_message` - Send chat message
- `regenerate_password` - Generate new lobby password (host only)
- `toggle_privacy` - Toggle lobby privacy (host only)
- `get_lobby_details` - Get current lobby details

#### Server → Client

- `player_registered` - Player registration confirmation
- `lobbies_list` - List of public lobbies
- `lobbies_updated` - Updated lobby list
- `lobby_created` - Lobby creation confirmation
- `lobby_joined` - Lobby join confirmation
- `lobby_left` - Lobby leave confirmation
- `lobby_delisted` - Lobby delist notification
- `lobby_details` - Current lobby details
- `chat_message` - New chat message
- `password_updated` - New lobby password
- `privacy_updated` - Privacy setting changed
- `player_joined` - Player joined lobby
- `player_left` - Player left lobby
- `error` - Error message

## Usage

```bash
# Install dependencies
npm install

# Start server
npm start

# Start with auto-reload (development)
npm run dev
```

Server runs on `ws://localhost:8080`

## Future WebRTC Integration

The WebSocket server is designed to support future WebRTC session negotiation for voice chat. The infrastructure is in place to handle:
- ICE candidate exchange
- SDP offer/answer negotiation
- Peer connection management
- Voice chat room coordination