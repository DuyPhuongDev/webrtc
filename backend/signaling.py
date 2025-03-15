from typing import Dict, Any, List, Optional
import json
import asyncio
from fastapi import WebSocket
import uuid
from webrtc import WebRTCManager

class WebRTCSignaling:
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}
        self.rooms: Dict[str, Dict[str, Any]] = {}
        self.webrtc_manager = WebRTCManager()
    
    async def register_connection(self, client_id: str, websocket: WebSocket) -> None:
        """Register a new WebSocket connection with a unique client ID."""
        self.connections[client_id] = websocket
        print(f"Client {client_id} connected")
        
    async def handle_disconnect(self, client_id: str) -> None:
        """Handle client disconnection."""
        if client_id in self.connections:
            del self.connections[client_id]
            print(f"Client {client_id} disconnected")
            
            # Clean up client from rooms
            for room_id, room in self.rooms.items():
                participants = room.get("participants", {})
                if client_id in participants:
                    await self.notify_room(room_id, {
                        "type": "userLeft",
                        "data": {"userId": client_id}
                    }, exclude=[client_id])
                    
                    del participants[client_id]
                    
                    # If room is empty, clean up
                    if not participants:
                        del self.rooms[room_id]
    
    async def handle_message(self, client_id: str, message: Dict[str, Any]) -> None:
        """Handle incoming WebSocket messages for signaling."""
        msg_type = message.get("type")
        data = message.get("data", {})
        
        if msg_type == "joinRoom":
            await self.handle_join_room(client_id, data)
        elif msg_type == "createWebRtcTransport":
            await self.handle_create_transport(client_id, data)
        elif msg_type == "connectTransport":
            await self.handle_connect_transport(client_id, data)
        elif msg_type == "produce":
            await self.handle_produce(client_id, data)
        elif msg_type == "consume":
            await self.handle_consume(client_id, data)
        elif msg_type == "resumeConsumer":
            await self.handle_resume_consumer(client_id, data)
        else:
            print(f"Unknown message type: {msg_type}")
    
    async def handle_join_room(self, client_id: str, data: Dict[str, Any]) -> None:
        """Handle join room request."""
        room_id = data.get("room")
        username = data.get("username")
        role = data.get("role")
        
        if not room_id:
            await self.send_error(client_id, "Room ID is required")
            return
            
        # Create room if it doesn't exist
        if room_id not in self.rooms:
            self.rooms[room_id] = {
                "id": room_id,
                "participants": {},
                "router": await self.webrtc_manager.create_router()
            }
            
        room = self.rooms[room_id]
        
        # Add participant to room
        room["participants"][client_id] = {
            "id": client_id,
            "name": username,
            "role": role,
            "transports": {},
            "producers": {},
            "consumers": {}
        }
        
        # Notify others in the room
        await self.notify_room(room_id, {
            "type": "userJoined",
            "data": {
                "id": client_id,
                "name": username,
                "role": role
            }
        }, exclude=[client_id])
        
        # Send room info to client
        participants = []
        for pid, participant in room["participants"].items():
            if pid != client_id:  # Don't include self
                participants.append({
                    "id": pid,
                    "name": participant["name"],
                    "role": participant["role"]
                })
                
        await self.send_to_client(client_id, {
            "type": "roomJoined",
            "data": {
                "roomId": room_id,
                "participants": participants,
                "rtpCapabilities": room["router"].rtp_capabilities
            }
        })
    
    async def handle_create_transport(self, client_id: str, data: Dict[str, Any]) -> None:
        """Handle creating a WebRTC transport."""
        is_sender = data.get("sender", False)
        
        # Find room for this client
        room_id, room = self._get_room_for_client(client_id)
        if not room:
            await self.send_error(client_id, "Not in a room")
            return
        
        try:
            transport = await self.webrtc_manager.create_transport(room["router"])
            transport_info = {
                "id": transport.id,
                "iceParameters": transport.ice_parameters,
                "iceCandidates": transport.ice_candidates,
                "dtlsParameters": transport.dtls_parameters
            }
            
            # Store transport in participant data
            participant = room["participants"][client_id]
            participant["transports"][transport.id] = {
                "id": transport.id,
                "transport": transport,
                "sender": is_sender
            }
            
            await self.send_to_client(client_id, {
                "type": "transportCreated",
                "data": transport_info
            })
        except Exception as e:
            await self.send_error(client_id, f"Error creating transport: {str(e)}")
    
    async def handle_connect_transport(self, client_id: str, data: Dict[str, Any]) -> None:
        """Connect client's transport."""
        transport_id = data.get("transportId")
        dtls_parameters = data.get("dtlsParameters")
        
        if not transport_id or not dtls_parameters:
            await self.send_error(client_id, "Missing required parameters")
            return
        
        room_id, room = self._get_room_for_client(client_id)
        if not room:
            await self.send_error(client_id, "Not in a room")
            return
        
        participant = room["participants"][client_id]
        transport_data = participant["transports"].get(transport_id)
        
        if not transport_data:
            await self.send_error(client_id, "Transport not found")
            return
        
        try:
            await transport_data["transport"].connect(dtls_parameters)
            await self.send_to_client(client_id, {
                "type": "transportConnected",
                "data": {
                    "transportId": transport_id,
                    "connected": True
                }
            })
        except Exception as e:
            await self.send_error(client_id, f"Error connecting transport: {str(e)}")
    
    async def handle_produce(self, client_id: str, data: Dict[str, Any]) -> None:
        """Handle producing media (publishing)."""
        transport_id = data.get("transportId")
        kind = data.get("kind")
        rtp_parameters = data.get("rtpParameters")
        
        if not transport_id or not kind or not rtp_parameters:
            await self.send_error(client_id, "Missing required parameters")
            return
        
        room_id, room = self._get_room_for_client(client_id)
        if not room:
            await self.send_error(client_id, "Not in a room")
            return
        
        participant = room["participants"][client_id]
        transport_data = participant["transports"].get(transport_id)
        
        if not transport_data:
            await self.send_error(client_id, "Transport not found")
            return
        
        try:
            producer = await transport_data["transport"].produce(
                kind=kind,
                rtp_parameters=rtp_parameters
            )
            
            # Store producer
            participant["producers"][producer.id] = producer
            
            # Notify other participants about new producer
            await self.notify_room(room_id, {
                "type": "newProducer",
                "data": {
                    "producerId": producer.id,
                    "producerUserId": client_id,
                    "kind": kind
                }
            }, exclude=[client_id])
            
            await self.send_to_client(client_id, {
                "type": "producerCreated",
                "data": {
                    "id": producer.id
                }
            })
        except Exception as e:
            await self.send_error(client_id, f"Error producing: {str(e)}")
    
    async def handle_consume(self, client_id: str, data: Dict[str, Any]) -> None:
        """Handle consuming media (subscribing)."""
        transport_id = data.get("transportId")
        producer_id = data.get("producerId")
        rtp_capabilities = data.get("rtpCapabilities")
        
        if not transport_id or not producer_id or not rtp_capabilities:
            await self.send_error(client_id, "Missing required parameters")
            return
        
        room_id, room = self._get_room_for_client(client_id)
        if not room:
            await self.send_error(client_id, "Not in a room")
            return
        
        # Find the producer's owner
        producer_owner_id = None
        producer = None
        for pid, p in room["participants"].items():
            for prod_id, prod in p["producers"].items():
                if prod_id == producer_id:
                    producer_owner_id = pid
                    producer = prod
                    break
            if producer_owner_id:
                break
        
        if not producer:
            await self.send_error(client_id, "Producer not found")
            return
        
        participant = room["participants"][client_id]
        transport_data = participant["transports"].get(transport_id)
        
        if not transport_data:
            await self.send_error(client_id, "Transport not found")
            return
        
        try:
            # Check if consumer can consume the producer
            if not room["router"].can_consume(producer_id, rtp_capabilities):
                await self.send_error(client_id, "Cannot consume this producer")
                return
            
            # Create consumer
            consumer = await transport_data["transport"].consume(
                producer_id=producer_id,
                rtp_capabilities=rtp_capabilities,
                paused=True
            )
            
            # Store consumer
            participant["consumers"][consumer.id] = consumer
            
            await self.send_to_client(client_id, {
                "type": "consumerCreated",
                "data": {
                    "id": consumer.id,
                    "producerId": producer_id,
                    "kind": consumer.kind,
                    "rtpParameters": consumer.rtp_parameters,
                    "producerUserId": producer_owner_id
                }
            })
        except Exception as e:
            await self.send_error(client_id, f"Error consuming: {str(e)}")
    
    async def handle_resume_consumer(self, client_id: str, data: Dict[str, Any]) -> None:
        """Resume consumer."""
        consumer_id = data.get("consumerId")
        
        if not consumer_id:
            await self.send_error(client_id, "Consumer ID is required")
            return
        
        room_id, room = self._get_room_for_client(client_id)
        if not room:
            await self.send_error(client_id, "Not in a room")
            return
        
        participant = room["participants"][client_id]
        consumer = participant["consumers"].get(consumer_id)
        
        if not consumer:
            await self.send_error(client_id, "Consumer not found")
            return
        
        try:
            await consumer.resume()
            await self.send_to_client(client_id, {
                "type": "consumerResumed",
                "data": {
                    "consumerId": consumer_id,
                    "resumed": True
                }
            })
        except Exception as e:
            await self.send_error(client_id, f"Error resuming consumer: {str(e)}")
    
    async def send_to_client(self, client_id: str, message: Dict[str, Any]) -> None:
        """Send message to a specific client."""
        if client_id in self.connections:
            websocket = self.connections[client_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"Error sending to client {client_id}: {e}")
                await self.handle_disconnect(client_id)
    
    async def send_error(self, client_id: str, error_message: str) -> None:
        """Send error message to client."""
        await self.send_to_client(client_id, {
            "type": "error",
            "data": {
                "message": error_message
            }
        })
    
    async def notify_room(self, room_id: str, message: Dict[str, Any], exclude: List[str] = None) -> None:
        """Send message to all clients in a room except those in exclude list."""
        if room_id not in self.rooms:
            return
        
        exclude = exclude or []
        room = self.rooms[room_id]
        
        for pid in room["participants"]:
            if pid not in exclude:
                await self.send_to_client(pid, message)
    
    def _get_room_for_client(self, client_id: str) -> tuple:
        """Find which room the client is in."""
        for room_id, room in self.rooms.items():
            if client_id in room["participants"]:
                return room_id, room
        return None, None