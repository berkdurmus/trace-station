import { setupCLI } from "@/cli";
import dotenv from "dotenv";
import { startApiServer } from "@/api";

// Load environment variables
dotenv.config();

// API server flag
const RUN_API_SERVER = process.env.RUN_API_SERVER === "true";

async function main() {
  // Start API server if enabled
  if (RUN_API_SERVER) {
    console.log("Starting API server...");
    startApiServer();
  }

  // Set up CLI
  const program = await setupCLI();

  // Parse and execute commands
  await program.parseAsync(process.argv);

  // If no commands specified and API server is not running, show help
  if (process.argv.length <= 2 && !RUN_API_SERVER) {
    program.help();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
