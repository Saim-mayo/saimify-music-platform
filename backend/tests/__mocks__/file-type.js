// Manual Jest mock for `file-type`.
//
// `file-type` v22 ships as a pure ESM package. Your app can still
// `require('file-type')` in production because Node 22+ added native
// support for CommonJS `require()` to load ESM packages — but Jest's
// module runtime doesn't implement that yet, so importing it inside
// Jest throws a parse error ("Cannot use import statement outside a
// module") the moment anything requires music.routes.js -> file.validator.js.
//
// This shared stub intentionally exposes a writable Jest mock so the
// validator suites can drive the real branch paths without reaching a
// real external ESM import at runtime.
module.exports = {
   fileTypeFromBuffer: jest.fn(async () => null)
};
