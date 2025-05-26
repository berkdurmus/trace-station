import ApiServer from "./server";

// Export interfaces
export * from "./interfaces";

/**
 * Start the API server
 */
export function startApiServer(): void {
  const server = new ApiServer();
  server.start();
}

// Allow direct execution
if (require.main === module) {
  startApiServer();
}
