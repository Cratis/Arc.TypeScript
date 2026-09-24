```typescript
@query(service(AuthorRepository))
static allAuthors(authors: AuthorRepository): Promise<Author[]> {
    return authors.all();
}
```
