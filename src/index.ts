import { setupCLI } from "@/cli";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  // Set up CLI
  const program = await setupCLI();

  // Parse and execute commands
  await program.parseAsync(process.argv);

  // If no commands specified, show help
  if (process.argv.length <= 2) {
    program.help();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
