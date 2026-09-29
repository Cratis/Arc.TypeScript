```typescript
import { ConceptAs, field, Guid } from '@cratis/fundamentals';
import { argument, command, inject, query, readModel, service, singleton } from '@cratis/arc.core';
import { BehaviorSubject } from 'rxjs';

// Chat/ChatRoom.ts
export class ChatRoom {
    // Holds the room's full history and hands it to every new subscriber.
    readonly messages = new BehaviorSubject<ChatMessage[]>([]);

    send(user: string, message: string): void {
        this.messages.next([...this.messages.value, new ChatMessage(ChatMessageId.create(), user, new Date(), message)]);
    }
}

// One ChatService for the application.
@singleton()
export class ChatService {
    readonly #rooms = new Map<string, ChatRoom>();

    getChatRoom(name: string): ChatRoom {
        let room = this.#rooms.get(name);
        if (!room) {
            room = new ChatRoom();
            this.#rooms.set(name, room);
        }
        return room;
    }
}

// Chat/ChatRoomPage.ts
export class ChatMessageId extends ConceptAs<Guid> {
    static readonly valueType = Guid;

    static create(): ChatMessageId {
        return new ChatMessageId(Guid.create());
    }
}

@readModel()
export class ChatMessage {
    @field(ChatMessageId) id: ChatMessageId;
    @field(String) user: string;
    @field(Date) sentAt: Date;
    @field(String) message: string;

    constructor(id = ChatMessageId.create(), user = '', sentAt = new Date(), message = '') {
        this.id = id;
        this.user = user;
        this.sentAt = sentAt;
        this.message = message;
    }

    @query({ observable: true }, argument('roomName', String), service(ChatService))
    static forRoom(roomName: string, chatService: ChatService): BehaviorSubject<ChatMessage[]> {
        return chatService.getChatRoom(roomName).messages;
    }
}

@command()
export class SendMessage {
    @field(String) roomName!: string;
    @field(String) user!: string;
    @field(String) message!: string;

    @inject(ChatService)
    handle(chatService: ChatService): void {
        chatService.getChatRoom(this.roomName).send(this.user, this.message);
    }
}
```
