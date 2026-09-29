```typescript
import { ConceptAs, field, Guid } from '@cratis/fundamentals';
import { argument, command, inject, injectable, query, readModel, service, singleton } from '@cratis/arc.core';
import { BehaviorSubject } from 'rxjs';

// Chat/ChatPersistence.ts
// An abstract class, so it can be the service token; register your implementation for it.
export abstract class ChatPersistence {
    // Loads a room's messages, oldest first.
    abstract history(roomName: string): Promise<ChatMessage[]>;
}

// Chat/ChatRoom.ts
export class ChatRoom {
    readonly messages: BehaviorSubject<ChatMessage[]>;

    constructor(history: ChatMessage[]) {
        this.messages = new BehaviorSubject(history);
    }

    // Called for every message that arrives from the broker.
    receive(message: ChatMessage): void {
        this.messages.next([...this.messages.value, message]);
    }
}

// Loads the history once, the first time a room is asked for.
@singleton()
@injectable(ChatPersistence)
export class ChatService {
    readonly #rooms = new Map<string, Promise<ChatRoom>>();

    constructor(private readonly persistence: ChatPersistence) {}

    getChatRoom(name: string): Promise<ChatRoom> {
        let room = this.#rooms.get(name);
        if (!room) {
            room = this.persistence.history(name).then(history => new ChatRoom(history));
            this.#rooms.set(name, room);
            // Forget a failed load, so the next subscriber tries again.
            room.catch(() => this.#rooms.delete(name));
        }
        return room;
    }
}

// Chat/ChatPublisher.ts
export abstract class ChatPublisher {
    abstract publish(envelope: ChatMessageEnvelope): Promise<void>;
}

// Chat/ChatRoomPage.ts
export class ChatMessageId extends ConceptAs<Guid> {
    static readonly valueType = Guid;

    static create(): ChatMessageId {
        return new ChatMessageId(Guid.create());
    }
}

// The wire format on the broker: the message plus the room it belongs to.
export interface ChatMessageEnvelope {
    roomName: string;
    id: string;
    user: string;
    sentAt: string;
    message: string;
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
    static async forRoom(roomName: string, chatService: ChatService): Promise<BehaviorSubject<ChatMessage[]>> {
        return (await chatService.getChatRoom(roomName)).messages;
    }
}

@command()
export class SendMessage {
    @field(String) roomName!: string;
    @field(String) user!: string;
    @field(String) message!: string;

    // Publishes to the broker; the room updates when the message comes back from it.
    @inject(ChatPublisher)
    handle(publisher: ChatPublisher): Promise<void> {
        return publisher.publish({
            roomName: this.roomName,
            id: ChatMessageId.create().value.toString(),
            user: this.user,
            sentAt: new Date().toISOString(),
            message: this.message
        });
    }
}
```
