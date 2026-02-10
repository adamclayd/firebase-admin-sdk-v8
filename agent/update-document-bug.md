# updateDocument updateMask Bug

## Problem

`updateDocument` creates invalid property path by concatenating field names with commas.

## Error

```
Invalid property path "last_message_at,updated_at"
```

## Code

```typescript
await updateDocument(CONVERSATIONS, conversationId, {
  last_message_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
})
```

## Expected

updateMask should be:
```
updateMask.fieldPaths=last_message_at&updateMask.fieldPaths=updated_at
```

## Actual

updateMask is:
```
updateMask.fieldPaths=last_message_at,updated_at
```

## Fix Needed

The library needs to properly format multiple field paths in the updateMask query parameter.

## Workaround

Use `setDocument` with individual field updates or fix the library.

## Priority

HIGH - Blocks message saving
