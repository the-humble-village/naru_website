import '@testing-library/jest-dom/vitest';

// The UTC time zone is set in vitest.config.ts (test.env), not here: this file is
// type-checked against browser types, which have no `process`.