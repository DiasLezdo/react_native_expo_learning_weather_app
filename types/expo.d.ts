/**
 * Expo's ambient types, referenced from a committed file.
 *
 * Expo provides these through `expo-env.d.ts`, which it generates and which its
 * own template gitignores — the generated file even says so internally. That is
 * fine locally and breaks CI: a fresh checkout has never run the Expo CLI, so
 * the file does not exist and `tsc` fails on anything Expo declares, such as CSS
 * side-effect imports or image imports.
 *
 * That is exactly how the first release run failed, at the typecheck step, with:
 *
 *   error TS2882: Cannot find module or type declarations for side-effect
 *   import of '@/global.css'.
 *
 * Committing this one line makes typechecking work from a clean clone without
 * committing generated output or fighting the tool's gitignore.
 *
 * To reproduce the CI condition locally, hide the generated files and run tsc:
 *
 *   mv expo-env.d.ts /tmp/ && mv .expo/types /tmp/ && npx tsc --noEmit
 */

/// <reference types="expo/types" />
