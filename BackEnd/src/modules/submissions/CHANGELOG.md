# submissions module changelog

All notable changes to the `submissions` backend module are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this module adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Partial indexes (`WHERE "deletedAt" IS NULL`) on `Submission` for `[questId, status]` and `[userId, status]` columns to speed up active-submission queries (#2000).
- `SubmissionMapper` class with explicit mapper methods for converting submission entities to API DTOs
- Cursor-based pagination for `GET /quests/:questId/submissions` endpoint: accepts `cursor`, `limit`, `status`, `userId`, `sortBy`, `order` query parameters via `QuerySubmissionsDto` (#1973)
- Limit clamp (max 100) via `CursorPaginationDto` `@Max(100)` validation on the `limit` field
