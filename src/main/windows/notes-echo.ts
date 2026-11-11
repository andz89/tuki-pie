let quiet = false;

// Runs a change the Notes window made itself. That window already knows the
// result (the saved note comes back as the answer), so telling it "notes
// changed" would only make it reload every note for nothing.
export function withoutEcho<Value>(change: () => Value): Value {
  quiet = true;
  try {
    return change();
  } finally {
    quiet = false;
  }
}

export function isEchoQuiet(): boolean {
  return quiet;
}
