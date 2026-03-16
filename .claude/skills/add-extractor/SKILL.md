---
name: add-extractor
description: Create a new data source extractor following the Open/Closed principle pattern.
---

Create a new data source extractor for: $ARGUMENTS

Follow the project's Open/Closed principle pattern:

1. Create `src/extractors/api/<name>.ts` extending `BaseApiExtractor` from `./base`
2. Implement `supports()` — return true for the new source type
3. Implement `fetchData()` — fetch data from the external API with proper error handling
4. Implement `normalise()` — map the API response to the `FinancialRecord` schema
5. Add the new `SourceType` to `src/core/types/index.ts`
6. Export from `src/extractors/api/index.ts`
7. Register in `src/container.ts` as a singleton
8. Inject into `PipelineService` and add to `getExtractorForType()`
9. Write a unit test in `tests/unit/` that tests supports(), retry logic, and normalisation
10. Run `/check` to verify everything compiles and tests pass
