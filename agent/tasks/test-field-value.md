# Task: Add Unit Tests for field-value.ts

## File
`src/field-value.ts`

## Current Status
- ❌ No test file exists
- File contains FieldValue sentinel implementations (serverTimestamp, increment, arrayUnion, etc.)

## Objective
Create comprehensive unit tests for FieldValue sentinel values.

## Test File
Create: `src/field-value.spec.ts`

## Functions to Test

### 1. `FieldValue.serverTimestamp()`
**Test Cases:**
- ✅ Should create serverTimestamp sentinel
- ✅ Should have correct _type property
- ✅ Should be identifiable by isFieldValue()
- ✅ Should not have a value property

### 2. `FieldValue.delete()`
**Test Cases:**
- ✅ Should create delete sentinel
- ✅ Should have correct _type property
- ✅ Should be identifiable by isFieldValue()

### 3. `FieldValue.increment(n: number)`
**Test Cases:**
- ✅ Should create increment sentinel with positive number
- ✅ Should create increment sentinel with negative number
- ✅ Should create increment sentinel with zero
- ✅ Should store the increment value
- ✅ Should handle decimal numbers
- ✅ Should reject non-numeric values

### 4. `FieldValue.arrayUnion(...elements: any[])`
**Test Cases:**
- ✅ Should create arrayUnion sentinel with single element
- ✅ Should create arrayUnion sentinel with multiple elements
- ✅ Should handle empty array
- ✅ Should store all elements
- ✅ Should handle different data types (strings, numbers, objects)
- ✅ Should handle nested arrays

### 5. `FieldValue.arrayRemove(...elements: any[])`
**Test Cases:**
- ✅ Should create arrayRemove sentinel with single element
- ✅ Should create arrayRemove sentinel with multiple elements
- ✅ Should handle empty array
- ✅ Should store all elements
- ✅ Should handle different data types

### 6. `isFieldValue(value: any)`
**Test Cases:**
- ✅ Should return true for serverTimestamp
- ✅ Should return true for delete
- ✅ Should return true for increment
- ✅ Should return true for arrayUnion
- ✅ Should return true for arrayRemove
- ✅ Should return false for regular objects
- ✅ Should return false for null/undefined
- ✅ Should return false for primitives
- ✅ Should return false for objects with _type but not FieldValue

## Testing Strategy

### Unit Tests
- Test each FieldValue factory method
- Verify sentinel structure
- Test type checking function

### Edge Cases
- Invalid inputs to factory methods
- Type checking with similar objects
- Serialization behavior

## Dependencies
- Jest for testing framework
- No external dependencies needed

## Success Criteria
- ✅ All public functions have tests
- ✅ Code coverage 100% for field-value.ts (small file)
- ✅ All edge cases covered
- ✅ Tests run in <1 second
- ✅ No external dependencies

## Priority
**Medium** - Important utility but straightforward to test

## Estimated Time
1-2 hours
