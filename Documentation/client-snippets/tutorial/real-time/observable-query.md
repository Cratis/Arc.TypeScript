```typescript
@query({ observable: true }, service(AuthorRepository))
static allAuthors(authors: AuthorRepository): BehaviorSubject<Author[]> {
    return authors.observeAll();
}
```
