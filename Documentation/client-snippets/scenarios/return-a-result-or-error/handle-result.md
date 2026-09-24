```typescript
@inject(AuthorRepository)
async handle(authors: AuthorRepository): Promise<AuthorId | Outcome<never>> {
    if (await authors.existsByName(this.name)) {
        return rejected(validation('An author with that name is already registered.', ['name']));
    }

    await authors.save({ id: this.id, name: this.name });
    return this.id;
}
```
