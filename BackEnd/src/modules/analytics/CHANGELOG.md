# analytics module changelog

All notable changes to the `analytics` backend module are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this module adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]
### Changed
- Replaced offset-based chunking with true database streaming cursors (`.stream()`) for data exports.
- Implemented network backpressure in stream exports (CSV, JSON, JSONL) to prevent memory spikes on large quests.
