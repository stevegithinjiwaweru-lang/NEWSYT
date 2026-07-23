/**
 * Maps a thrown Error's message to an HTTP status code, following the
 * convention used across order/rider/dispatch services: services throw plain
 * `Error`s with human-readable messages, controllers map them here.
 */
export function statusForError(message: string): number {
  if (message.includes("not authorized")) return 403;
  if (message.includes("not found")) return 404;
  if (
    message.includes("not available") ||
    message.includes("already been assigned") ||
    message.includes("already completed") ||
    message.includes("not currently assigned") ||
    message.includes("already changed") ||
    message.includes("already exists")
  ) {
    return 409;
  }
  if (message.includes("Invalid") || message.includes("Unrecognized") || message.includes("required")) {
    return 400;
  }
  return 500;
}
