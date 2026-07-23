# Coding Standards

## Language

- Write JavaScript, not TypeScript.
- Use ES modules (`import`/`export`).

## Style

- Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript).
- Enforce with ESLint using `eslint-config-airbnb-base`.

## Key Airbnb Rules (quick reference)

- Use `const` by default; `let` when reassignment is needed; never `var`.
- Use arrow functions for anonymous functions and callbacks.
- Use template literals over string concatenation.
- Use destructuring for objects and arrays.
- Use shorthand property and method syntax in objects.
- Trailing commas in multiline literals.
- Single quotes for strings.
- Semicolons required.
- 2-space indentation.
- No unused variables.

## Linting

- ESLint config lives at the workspace root.
- All packages and apps inherit the root config.
