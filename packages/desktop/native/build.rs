// napi-build emits the linker flags needed to produce a valid .node binary
// and generates TypeScript type definitions alongside the compiled binary.
extern crate napi_build;

fn main() {
  napi_build::setup();
}
