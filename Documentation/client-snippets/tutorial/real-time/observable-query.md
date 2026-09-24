```typescript
@query({ observable: true }, service(AuthorRepository))
static allAuthors(authors: AuthorRepository): ObservableSource<Author[]> {
    return authors.observeAll();
}
```
