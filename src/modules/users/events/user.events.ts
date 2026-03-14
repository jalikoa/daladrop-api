export class UserCreatedEvent {
  constructor(
    public readonly userId: number,
    public readonly email: string | null,
    public readonly role: string,
    public readonly timestamp: Date,
  ) {}
}

export class UserUpdatedEvent {
  constructor(
    public readonly userId: number,
    public readonly timestamp: Date,
  ) {}
}

export class UserDeletedEvent {
  constructor(
    public readonly userId: number,
    public readonly timestamp: Date,
  ) {}
}
