import * as fs from "fs";
import * as path from "path";
import { TraceFile } from "@/trace";
import { createReadStream } from "fs";
import { Extract } from "unzipper";

/**
 * Loads a Playwright trace file or zip archive containing trace files
 */
export async function loadTraceFile(filePath: string): Promise<TraceFile[]> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);

  // If it's a zip file, extract it
  if (ext === ".zip") {
    const extractDir = path.join(path.dirname(filePath), "extracted_traces");

    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    // Extract the zip file
    await createReadStream(filePath)
      .pipe(Extract({ path: extractDir }))
      .promise();

    // Look for trace files in the extracted directory
    const files = await findTraceFiles(extractDir);
    return files;
  } else if (
    ext === ".json" ||
    ext === ".trace" ||
    ext === "" ||
    ext === ".network" ||
    ext === ".stacks"
  ) {
    // Just load this file
    return [
      {
        filename,
        content: fs.readFileSync(filePath),
      },
    ];
  } else {
    throw new Error(
      `Unsupported file format: ${ext}. Expected .zip, .json, .trace, .network, or .stacks`
    );
  }
}

/**
 * Recursively find all trace files in a directory
 */
async function findTraceFiles(directory: string): Promise<TraceFile[]> {
  const files: TraceFile[] = [];
  const items = fs.readdirSync(directory);

  // Define priority order for trace files
  const traceFilenames = [
    "test.trace", // Primary trace file (top priority)
    "0-trace.network", // Network trace data
    "0-trace.stacks", // Stack trace data
  ];

  // First pass - look specifically for the important files in priority order
  for (const filename of traceFilenames) {
    if (items.includes(filename)) {
      const fullPath = path.join(directory, filename);
      console.log(`Found trace file: ${fullPath}`);
      files.push({
        filename,
        content: fs.readFileSync(fullPath),
      });
    }
  }

  // Return all found trace files
  if (files.length > 0) {
    return files;
  }

  // Otherwise search subdirectories
  for (const item of items) {
    const fullPath = path.join(directory, item);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      const subFiles = await findTraceFiles(fullPath);
      if (subFiles.length > 0) {
        files.push(...subFiles);
      }
    }
  }

  return files;
}
