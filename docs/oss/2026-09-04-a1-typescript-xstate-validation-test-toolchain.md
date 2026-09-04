# OSS Evaluation: A1 TypeScript, XState, validation, test and lint toolchain

- Status: Adopted for A1
- Date: 2026-09-04
- Related ADR: `docs/adr/0004-framework-responsibility-boundaries.md`

## Candidate

TypeScript 7.0.2, XState 5.32.6, Zod 4.5.4, Vitest 5.0.0, Biome 2.5.12 and `@types/node` 26.4.1.

## Official repository

- https://github.com/microsoft/TypeScript
- https://github.com/statelyai/xstate
- https://github.com/colinhacks/zod
- https://github.com/vitest-dev/vitest
- https://github.com/biomejs/biome
- https://github.com/DefinitelyTyped/DefinitelyTyped

## License

TypeScript: Apache-2.0; XState, Zod, Vitest and `@types/node`: MIT; Biome: MIT OR Apache-2.0.

## Activity

All candidates have current registry releases and active upstream repositories as checked on 2026-09-04. Versions are pinned exactly in workspace manifests.

## API / SDK

Native TypeScript/Node packages. XState v5 provides lifecycle state machines; Zod provides runtime boundary schemas; Vitest and Biome provide tests and static checks.

## Self-host requirement

None.

## Platform requirements

Windows Native Node 24/pnpm 11 for A1. The packages are also portable to Linux and macOS.

## Overlap

XState owns only Device/Account/Network lifecycle. It does not own Job lifecycle. Zod validates public boundary data and does not replace domain invariants. Vitest and Biome are development-only.

## Adapter feasibility

Domain/contracts expose no XState-private types. State machines live in a separate package. Runtime validation is confined to contract parsing.

## Reasons for adoption/rejection

Adopted as the minimum mature OSS set for typed boundaries, explicit lifecycle, runtime validation and repeatable tests. No framework for workflow, scheduling, device driving or observability is introduced in A1.

## Validation evidence

Recorded by A1 build, typecheck, unit and contract test outputs.
